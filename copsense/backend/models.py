from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime


class Station(Base):
    __tablename__ = "stations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    district = Column(String, nullable=False)
    address = Column(String)
    latitude = Column(Float, default=25.5941)
    longitude = Column(Float, default=85.1376)

    users = relationship("User", back_populates="station")
    feedbacks = relationship("Feedback", back_populates="station")
    firs = relationship("FIR", back_populates="station")
    complaints = relationship("Complaint", back_populates="station")


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)  # ssp | station_officer | field_officer | citizen
    badge_id = Column(String, unique=True, nullable=True)
    rank = Column(String, nullable=True)
    specialization = Column(String, nullable=True)   # traffic | crime | vip | cyber
    photo_url = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="users")
    feedbacks_given = relationship("Feedback", back_populates="citizen", foreign_keys="Feedback.citizen_id")
    duties = relationship("OfficerDuty", back_populates="officer")
    custody_records = relationship("Custody", back_populates="officer")
    assigned_alerts = relationship("Alert", back_populates="assigned_officer")


class OfficerDuty(Base):
    __tablename__ = "officer_duties"
    id = Column(Integer, primary_key=True, index=True)
    officer_id = Column(Integer, ForeignKey("users.id"))
    zone = Column(String, nullable=False)
    zone_lat = Column(Float, nullable=True)
    zone_lng = Column(Float, nullable=True)
    zone_radius_km = Column(Float, default=2.0)
    duty_start = Column(DateTime, nullable=False)
    duty_end = Column(DateTime, nullable=True)
    status = Column(String, default="active")  # active | completed | off
    deployment_id = Column(Integer, ForeignKey("deployments.id"), nullable=True)
    role_in_deployment = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    officer = relationship("User", back_populates="duties")
    violations = relationship("DutyViolation", back_populates="duty")
    deployment = relationship("Deployment", back_populates="duties")


class DutyViolation(Base):
    __tablename__ = "duty_violations"
    id = Column(Integer, primary_key=True, index=True)
    duty_id = Column(Integer, ForeignKey("officer_duties.id"))
    reason = Column(Text, nullable=False)
    current_lat = Column(Float)
    current_lng = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    reviewed = Column(Boolean, default=False)

    duty = relationship("OfficerDuty", back_populates="violations")


class Feedback(Base):
    __tablename__ = "feedbacks"
    id = Column(Integer, primary_key=True, index=True)
    citizen_id = Column(Integer, ForeignKey("users.id"))
    station_id = Column(Integer, ForeignKey("stations.id"))
    officer_ids = Column(JSON, default=list)   # list of officer user ids
    feedback_type = Column(String, default="officer")  # officer | multiple | station
    text = Column(Text, nullable=False)
    sensitivity = Column(String, default="low")   # low | medium | high | critical
    sensitivity_score = Column(Float, default=0.0)
    reviewed_by_higher = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    citizen = relationship("User", back_populates="feedbacks_given", foreign_keys=[citizen_id])
    station = relationship("Station", back_populates="feedbacks")


class FIR(Base):
    __tablename__ = "firs"
    id = Column(Integer, primary_key=True, index=True)
    fir_number = Column(String, unique=True, nullable=False, index=True)
    crime_type = Column(String, nullable=False)
    ipc_section = Column(String, nullable=False)
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    severity = Column(String, default="medium")   # low | medium | high | critical
    priority = Column(Integer, default=1)         # 1: Low, 2: Medium, 3: High, 4: Critical
    officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    status = Column(String, default="open")   # open | investigating | closed
    assignment_date = Column(DateTime, nullable=True)
    evidence_path = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    complainant_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    officer = relationship("User", foreign_keys=[officer_id])
    station = relationship("Station", back_populates="firs")


