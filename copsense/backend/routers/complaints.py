from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
import models
import schemas
from datetime import datetime

router = APIRouter(prefix="/api/complaints", tags=["Complaints"])


@router.post("", response_model=schemas.ComplaintOut)
def create_complaint(
    payload: schemas.ComplaintCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    complaint = models.Complaint(
        **payload.model_dump(),
        station_id=payload.station_id or current_user.station_id
    )
    db.add(complaint)
    db.commit()
    db.refresh(complaint)
    return complaint


@router.get("", response_model=list[schemas.ComplaintOut])
def list_complaints(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    query = db.query(models.Complaint)
    if current_user.role == "station_officer":
        query = query.filter(models.Complaint.station_id == current_user.station_id)
    return query.order_by(models.Complaint.created_at.desc()).all()


@router.put("/{complaint_id}/assign")
def assign_complaint(
    complaint_id: int,
    officer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")

    officer = db.query(models.User).filter(models.User.id == officer_id).first()
    if not officer:
        raise HTTPException(status_code=404, detail="Officer not found")

    complaint.assigned_officer_id = officer_id
    complaint.status = "reviewing"
    db.commit()
    return {"message": "Complaint assigned", "officer": officer.name}


@router.put("/{complaint_id}/status")
def update_status(
    complaint_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    if status not in ("pending", "reviewing", "resolved"):
        raise HTTPException(status_code=400, detail="Invalid status")
    complaint = db.query(models.Complaint).filter(models.Complaint.id == complaint_id).first()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    complaint.status = status
    db.commit()
    return {"message": "Status updated"}
