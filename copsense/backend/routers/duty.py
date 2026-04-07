from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
import models
import schemas
from geopy.distance import geodesic
from datetime import datetime

router = APIRouter(prefix="/api/duty", tags=["Officer Duty"])


@router.post("", response_model=schemas.DutyOut)
def create_duty(
    payload: schemas.DutyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    officer = db.query(models.User).filter(models.User.id == payload.officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    # Check for conflicting active duty
    conflict = db.query(models.OfficerDuty).filter(
        models.OfficerDuty.officer_id == payload.officer_id,
        models.OfficerDuty.status == "active"
    ).first()
    if conflict:
        raise HTTPException(status_code=400, detail="Officer already has an active duty assignment")

    duty = models.OfficerDuty(**payload.model_dump())
    db.add(duty)
    officer.is_available = False
    db.commit()
    db.refresh(duty)
    return duty


@router.get("", response_model=list[schemas.DutyOut])
def list_duties(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.OfficerDuty)
    if current_user.role == "field_officer":
        query = query.filter(models.OfficerDuty.officer_id == current_user.id)
    elif current_user.role == "station_officer":
        # All officers in this station
        officer_ids = [
            u.id for u in db.query(models.User).filter(
                models.User.station_id == current_user.station_id
            ).all()
        ]
        query = query.filter(models.OfficerDuty.officer_id.in_(officer_ids))
    return query.order_by(models.OfficerDuty.created_at.desc()).all()


@router.get("/active")
def get_active_duties(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """Get all active duties with officer info for deployment map."""
    query = db.query(models.OfficerDuty).filter(models.OfficerDuty.status == "active")
    if current_user.role == "station_officer":
        officer_ids = [
            u.id for u in db.query(models.User).filter(
                models.User.station_id == current_user.station_id
            ).all()
        ]
        query = query.filter(models.OfficerDuty.officer_id.in_(officer_ids))

    duties = query.all()
    result = []
    for d in duties:
        officer = db.query(models.User).filter(models.User.id == d.officer_id).first()
        result.append({
            "duty_id": d.id,
            "officer_id": d.officer_id,
            "officer_name": officer.name if officer else "Unknown",
            "badge_id": officer.badge_id if officer else "",
            "rank": officer.rank if officer else "",
            "zone": d.zone,
            "zone_lat": d.zone_lat,
            "zone_lng": d.zone_lng,
            "zone_radius_km": d.zone_radius_km,
            "duty_start": d.duty_start,
            "duty_end": d.duty_end,
            "status": d.status,
            "deployment_id": d.deployment_id,
            "role": d.role_in_deployment or "Patrol"
        })
    return result


@router.post("/report-violation")
def report_violation(
    payload: schemas.DutyViolationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    duty = db.query(models.OfficerDuty).filter(models.OfficerDuty.id == payload.duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Duty not found")

    # Verify this duty belongs to the current field officer (or officer/SSP can do it for others)
    if current_user.role == "field_officer" and duty.officer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only report violations for your own duty")

    # Verify actually out of zone if zone coords exist
    if duty.zone_lat and duty.zone_lng:
        dist = geodesic(
            (duty.zone_lat, duty.zone_lng),
            (payload.current_lat, payload.current_lng)
        ).km
        if dist <= duty.zone_radius_km:
            raise HTTPException(status_code=400, detail="Officer is still within the assigned zone")

    violation = models.DutyViolation(
        duty_id=payload.duty_id,
        reason=payload.reason,
        current_lat=payload.current_lat,
        current_lng=payload.current_lng
    )
    db.add(violation)

    # Create alert for station officer / SSP
    officer = db.query(models.User).filter(models.User.id == duty.officer_id).first()
    alert = models.Alert(
        alert_type="duty_violation",
        message=f"⚠️ OUT OF ZONE ALERT: Officer {officer.name if officer else duty.officer_id} left assigned zone '{duty.zone}'. Reason: {payload.reason[:80]}",
        severity="high",
        case_type="duty",
        case_id=duty.id,
        target_roles=["ssp", "station_officer"]
    )
    db.add(alert)

    db.commit()
    return {"message": "Violation reported and alert sent to station officer"}


@router.put("/{duty_id}/complete")
def complete_duty(
    duty_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    duty = db.query(models.OfficerDuty).filter(models.OfficerDuty.id == duty_id).first()
    if not duty:
        raise HTTPException(status_code=404, detail="Duty not found")

    duty.status = "completed"
    duty.duty_end = datetime.utcnow()

    # Mark officer available again
    officer = db.query(models.User).filter(models.User.id == duty.officer_id).first()
    if officer:
        officer.is_available = True

    db.commit()
    return {"message": "Duty marked as completed"}


@router.get("/violations")
def get_violations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    violations = db.query(models.DutyViolation).all()
    result = []
    for v in violations:
        duty = db.query(models.OfficerDuty).filter(models.OfficerDuty.id == v.duty_id).first()
        officer = db.query(models.User).filter(models.User.id == duty.officer_id).first() if duty else None
        result.append({
            "id": v.id,
            "duty_id": v.duty_id,
            "officer_name": officer.name if officer else "Unknown",
            "zone": duty.zone if duty else "Unknown",
            "reason": v.reason,
            "lat": v.current_lat,
            "lng": v.current_lng,
            "timestamp": v.timestamp,
            "reviewed": v.reviewed
        })
    return result
