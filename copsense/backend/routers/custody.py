from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
import models
import schemas
import os
import uuid
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/custody", tags=["Custody Safety"])
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "custody_videos")
os.makedirs(UPLOAD_DIR, exist_ok=True)

VIDEO_UPLOAD_INTERVAL_HOURS = 4


@router.post("", response_model=schemas.CustodyOut)
def add_custody(
    payload: schemas.CustodyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    # Check duplicate arrest ID
    if db.query(models.Custody).filter(models.Custody.arrest_id == payload.arrest_id).first():
        raise HTTPException(status_code=400, detail=f"Arrest ID '{payload.arrest_id}' already exists")

    custody = models.Custody(
        **payload.model_dump(),
        officer_id=current_user.id,
        station_id=payload.station_id or current_user.station_id
    )
    db.add(custody)
    db.commit()
    db.refresh(custody)
    return custody


@router.get("", response_model=list[schemas.CustodyOut])
def list_custody(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    query = db.query(models.Custody)
    if current_user.role == "field_officer":
        query = query.filter(models.Custody.officer_id == current_user.id)
    elif current_user.role == "station_officer":
        query = query.filter(models.Custody.station_id == current_user.station_id)
    return query.order_by(models.Custody.created_at.desc()).all()


@router.get("/{custody_id}")
def get_custody_detail(
    custody_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    custody = db.query(models.Custody).filter(models.Custody.id == custody_id).first()
    if not custody:
        raise HTTPException(status_code=404, detail="Custody record not found")
    return custody


@router.post("/{custody_id}/video")
async def upload_custody_video(
    custody_id: int,
    background_tasks: BackgroundTasks,
    note: str = "",
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    custody = db.query(models.Custody).filter(models.Custody.id == custody_id).first()
    if not custody:
        raise HTTPException(status_code=404, detail="Custody record not found")

    # Save video file
    ext = os.path.splitext(file.filename or ".mp4")[1] or ".mp4"
    filename = f"custody_{custody_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    # Mock WhatsApp notification log
    wa_log = (
        f"[MOCK WHATSAPP] TO: {custody.relative_phone} | "
        f"Custody update for {custody.accused_name} at {custody.custody_location}. "
        f"Video recorded at {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}. "
        f"Your relative is safe and in lawful custody."
    )
    print(wa_log)  # Console log for demo

    video = models.CustodyVideo(
        custody_id=custody_id,
        video_path=f"/uploads/custody_videos/{filename}",
        video_note=note,
        sent_to_relative=True,
        notification_log=wa_log
    )
    db.add(video)

    # Update last video upload time & reset alert
    custody.last_video_upload = datetime.utcnow()
    custody.alert_sent = False
    db.commit()

    return {
        "message": "Video uploaded successfully",
        "video_path": video.video_path,
        "whatsapp_notification": wa_log,
        "next_upload_due": datetime.utcnow() + timedelta(hours=VIDEO_UPLOAD_INTERVAL_HOURS)
    }


@router.get("/{custody_id}/videos")
def get_custody_videos(
    custody_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    videos = db.query(models.CustodyVideo).filter(
        models.CustodyVideo.custody_id == custody_id
    ).order_by(models.CustodyVideo.uploaded_at.desc()).all()
    return videos


@router.get("/check-overdue")
def check_overdue_custody(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """Check all active custody records for overdue video uploads."""
    threshold = datetime.utcnow() - timedelta(hours=VIDEO_UPLOAD_INTERVAL_HOURS)
    active = db.query(models.Custody).filter(models.Custody.status == "in_custody").all()

    overdue = []
    for c in active:
        is_overdue = (
            c.last_video_upload is None or
            c.last_video_upload < threshold
        )
        if is_overdue:
            overdue.append({
                "custody_id": c.id,
                "arrest_id": c.arrest_id,
                "accused_name": c.accused_name,
                "last_upload": c.last_video_upload,
                "hours_overdue": round(
                    (datetime.utcnow() - (c.last_video_upload or c.created_at)).total_seconds() / 3600, 1
                )
            })
    return {"overdue_count": len(overdue), "overdue_records": overdue}


@router.put("/{custody_id}/status")
def update_custody_status(
    custody_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    if status not in ("in_custody", "released", "court"):
        raise HTTPException(status_code=400, detail="Invalid status")
    custody = db.query(models.Custody).filter(models.Custody.id == custody_id).first()
    if not custody:
        raise HTTPException(status_code=404, detail="Custody record not found")
    custody.status = status
    db.commit()
    return {"message": "Custody status updated"}
