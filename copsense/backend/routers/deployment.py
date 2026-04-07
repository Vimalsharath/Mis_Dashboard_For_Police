from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
from ai.crowd_planner import generate_blueprint
import models
import schemas
from datetime import datetime

router = APIRouter(prefix="/api/deployment", tags=["Deployment"])


@router.post("/plan")
def generate_deployment_plan(
    payload: schemas.DeploymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """AI generates full deployment blueprint — does NOT save to DB yet."""
    blueprint = generate_blueprint(
        event_name=payload.event_name,
        location=payload.location,
        crowd_size=payload.crowd_size,
        risk_level=payload.risk_level,
        duration_hours=payload.event_duration_hours,
        latitude=payload.latitude,
        longitude=payload.longitude
    )
    return {"blueprint": blueprint, "inputs": payload.model_dump()}


@router.post("", response_model=schemas.DeploymentOut)
def create_deployment(
    payload: schemas.DeploymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """Save deployment + auto-generate blueprint + create duty assignments."""
    blueprint = generate_blueprint(
        event_name=payload.event_name,
        location=payload.location,
        crowd_size=payload.crowd_size,
        risk_level=payload.risk_level,
        duration_hours=payload.event_duration_hours,
        latitude=payload.latitude,
        longitude=payload.longitude
    )

    deployment = models.Deployment(
        **payload.model_dump(),
        blueprint=blueprint,
        created_by=current_user.id
    )
    db.add(deployment)
    db.commit()
    db.refresh(deployment)
    return deployment


@router.post("/{deployment_id}/assign-officers")
def assign_officers_to_deployment(
    deployment_id: int,
    officer_ids: list[int],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")

    blueprint = deployment.blueprint or {}
    role_assignments = blueprint.get("role_assignments", {})
    role_keys = list(role_assignments.keys())
    duty_start = deployment.event_date or datetime.utcnow()

    created_duties = []
    for idx, officer_id in enumerate(officer_ids):
        officer = db.query(models.User).filter(models.User.id == officer_id).first()
        if not officer:
            continue

        role = role_keys[idx % len(role_keys)] if role_keys else "Patrol"

        duty = models.OfficerDuty(
            officer_id=officer_id,
            zone=deployment.location,
            zone_lat=deployment.latitude,
            zone_lng=deployment.longitude,
            duty_start=duty_start,
            status="active",
            deployment_id=deployment_id,
            role_in_deployment=role
        )
        db.add(duty)
        officer.is_available = False
        created_duties.append({"officer_id": officer_id, "role": role})

    deployment.deployed_officer_ids = officer_ids
    deployment.status = "active"
    db.commit()

    return {
        "message": f"{len(created_duties)} officers deployed",
        "duties": created_duties
    }


@router.get("", response_model=list[schemas.DeploymentOut])
def list_deployments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    return db.query(models.Deployment).order_by(models.Deployment.created_at.desc()).all()


@router.get("/{deployment_id}")
def get_deployment(
    deployment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    deployment = db.query(models.Deployment).filter(models.Deployment.id == deployment_id).first()
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return deployment
