from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
from ai.nlp_feedback import classify_sensitivity, should_notify_higher_officer
import models
import schemas
from datetime import datetime

router = APIRouter(prefix="/api", tags=["Feedback & Stations"])


# ─── Stations ─────────────────────────────────────────────────────────────────

@router.get("/stations", response_model=list[schemas.StationOut])
def list_stations(db: Session = Depends(get_db), _=Depends(get_current_user)):
    return db.query(models.Station).all()


@router.post("/stations", response_model=schemas.StationOut)
def create_station(
    payload: schemas.StationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp"))
):
    if db.query(models.Station).filter(models.Station.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Station with this name already exists")
    station = models.Station(**payload.model_dump())
    db.add(station)
    db.commit()
    db.refresh(station)
    return station


@router.get("/stations/{station_id}/officers")
def get_station_officers(
    station_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user)
):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    officers = db.query(models.User).filter(
        models.User.station_id == station_id,
        models.User.role.in_(["station_officer", "field_officer"])
    ).all()

    return [
        {
            "id": o.id,
            "name": o.name,
            "badge_id": o.badge_id,
            "rank": o.rank,
            "specialization": o.specialization,
            "photo_url": o.photo_url,
            "is_available": o.is_available
        }
        for o in officers
    ]


# ─── Feedback ─────────────────────────────────────────────────────────────────

@router.post("/feedback", response_model=schemas.FeedbackOut)
def submit_feedback(
    payload: schemas.FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("citizen"))
):
    # Validate station exists
    station = db.query(models.Station).filter(models.Station.id == payload.station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    # Duplicate prevention — citizen cannot submit >1 feedback per station per day
    from datetime import date
    today_start = datetime.combine(date.today(), datetime.min.time())
    existing = db.query(models.Feedback).filter(
        models.Feedback.citizen_id == current_user.id,
        models.Feedback.station_id == payload.station_id,
        models.Feedback.created_at >= today_start
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="You have already submitted feedback for this station today. Please try again tomorrow."
        )

    # NLP classification
    nlp_result = classify_sensitivity(payload.text)

    feedback = models.Feedback(
        citizen_id=current_user.id,
        station_id=payload.station_id,
        officer_ids=payload.officer_ids or [],
        feedback_type=payload.feedback_type,
        text=payload.text,
        sensitivity=nlp_result["sensitivity"],
        sensitivity_score=nlp_result["score"]
    )
    db.add(feedback)

    # Create alert if high/critical
    if should_notify_higher_officer(nlp_result["sensitivity"]):
        alert = models.Alert(
            alert_type="feedback",
            message=f"⚠️ {nlp_result['sensitivity'].upper()} sensitivity feedback received at {station.name}. Keywords: {', '.join(nlp_result['keywords_found'])}",
            severity=nlp_result["sensitivity"],
            case_type="feedback",
            target_roles=["ssp"] if nlp_result["sensitivity"] == "critical" else ["ssp", "station_officer"]
        )
        db.add(alert)

    db.commit()
    db.refresh(feedback)
    return feedback


@router.get("/feedback", response_model=list[schemas.FeedbackOut])
def get_feedback(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Feedback)

    if current_user.role == "citizen":
        # Citizens only see their own
        query = query.filter(models.Feedback.citizen_id == current_user.id)
    elif current_user.role == "station_officer":
        # Station officer sees their station's feedback
        query = query.filter(models.Feedback.station_id == current_user.station_id)
    elif current_user.role == "field_officer":
        raise HTTPException(status_code=403, detail="Field officers cannot view feedback")
    # SSP sees all

    return query.order_by(models.Feedback.created_at.desc()).all()


@router.get("/feedback/stats")
def feedback_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    query = db.query(models.Feedback)
    if current_user.role == "station_officer":
        query = query.filter(models.Feedback.station_id == current_user.station_id)

    all_fb = query.all()
    return {
        "total": len(all_fb),
        "low": sum(1 for f in all_fb if f.sensitivity == "low"),
        "medium": sum(1 for f in all_fb if f.sensitivity == "medium"),
        "high": sum(1 for f in all_fb if f.sensitivity == "high"),
        "critical": sum(1 for f in all_fb if f.sensitivity == "critical"),
    }
