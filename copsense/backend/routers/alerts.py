from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
import models

router = APIRouter(prefix="/api/alerts", tags=["Smart Alerts"])

SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


@router.get("")
def list_alerts(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Role-filtered alert list."""
    query = db.query(models.Alert)

    if current_user.role == "field_officer":
        # Field officers only see alerts assigned to them
        query = query.filter(models.Alert.assigned_officer_id == current_user.id)
    elif current_user.role == "station_officer":
        # Station officers see alerts for their roles
        query = query.filter(
            models.Alert.target_roles.contains('"station_officer"')
        )
    elif current_user.role == "citizen":
        return []
    # SSP sees all

    alerts = query.order_by(models.Alert.created_at.desc()).all()
    return [
        {
            "id": a.id,
            "type": a.alert_type,
            "message": a.message,
            "severity": a.severity,
            "assigned_officer_id": a.assigned_officer_id,
            "case_id": a.case_id,
            "case_type": a.case_type,
            "status": a.status,
            "created_at": a.created_at,
        }
        for a in alerts
    ]


@router.post("/assign-case")
def assign_case_to_officer(
    case_type: str,
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """
    Smart case assignment based on:
    - Officer skill/specialization
    - Availability
    - Workload balance (fewer active cases = preferred)
    Low + high severity cases assigned simultaneously.
    """
    if case_type == "fir":
        case = db.query(models.FIR).filter(models.FIR.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="FIR not found")
        severity = case.severity
        crime_type = case.crime_type
    elif case_type == "complaint":
        case = db.query(models.Complaint).filter(models.Complaint.id == case_id).first()
        if not case:
            raise HTTPException(status_code=404, detail="Complaint not found")
        severity = "medium"
        crime_type = case.complaint_type
    else:
        raise HTTPException(status_code=400, detail="case_type must be fir or complaint")

    # Get available field officers in station
    station_id = current_user.station_id
    officers = db.query(models.User).filter(
        models.User.role == "field_officer",
        models.User.station_id == station_id,
        models.User.is_available == True
    ).all()

    if not officers:
        raise HTTPException(status_code=400, detail="No available field officers in station")

    # Score officers
    def officer_score(officer: models.User) -> int:
        score = 0
        # Specialization match
        crime_lower = crime_type.lower()
        if officer.specialization:
            spec = officer.specialization.lower()
            if spec in crime_lower or crime_lower in spec:
                score += 30
            elif spec == "crime" and severity == "high":
                score += 20
        # Workload — count open FIRs assigned to this officer
        active_firs = db.query(models.FIR).filter(
            models.FIR.officer_id == officer.id,
            models.FIR.status != "closed"
        ).count()
        active_complaints = db.query(models.Complaint).filter(
            models.Complaint.assigned_officer_id == officer.id,
            models.Complaint.status != "resolved"
        ).count()
        workload = active_firs + active_complaints
        score -= workload * 5  # penalize heavy workload
        return score

    # Sort by score — best officer first
    best_officer = max(officers, key=officer_score)

    # Assign the case
    if case_type == "fir":
        case.officer_id = best_officer.id
    else:
        case.assigned_officer_id = best_officer.id
        case.status = "reviewing"

    # Create assignment alert for the officer
    alert = models.Alert(
        alert_type="case",
        message=f"📋 New {severity.upper()} severity {case_type.upper()} assigned to you: {crime_type} (Case #{case_id})",
        severity=severity,
        assigned_officer_id=best_officer.id,
        case_id=case_id,
        case_type=case_type,
        target_roles=["field_officer"]
    )
    db.add(alert)
    db.commit()

    return {
        "assigned_officer": best_officer.name,
        "badge_id": best_officer.badge_id,
        "specialization": best_officer.specialization,
        "case_type": case_type,
        "case_id": case_id,
        "severity": severity
    }


@router.put("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    from datetime import datetime
    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.utcnow()
    db.commit()
    return {"message": "Alert acknowledged"}


@router.put("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "resolved"
    db.commit()
    return {"message": "Alert resolved"}
