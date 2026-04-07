from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from database import get_db
from dependencies import get_current_user, require_roles
import models
import schemas
from datetime import datetime
import re

router = APIRouter(prefix="/api/cases", tags=["Cases"])

def classify_priority(description: str) -> str:
    """Automatically classify case priority based on description content."""
    desc = description.lower()
    high_keywords = [
        "woman", "women", "girl", "child", "children", "rape", "molest", "kidnap",
        "emergency", "murder", "homicide", "terror", "riot", "fire", "accident"
    ]
    medium_keywords = ["theft", "robbery", "burglary", "assault", "fight", "fraud", "scam"]
    
    for kw in high_keywords:
        if kw in desc:
            return "high"
    for kw in medium_keywords:
        if kw in desc:
            return "medium"
    return "low"

def get_smart_assignment(db: Session, priority: str, station_id: int, lat: float = None, lng: float = None):
    """Find the best available officer based on rank, availability, and workload."""
    rank_map = {
        "high": ["Inspector", "DSP", "ACP", "SSP"],
        "medium": ["SI"],
        "low": ["ASI", "Constable"]
    }
    
    target_ranks = rank_map.get(priority, ["Constable"])
    
    # Query available officers in the same station with the required rank
    candidates = db.query(models.User).filter(
        models.User.is_available == True,
        models.User.station_id == station_id,
        models.User.rank.in_(target_ranks)
    ).all()
    
    if not candidates:
        # Fallback to field_officer role if no specific rank found
        candidates = db.query(models.User).filter(
            models.User.is_available == True,
            models.User.station_id == station_id,
            models.User.role == "field_officer"
        ).all()

    if not candidates:
        return None

    # Calculate workload for each candidate
    # Workload = count of active assignments
    best_candidate = None
    min_workload = float('inf')
    
    for c in candidates:
        workload = db.query(models.CaseAssignment).filter(
            models.CaseAssignment.officer_id == c.id,
            models.CaseAssignment.is_active == True
        ).count()
        
        if workload < min_workload:
            min_workload = workload
            best_candidate = c
            
    return best_candidate

@router.post("", response_model=schemas.CaseOut)
def create_case(
    payload: schemas.CaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    # Determine Station (default to current user's station)
    station_id = current_user.station_id
    
    # 1. Auto-classification
    priority = classify_priority(payload.description)
    
    # 2. Smart Assignment
    assigned_officer = get_smart_assignment(db, priority, station_id, payload.latitude, payload.longitude)
    
    # 3. Create Case
    new_case = models.Case(
        title=payload.title,
        description=payload.description,
        priority=priority,
        latitude=payload.latitude,
        longitude=payload.longitude,
        station_id=station_id,
        status="Case Opened"
    )
    db.add(new_case)
    db.commit()
    db.refresh(new_case)
    
    # 4. Create Initial Log
    status_log = models.CaseStatusLog(
        case_id=new_case.id,
        status="Case Opened",
        notes="Case registered in the system."
    )
    db.add(status_log)
    
    # 5. Handle Assignment
    if assigned_officer:
        assignment = models.CaseAssignment(
            case_id=new_case.id,
            officer_id=assigned_officer.id,
            notes=f"Auto-assigned based on {priority} priority and workload."
        )
        db.add(assignment)
        
        assigned_log = models.CaseStatusLog(
            case_id=new_case.id,
            status="Assigned",
            notes=f"Case assigned to {assigned_officer.rank} {assigned_officer.name}."
        )
        db.add(assigned_log)
        new_case.status = "Assigned"
        
        # Create Alert for High Priority
        if priority == "high":
            alert = models.Alert(
                alert_type="case",
                message=f"🚨 HIGH PRIORITY CASE: {new_case.title}. Assigned to {assigned_officer.name}.",
                severity="critical",
                case_id=new_case.id,
                case_type="case",
                target_roles=["ssp", "station_officer"]
            )
            db.add(alert)
    
    db.commit()
    db.refresh(new_case)
    return new_case

@router.get("", response_model=list[schemas.CaseOut])
def list_cases(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Case)
    
    # Role-based filtering
    if current_user.role == "citizen":
        # Citizens can only see cases they (eventually) register or search by ID
        # For now, return empty or specific list. Let's return empty if no filter.
        return []
    elif current_user.role in ("station_officer", "field_officer"):
        query = query.filter(models.Case.station_id == current_user.station_id)
        
    cases = query.order_by(models.Case.created_at.desc()).all()
    
    # Enrich with officer info for assignments
    for c in cases:
        for a in c.assignments:
            officer = db.query(models.User).filter(models.User.id == a.officer_id).first()
            if officer:
                a.officer_name = officer.name
                a.officer_rank = officer.rank
                
    return cases

@router.get("/{case_id}", response_model=schemas.CaseOut)
def get_case(
    case_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    for a in case.assignments:
        officer = db.query(models.User).filter(models.User.id == a.officer_id).first()
        if officer:
            a.officer_name = officer.name
            a.officer_rank = officer.rank
            
    return case

@router.patch("/{case_id}/status")
def update_case_status(
    case_id: int,
    status: str,
    notes: str = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer", "field_officer"))
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    allowed_statuses = [
        "Case Opened", "Assigned", "Under Investigation", 
        "Evidence Collection", "Suspect Identified", "Case Closed"
    ]
    if status not in allowed_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {allowed_statuses}")
        
    case.status = status
    case.updated_at = datetime.utcnow()
    
    log = models.CaseStatusLog(
        case_id=case.id,
        status=status,
        notes=notes or f"Status updated to {status} by {current_user.name}."
    )
    db.add(log)
    db.commit()
    return {"message": "Status updated successfully", "new_status": status}

@router.patch("/{case_id}/priority")
def override_priority(
    case_id: int,
    priority: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
        
    if priority not in ("low", "medium", "high", "critical"):
        raise HTTPException(status_code=400, detail="Invalid priority level")
        
    case.priority = priority
    db.commit()
    return {"message": "Priority updated", "new_priority": priority}

@router.patch("/{case_id}/assign")
def manually_assign_officer(
    case_id: int,
    officer_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    case = db.query(models.Case).filter(models.Case.id == case_id).first()
    officer = db.query(models.User).filter(models.User.id == officer_id).first()
    
    if not case or not officer:
        raise HTTPException(status_code=404, detail="Case or Officer not found")
        
    # Deactivate old assignments
    db.query(models.CaseAssignment).filter(
        models.CaseAssignment.case_id == case_id,
        models.CaseAssignment.is_active == True
    ).update({"is_active": False})
    
    # New assignment
    assignment = models.CaseAssignment(
        case_id=case.id,
        officer_id=officer.id,
        notes=f"Manually assigned by {current_user.name}."
    )
    db.add(assignment)
    
    case.status = "Assigned"
    log = models.CaseStatusLog(
        case_id=case.id,
        status="Assigned",
        notes=f"Case manually reassigned to {officer.rank} {officer.name}."
    )
    db.add(log)
    
    db.commit()
    return {"message": f"Case assigned to {officer.name}"}
