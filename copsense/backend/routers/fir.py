from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
import models
import schemas
import os
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/fir", tags=["FIR"])
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", "fir_evidence")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("", response_model=schemas.FIROut)
def create_fir(
    payload: schemas.FIRCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    # Duplicate FIR number prevention
    if db.query(models.FIR).filter(models.FIR.fir_number == payload.fir_number).first():
        raise HTTPException(status_code=400, detail=f"FIR number '{payload.fir_number}' already exists")

    # Priority calculation
    prio_map = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    priority = prio_map.get(payload.severity, 2)

    # Auto-assignment logic
    officer_id = payload.officer_id
    assignment_date = None
    
    if not officer_id:
        # Find best candidate
        target_roles = ["ssp", "station_officer"] if payload.severity in ("high", "critical") else ["field_officer"]
        candidate = db.query(models.User).filter(
            models.User.role.in_(target_roles),
            models.User.is_available == True,
            models.User.station_id == (payload.station_id or current_user.station_id)
        ).first()
        
        if candidate:
            officer_id = candidate.id
            assignment_date = datetime.utcnow()

    fir = models.FIR(
        **payload.model_dump(),
        priority=priority,
        officer_id=officer_id,
        assignment_date=assignment_date,
        station_id=payload.station_id or current_user.station_id
    )
    db.add(fir)

    # Add crime event for heatmap
    if payload.latitude and payload.longitude:
        crime_event = models.CrimeEvent(
            latitude=payload.latitude,
            longitude=payload.longitude,
            crime_type=payload.crime_type,
            severity=payload.severity,
            fir_id=None
        )
        db.add(crime_event)

    # Create alert for high/critical severity FIRs
    if payload.severity in ("high", "critical"):
        alert = models.Alert(
            alert_type="case",
            message=f"🚨 {payload.severity.upper()} priority FIR {payload.fir_number} filed: {payload.crime_type}. Assigned to {candidate.name if candidate else 'Admin'}",
            severity=payload.severity,
            case_type="fir",
            target_roles=["ssp", "station_officer"]
        )
        db.add(alert)

    db.commit()
    db.refresh(fir)
    return fir


@router.get("", response_model=list[schemas.FIROut])
def list_firs(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    query = db.query(models.FIR, models.User.name.label("officer_name"), models.User.rank.label("officer_rank")) \
        .outerjoin(models.User, models.FIR.officer_id == models.User.id)
    
    if current_user.role in ("station_officer", "field_officer"):
        query = query.filter(models.FIR.station_id == current_user.station_id)
        
    results = query.order_by(models.FIR.priority.desc(), models.FIR.created_at.desc()).all()
    
    # Flatten results for Pydantic
    firs = []
    for f, name, rank in results:
        f_dict = f.__dict__.copy()
        f_dict["officer_name"] = name
        f_dict["officer_rank"] = rank
        firs.append(f_dict)
    return firs


@router.get("/{fir_id}", response_model=schemas.FIROut)
def get_fir(
    fir_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    result = db.query(models.FIR, models.User.name.label("officer_name"), models.User.rank.label("officer_rank")) \
        .outerjoin(models.User, models.FIR.officer_id == models.User.id) \
        .filter(models.FIR.id == fir_id).first()
        
    if not result:
        raise HTTPException(status_code=404, detail="FIR not found")
        
    f, name, rank = result
    f_dict = f.__dict__.copy()
    f_dict["officer_name"] = name
    f_dict["officer_rank"] = rank
    return f_dict


@router.put("/{fir_id}/status")
def update_fir_status(
    fir_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    if status not in ("open", "investigating", "closed"):
        raise HTTPException(status_code=400, detail="Status must be open, investigating, or closed")
    fir = db.query(models.FIR).filter(models.FIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")
    fir.status = status
    fir.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "FIR status updated", "status": status}


@router.post("/{fir_id}/evidence")
async def upload_evidence(
    fir_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    fir = db.query(models.FIR).filter(models.FIR.id == fir_id).first()
    if not fir:
        raise HTTPException(status_code=404, detail="FIR not found")

    ext = os.path.splitext(file.filename)[1]
    filename = f"{fir_id}_{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)

    fir.evidence_path = f"/uploads/fir_evidence/{filename}"
    db.commit()
    return {"message": "Evidence uploaded", "path": fir.evidence_path}