class Complaint(Base):
    __tablename__ = "complaints"
    id = Column(Integer, primary_key=True, index=True)
    citizen_name = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    complaint_type = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    date = Column(DateTime, nullable=False)
    location = Column(String, nullable=False)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    status = Column(String, default="pending")   # pending | reviewing | resolved
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    station = relationship("Station", back_populates="complaints")
    assigned_officer = relationship("User", foreign_keys=[assigned_officer_id])


class Custody(Base):
    __tablename__ = "custody_records"
    id = Column(Integer, primary_key=True, index=True)
    arrest_id = Column(String, unique=True, nullable=False, index=True)
    accused_name = Column(String, nullable=False)
    arrest_date = Column(DateTime, nullable=False)
    custody_location = Column(String, nullable=False)
    relative_phone = Column(String, nullable=False)
    relative_name = Column(String, nullable=True)
    officer_id = Column(Integer, ForeignKey("users.id"))
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    status = Column(String, default="in_custody")   # in_custody | released | court
    last_video_upload = Column(DateTime, nullable=True)
    alert_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    officer = relationship("User", back_populates="custody_records")
    videos = relationship("CustodyVideo", back_populates="custody")


class CustodyVideo(Base):
    __tablename__ = "custody_videos"
    id = Column(Integer, primary_key=True, index=True)
    custody_id = Column(Integer, ForeignKey("custody_records.id"))
    video_path = Column(String, nullable=True)
    video_note = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    sent_to_relative = Column(Boolean, default=False)
    notification_log = Column(Text, nullable=True)   # mock WhatsApp log

    custody = relationship("Custody", back_populates="videos")


class Deployment(Base):
    __tablename__ = "deployments"
    id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String, nullable=False)
    location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    crowd_size = Column(Integer, nullable=False)
    risk_level = Column(String, nullable=False)   # low | medium | high | critical
    event_duration_hours = Column(Float, nullable=False)
    event_date = Column(DateTime, nullable=True)
    blueprint = Column(JSON, nullable=True)   # AI generated plan
    deployed_officer_ids = Column(JSON, default=list)
    status = Column(String, default="planned")   # planned | active | completed
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    duties = relationship("OfficerDuty", back_populates="deployment")


class Alert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    alert_type = Column(String, nullable=False)   # feedback | duty_violation | custody | case | emergency
    message = Column(Text, nullable=False)
    severity = Column(String, default="medium")   # low | medium | high | critical
    assigned_officer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    case_id = Column(Integer, nullable=True)
    case_type = Column(String, nullable=True)   # fir | complaint | custody
    status = Column(String, default="open")   # open | acknowledged | resolved
    target_roles = Column(JSON, default=list)   # which roles can see it
    created_at = Column(DateTime, default=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)

    assigned_officer = relationship("User", back_populates="assigned_alerts")


class CrimeEvent(Base):
    __tablename__ = "crime_events"
    id = Column(Integer, primary_key=True, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    crime_type = Column(String, nullable=False)
    severity = Column(String, default="medium")   # low | medium | high
    fir_id = Column(Integer, ForeignKey("firs.id"), nullable=True)
    date = Column(DateTime, default=datetime.utcnow)
    district = Column(String, nullable=True)


class Case(Base):
    __tablename__ = "cases"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String, default="low")   # low | medium | high | critical
    status = Column(String, default="Case Opened")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    station = relationship("Station")
    assignments = relationship("CaseAssignment", back_populates="case")
    status_logs = relationship("CaseStatusLog", back_populates="case")


class CaseAssignment(Base):
    __tablename__ = "case_assignments"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    officer_id = Column(Integer, ForeignKey("users.id"))
    assigned_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)

    case = relationship("Case", back_populates="assignments")
    officer = relationship("User")


class CaseStatusLog(Base):
    __tablename__ = "case_status_logs"
    id = Column(Integer, primary_key=True, index=True)
    case_id = Column(Integer, ForeignKey("cases.id"))
    status = Column(String, nullable=False)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    case = relationship("Case", back_populates="status_logs")
