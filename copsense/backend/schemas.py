from pydantic import BaseModel, EmailStr, field_validator, model_validator
from typing import Optional, List, Any
from datetime import datetime
import re


# ─── Auth ────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str  # ssp | station_officer | field_officer | citizen
    badge_id: Optional[str] = None
    rank: Optional[str] = None
    specialization: Optional[str] = None
    station_id: Optional[int] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        allowed = {"ssp", "station_officer", "field_officer", "citizen"}
        if v not in allowed:
            raise ValueError(f"Role must be one of {allowed}")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
    station_id: Optional[int] = None


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    badge_id: Optional[str]
    rank: Optional[str]
    specialization: Optional[str]
    photo_url: Optional[str]
    is_available: bool
    station_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Station ─────────────────────────────────────────────────────────────────

class StationCreate(BaseModel):
    name: str
    district: str
    address: Optional[str] = None
    latitude: Optional[float] = 25.5941
    longitude: Optional[float] = 85.1376


class StationOut(BaseModel):
    id: int
    name: str
    district: str
    address: Optional[str]
    latitude: float
    longitude: float

    class Config:
        from_attributes = True


# ─── Feedback ────────────────────────────────────────────────────────────────

class FeedbackCreate(BaseModel):
    station_id: int
    officer_ids: Optional[List[int]] = []
    feedback_type: str = "officer"  # officer | multiple | station
    text: str

    @field_validator("station_id")
    @classmethod
    def validate_station(cls, v):
        if not v:
            raise ValueError("Station must be selected")
        return v

    @field_validator("text")
    @classmethod
    def validate_text(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("Feedback text must be at least 10 characters")
        if len(v) > 2000:
            raise ValueError("Feedback text cannot exceed 2000 characters")
        return v.strip()

    @model_validator(mode="after")
    def validate_officer_selection(self):
        if self.feedback_type in ("officer", "multiple") and not self.officer_ids:
            raise ValueError("Officer selection is required for this feedback type")
        return self


class FeedbackOut(BaseModel):
    id: int
    citizen_id: int
    station_id: int
    officer_ids: List[int]
    feedback_type: str
    text: str
    sensitivity: str
    sensitivity_score: float
    reviewed_by_higher: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── FIR ─────────────────────────────────────────────────────────────────────

class FIRCreate(BaseModel):
    fir_number: str
    crime_type: str
    ipc_section: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    severity: str = "medium"
    priority: Optional[int] = 1
    officer_id: Optional[int] = None
    station_id: Optional[int] = None
    description: Optional[str] = None
    complainant_name: Optional[str] = None

    @field_validator("fir_number")
    @classmethod
    def validate_fir_number(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError("FIR number is required (min 3 chars)")
        return v.strip().upper()

    @field_validator("crime_type", "ipc_section", "location")
    @classmethod
    def validate_required_strings(cls, v):
        if not v or not v.strip():
            raise ValueError("This field is required")
        return v.strip()

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v not in {"low", "medium", "high", "critical"}:
            raise ValueError("Severity must be low, medium, high, or critical")
        return v


class FIROut(BaseModel):
    id: int
    fir_number: str
    crime_type: str
    ipc_section: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    severity: str
    priority: int
    officer_id: Optional[int]
    station_id: Optional[int]
    status: str
    assignment_date: Optional[datetime]
    officer_name: Optional[str] = None
    officer_rank: Optional[str] = None
    evidence_path: Optional[str]
    description: Optional[str]
    complainant_name: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Complaint ────────────────────────────────────────────────────────────────

class ComplaintCreate(BaseModel):
    citizen_name: str
    phone: str
    complaint_type: str
    description: str
    date: datetime
    location: str
    station_id: Optional[int] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v):
        digits = re.sub(r'\D', '', v)
        if len(digits) < 10:
            raise ValueError("Phone number must be at least 10 digits")
        return v

    @field_validator("citizen_name", "complaint_type", "location")
    @classmethod
    def validate_required_strings(cls, v):
        if not v or not v.strip():
            raise ValueError("This field is required")
        return v.strip()

    @field_validator("description")
    @classmethod
    def validate_description(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("Description must be at least 10 characters")
        return v.strip()


class ComplaintOut(BaseModel):
    id: int
    citizen_name: str
    phone: str
    complaint_type: str
    description: str
    date: datetime
    location: str
    station_id: Optional[int]
    status: str
    assigned_officer_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Duty ─────────────────────────────────────────────────────────────────────

class DutyCreate(BaseModel):
    officer_id: int
    zone: str
    zone_lat: Optional[float] = None
    zone_lng: Optional[float] = None
    zone_radius_km: float = 2.0
    duty_start: datetime
    duty_end: Optional[datetime] = None
    deployment_id: Optional[int] = None
    role_in_deployment: Optional[str] = None


class DutyViolationCreate(BaseModel):
    duty_id: int
    reason: str
    current_lat: float
    current_lng: float

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, v):
        if not v or len(v.strip()) < 10:
            raise ValueError("Reason must be at least 10 characters")
        return v.strip()


class DutyOut(BaseModel):
    id: int
    officer_id: int
    zone: str
    zone_lat: Optional[float]
    zone_lng: Optional[float]
    zone_radius_km: float
    duty_start: datetime
    duty_end: Optional[datetime]
    status: str
    deployment_id: Optional[int]
    role_in_deployment: Optional[str]

    class Config:
        from_attributes = True


# ─── Custody ──────────────────────────────────────────────────────────────────

class CustodyCreate(BaseModel):
    arrest_id: str
    accused_name: str
    arrest_date: datetime
    custody_location: str
    relative_phone: str
    relative_name: Optional[str] = None
    station_id: Optional[int] = None

    @field_validator("arrest_id", "accused_name", "custody_location")
    @classmethod
    def validate_required_strings(cls, v):
        if not v or not v.strip():
            raise ValueError("This field is required")
        return v.strip()

    @field_validator("relative_phone")
    @classmethod
    def validate_relative_phone(cls, v):
        if not v or not v.strip():
            raise ValueError("Relative phone number is required")
        digits = re.sub(r'\D', '', v)
        if len(digits) < 10:
            raise ValueError("Relative phone must be at least 10 digits")
        return v


class CustodyOut(BaseModel):
    id: int
    arrest_id: str
    accused_name: str
    arrest_date: datetime
    custody_location: str
    relative_phone: str
    relative_name: Optional[str]
    officer_id: int
    station_id: Optional[int]
    status: str
    last_video_upload: Optional[datetime]
    alert_sent: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Deployment ───────────────────────────────────────────────────────────────

class DeploymentCreate(BaseModel):
    event_name: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    crowd_size: int
    risk_level: str
    event_duration_hours: float
    event_date: Optional[datetime] = None

    @field_validator("event_name", "location")
    @classmethod
    def validate_required_strings(cls, v):
        if not v or not v.strip():
            raise ValueError("This field is required")
        return v.strip()

    @field_validator("crowd_size")
    @classmethod
    def validate_crowd(cls, v):
        if v < 1:
            raise ValueError("Crowd size must be at least 1")
        return v

    @field_validator("risk_level")
    @classmethod
    def validate_risk(cls, v):
        if v not in {"low", "medium", "high", "critical"}:
            raise ValueError("Risk level must be low, medium, high, or critical")
        return v

    @field_validator("event_duration_hours")
    @classmethod
    def validate_duration(cls, v):
        if v <= 0:
            raise ValueError("Duration must be positive")
        return v


class DeploymentOut(BaseModel):
    id: int
    event_name: str
    location: str
    latitude: Optional[float]
    longitude: Optional[float]
    crowd_size: int
    risk_level: str
    event_duration_hours: float
    event_date: Optional[datetime]
    blueprint: Optional[Any]
    deployed_officer_ids: List[int]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Alerts ───────────────────────────────────────────────────────────────────

class AlertOut(BaseModel):
    id: int
    alert_type: str
    message: str
    severity: str
    assigned_officer_id: Optional[int]
    case_id: Optional[int]
    case_type: Optional[str]
    status: str
    target_roles: List[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Dashboard Stats ──────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_firs: int
    total_complaints: int
    pending_cases: int
    active_officers: int
    available_officers: int
    open_alerts: int
    active_deployments: int
    crime_zones: dict


# ─── Case Management ──────────────────────────────────────────────────────────

class CaseStatusLogOut(BaseModel):
    id: int
    status: str
    notes: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True


class CaseAssignmentOut(BaseModel):
    id: int
    officer_id: int
    officer_name: Optional[str] = None
    officer_rank: Optional[str] = None
    assigned_at: datetime
    is_active: bool
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class CaseCreate(BaseModel):
    title: str
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class CaseUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None


class CaseOut(BaseModel):
    id: int
    title: str
    description: str
    priority: str
    status: str
    latitude: Optional[float]
    longitude: Optional[float]
    station_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    assignments: List[CaseAssignmentOut] = []
    status_logs: List[CaseStatusLogOut] = []

    class Config:
        from_attributes = True
