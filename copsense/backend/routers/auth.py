from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from auth import hash_password, verify_password, create_access_token, blacklist_token
from dependencies import get_current_user
import models
import schemas

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=schemas.TokenResponse)
def register(payload: schemas.UserRegister, db: Session = Depends(get_db)):
    # Check email uniqueness
    if db.query(models.User).filter(models.User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check badge uniqueness for officers
    if payload.badge_id:
        if db.query(models.User).filter(models.User.badge_id == payload.badge_id).first():
            raise HTTPException(status_code=400, detail="Badge ID already in use")

    # Validate station for non-citizen roles
    if payload.role in ("station_officer", "field_officer") and not payload.station_id:
        raise HTTPException(status_code=400, detail="Station ID required for officers")

    user = models.User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
        badge_id=payload.badge_id,
        rank=payload.rank,
        specialization=payload.specialization,
        station_id=payload.station_id,
        photo_url=f"https://ui-avatars.com/api/?name={payload.name.replace(' ', '+')}&background=1a2744&color=fff&size=128"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        name=user.name,
        station_id=user.station_id
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "role": user.role})
    return schemas.TokenResponse(
        access_token=token,
        role=user.role,
        user_id=user.id,
        name=user.name,
        station_id=user.station_id
    )


@router.post("/logout")
def logout(
    current_user: models.User = Depends(get_current_user),
    # We need the raw bearer token to blacklist
):
    # Token blacklisting happens client-side by deleting from localStorage
    # Server-side we just confirm
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
