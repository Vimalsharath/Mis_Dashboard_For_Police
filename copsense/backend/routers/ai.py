from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
from ai.emergency_optimizer import rank_officers
import models

router = APIRouter(prefix="/api/ai", tags=["AI"])


@router.post("/emergency-response")
def emergency_response_optimizer(
    incident_lat: float,
    incident_lng: float,
    required_specialization: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Suggest top 5 nearest available officers for emergency response.
    Uses Haversine distance + specialization + workload scoring.
    """
    # Get all available field officers with their last known GPS duty coords
    officers = db.query(models.User).filter(
        models.User.role == "field_officer",
        models.User.is_available == True
    ).all()

    officer_data = []
    for o in officers:
        # Try to get GPS from active duty
        active_duty = db.query(models.OfficerDuty).filter(
            models.OfficerDuty.officer_id == o.id,
            models.OfficerDuty.status == "active"
        ).first()

        lat = active_duty.zone_lat if active_duty and active_duty.zone_lat else incident_lat + 0.01
        lng = active_duty.zone_lng if active_duty and active_duty.zone_lng else incident_lng + 0.01

        # Count active cases
        active_cases = db.query(models.FIR).filter(
            models.FIR.officer_id == o.id,
            models.FIR.status != "closed"
        ).count()

        officer_data.append({
            "id": o.id,
            "name": o.name,
            "badge_id": o.badge_id or "",
            "specialization": o.specialization or "general",
            "latitude": lat,
            "longitude": lng,
            "is_available": o.is_available,
            "active_case_count": active_cases
        })

    if not officer_data:
        raise HTTPException(status_code=404, detail="No available field officers found")

    ranked = rank_officers(
        officers=officer_data,
        incident_lat=incident_lat,
        incident_lng=incident_lng,
        required_specialization=required_specialization,
        top_n=5
    )

    return {
        "incident_location": {"lat": incident_lat, "lng": incident_lng},
        "required_specialization": required_specialization,
        "recommendations": ranked
    }


@router.post("/crowd-plan")
def generate_crowd_plan(
    event_name: str,
    location: str,
    crowd_size: int,
    risk_level: str,
    duration_hours: float,
    lat: float = None,
    lng: float = None,
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """Generate AI crowd deployment blueprint without saving."""
    from ai.crowd_planner import generate_blueprint
    blueprint = generate_blueprint(
        event_name=event_name,
        location=location,
        crowd_size=crowd_size,
        risk_level=risk_level,
        duration_hours=duration_hours,
        latitude=lat,
        longitude=lng
    )
    return blueprint


@router.get("/dashboard-stats")
def get_dashboard_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Real-time dashboard statistics — role-filtered."""
    if current_user.role == "citizen":
        raise HTTPException(status_code=403, detail="Citizens cannot view dashboard stats")

    # Base queries — SSP sees all, others see their station
    fir_q = db.query(models.FIR)
    complaint_q = db.query(models.Complaint)
    custody_q = db.query(models.Custody)
    officer_q = db.query(models.User).filter(
        models.User.role.in_(["field_officer", "station_officer"])
    )

    if current_user.role in ("station_officer", "field_officer"):
        sid = current_user.station_id
        fir_q = fir_q.filter(models.FIR.station_id == sid)
        complaint_q = complaint_q.filter(models.Complaint.station_id == sid)
        custody_q = custody_q.filter(models.Custody.station_id == sid)
        officer_q = officer_q.filter(models.User.station_id == sid)
        case_q = db.query(models.Case).filter(models.Case.station_id == sid)
    else:
        case_q = db.query(models.Case)

    firs = fir_q.all()
    complaints = complaint_q.all()
    officers = officer_q.all()
    cases = case_q.all()

    # Patrol Compliance — count active violations that are unreviewed
    out_of_zone = db.query(models.DutyViolation).filter(
        models.DutyViolation.reviewed == False
    ).join(models.OfficerDuty).filter(models.OfficerDuty.status == "active").count()

    return {
        "total_firs": len(firs),
        "open_firs": sum(1 for f in firs if f.status == "open"),
        "investigating_firs": sum(1 for f in firs if f.status == "investigating"),
        "closed_firs": sum(1 for f in firs if f.status == "closed"),
        "fir_progress": {
            "total": len(firs),
            "open": sum(1 for f in firs if f.status == "open"),
            "investigating": sum(1 for f in firs if f.status == "investigating"),
            "closed": sum(1 for f in firs if f.status == "closed")
        },
        "total_complaints": len(complaints),
        "pending_complaints": sum(1 for c in complaints if c.status == "pending"),
        "resolved_complaints": sum(1 for c in complaints if c.status == "resolved"),
        "total_officers": len(officers),
        "available_officers": sum(1 for o in officers if o.is_available),
        "on_duty_officers": sum(1 for o in officers if not o.is_available),
        "out_of_zone_officers": out_of_zone,
        "custody_records": custody_q.filter(models.Custody.status == "in_custody").count(),
        "open_alerts": db.query(models.Alert).filter(models.Alert.status == "open").count(),
        "active_deployments": db.query(models.Deployment).filter(models.Deployment.status == "active").count(),
        "high_crime_firs": sum(1 for f in firs if f.severity == "high"),
        "pending_cases": sum(1 for f in firs if f.status == "open") + sum(1 for c in complaints if c.status == "pending") + sum(1 for c in cases if c.status != "Case Closed"),
        "strategic_cases": {
            "total": len(cases),
            "high": sum(1 for c in cases if c.priority == "high"),
            "medium": sum(1 for c in cases if c.priority == "medium"),
            "low": sum(1 for c in cases if c.priority == "low"),
            "closed": sum(1 for c in cases if c.status == "Case Closed")
        }
    }

