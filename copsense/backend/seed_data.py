# -*- coding: utf-8 -*-
"""
Seed script -- populates demo data: stations, users (all 4 roles),
FIRs, complaints, crime events, custody, duties, and alerts.
Run: python seed_data.py
"""
import sys
import os

# Force UTF-8 output on Windows to avoid CP1252 encoding errors
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine
import models
from auth import hash_password
from datetime import datetime, timedelta
import random

models.Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("[*] Seeding CopSense database...")

# ---- Stations ----------------------------------------------------------------
stations_data = [
    {"name": "Patna City Police Station",   "district": "Patna", "address": "Patna City, Bihar",       "latitude": 25.5941, "longitude": 85.1376},
    {"name": "Bankipur Police Station",      "district": "Patna", "address": "Bankipur, Patna",          "latitude": 25.6117, "longitude": 85.1450},
    {"name": "Gandhi Maidan Police Station", "district": "Patna", "address": "Gandhi Maidan, Patna",     "latitude": 25.6135, "longitude": 85.1308},
    {"name": "Kotwali Police Station",       "district": "Patna", "address": "Kotwali, Patna",           "latitude": 25.6049, "longitude": 85.1243},
]

stations = []
for s in stations_data:
    existing = db.query(models.Station).filter(models.Station.name == s["name"]).first()
    if not existing:
        station = models.Station(**s)
        db.add(station)
        db.flush()
        stations.append(station)
    else:
        stations.append(existing)
db.commit()
print(f"  [OK] {len(stations)} stations ready")

# ---- Users -------------------------------------------------------------------
users_data = [
    # District Head (SSP)
    {
        "name": "SSP Rajesh Kumar", "email": "ssp@copsense.in",
        "password": "Admin@123", "role": "ssp",
        "badge_id": "SSP-001", "rank": "Senior Superintendent of Police",
        "specialization": "crime", "station_id": None
    },
    # Station Officers
    {
        "name": "Inspector Priya Singh", "email": "inspector1@copsense.in",
        "password": "Admin@123", "role": "station_officer",
        "badge_id": "INS-101", "rank": "Inspector",
        "specialization": "crime", "station_id": stations[0].id
    },
    {
        "name": "Inspector Amit Verma", "email": "inspector2@copsense.in",
        "password": "Admin@123", "role": "station_officer",
        "badge_id": "INS-102", "rank": "Inspector",
        "specialization": "traffic", "station_id": stations[1].id
    },
    # Field Officers
    {
        "name": "Constable Ravi Sharma", "email": "officer1@copsense.in",
        "password": "Admin@123", "role": "field_officer",
        "badge_id": "FO-201", "rank": "Sub-Inspector",
        "specialization": "traffic", "station_id": stations[0].id
    },
    {
        "name": "Constable Sunita Devi", "email": "officer2@copsense.in",
        "password": "Admin@123", "role": "field_officer",
        "badge_id": "FO-202", "rank": "Constable",
        "specialization": "crime", "station_id": stations[0].id
    },
    {
        "name": "Constable Mohan Lal", "email": "officer3@copsense.in",
        "password": "Admin@123", "role": "field_officer",
        "badge_id": "FO-203", "rank": "Constable",
        "specialization": "cyber", "station_id": stations[1].id
    },
    {
        "name": "SI Deepak Yadav", "email": "officer4@copsense.in",
        "password": "Admin@123", "role": "field_officer",
        "badge_id": "FO-204", "rank": "Sub-Inspector",
        "specialization": "vip", "station_id": stations[2].id
    },
    # Citizens
    {
        "name": "Ramesh Gupta", "email": "citizen1@copsense.in",
        "password": "User@123", "role": "citizen",
        "badge_id": None, "rank": None, "specialization": None, "station_id": None
    },
    {
        "name": "Savita Mishra", "email": "citizen2@copsense.in",
        "password": "User@123", "role": "citizen",
        "badge_id": None, "rank": None, "specialization": None, "station_id": None
    },
]

created_users = []
for u in users_data:
    existing = db.query(models.User).filter(models.User.email == u["email"]).first()
    if not existing:
        name = u["name"]
        user = models.User(
            name=name,
            email=u["email"],
            password_hash=hash_password(u["password"]),
            role=u["role"],
            badge_id=u.get("badge_id"),
            rank=u.get("rank"),
            specialization=u.get("specialization"),
            station_id=u.get("station_id"),
            photo_url=f"https://ui-avatars.com/api/?name={name.replace(' ', '+')}&background=1a2744&color=fff&size=128"
        )
        db.add(user)
        db.flush()
        created_users.append(user)
    else:
        created_users.append(existing)
db.commit()
print(f"  [OK] {len(created_users)} users ready")

# ---- FIRs --------------------------------------------------------------------
fir_data = [
    {"fir_number": "FIR-2024-001", "crime_type": "Theft",            "ipc_section": "IPC 379",     "location": "Patna City Market",  "latitude": 25.5980, "longitude": 85.1400, "severity": "medium", "status": "investigating"},
    {"fir_number": "FIR-2024-002", "crime_type": "Assault",          "ipc_section": "IPC 323",     "location": "Gandhi Maidan",       "latitude": 25.6135, "longitude": 85.1308, "severity": "high",   "status": "open"},
    {"fir_number": "FIR-2024-003", "crime_type": "Robbery",          "ipc_section": "IPC 392",     "location": "Bankipur Area",       "latitude": 25.6117, "longitude": 85.1450, "severity": "high",   "status": "open"},
    {"fir_number": "FIR-2024-004", "crime_type": "Cyber Fraud",      "ipc_section": "IT Act 66C",  "location": "Online",              "latitude": 25.6050, "longitude": 85.1350, "severity": "medium", "status": "investigating"},
    {"fir_number": "FIR-2024-005", "crime_type": "Traffic Violation","ipc_section": "MV Act 183",  "location": "Bailey Road",         "latitude": 25.6200, "longitude": 85.1500, "severity": "low",    "status": "closed"},
]

field_officers = [u for u in created_users if u.role == "field_officer"]
for i, f in enumerate(fir_data):
    if not db.query(models.FIR).filter(models.FIR.fir_number == f["fir_number"]).first():
        fir = models.FIR(
            **f,
            station_id=stations[i % len(stations)].id,
            officer_id=field_officers[i % len(field_officers)].id if field_officers else None,
            description=f"FIR filed at {f['location']}. Investigating officers assigned.",
            complainant_name=f"Citizen {i+1}",
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30))
        )
        db.add(fir)
        crime = models.CrimeEvent(
            latitude=f["latitude"],
            longitude=f["longitude"],
            crime_type=f["crime_type"],
            severity=f["severity"],
            district="Patna"
        )
        db.add(crime)
db.commit()
print(f"  [OK] {len(fir_data)} FIRs + crime events ready")

# ---- Complaints --------------------------------------------------------------
complaints_data = [
    {"citizen_name": "Ramesh Kumar", "phone": "9876543210", "complaint_type": "Noise Pollution", "description": "Loud music from nearby shop after midnight causing disturbance to residents.", "location": "Fraser Road, Patna", "status": "pending"},
    {"citizen_name": "Anita Sharma", "phone": "9765432109", "complaint_type": "Road Accident",   "description": "Hit and run accident near income tax roundabout. Need urgent action.",       "location": "Income Tax Chowk",   "status": "reviewing"},
    {"citizen_name": "Vikram Singh", "phone": "9654321098", "complaint_type": "Missing Person",  "description": "My daughter aged 16 has been missing since yesterday evening.",              "location": "Kankarbagh, Patna",  "status": "pending"},
]

for i, c in enumerate(complaints_data):
    existing = db.query(models.Complaint).filter(
        models.Complaint.citizen_name == c["citizen_name"],
        models.Complaint.complaint_type == c["complaint_type"]
    ).first()
    if not existing:
        complaint = models.Complaint(
            **c,
            date=datetime.utcnow() - timedelta(days=random.randint(1, 10)),
            station_id=stations[i % len(stations)].id
        )
        db.add(complaint)
db.commit()
print(f"  [OK] {len(complaints_data)} complaints ready")

# ---- Custody Records ---------------------------------------------------------
if not db.query(models.Custody).filter(models.Custody.arrest_id == "ARR-2024-001").first():
    officer = field_officers[0] if field_officers else created_users[0]
    custody_data = [
        {
            "arrest_id": "ARR-2024-001",
            "accused_name": "Manoj Kumar",
            "arrest_date": datetime.utcnow() - timedelta(hours=6),
            "custody_location": "Patna City PS Lock-Up",
            "relative_phone": "9123456789",
            "relative_name": "Sita Devi",
            "officer_id": officer.id,
            "station_id": stations[0].id,
            "status": "in_custody",
            "last_video_upload": datetime.utcnow() - timedelta(hours=5) # Overdue
        },
        {
            "arrest_id": "ARR-2024-002",
            "accused_name": "Suresh Raina",
            "arrest_date": datetime.utcnow() - timedelta(hours=2),
            "custody_location": "Bankipur PS Cell 1",
            "relative_phone": "9876543210",
            "relative_name": "Priyanka Raina",
            "officer_id": officer.id,
            "station_id": stations[1].id,
            "status": "in_custody",
            "last_video_upload": datetime.utcnow() - timedelta(minutes=30) # Safe
        },
        {
            "arrest_id": "ARR-2024-003",
            "accused_name": "Vikram Rathore",
            "arrest_date": datetime.utcnow() - timedelta(days=1),
            "custody_location": "Gandhi Maidan PS",
            "relative_phone": "9988776655",
            "relative_name": "Rathore Family",
            "officer_id": officer.id,
            "station_id": stations[2].id,
            "status": "released",
            "last_video_upload": datetime.utcnow() - timedelta(hours=20)
        }
    ]
    for c in custody_data:
        db.add(models.Custody(**c))
    db.commit()
print("  [OK] 3 custody records (Overdue, Safe, Released) ready")

# ---- Active Duties -----------------------------------------------------------
for i, officer in enumerate(field_officers[:2]):
    if not db.query(models.OfficerDuty).filter(
        models.OfficerDuty.officer_id == officer.id,
        models.OfficerDuty.status == "active"
    ).first():
        duty = models.OfficerDuty(
            officer_id=officer.id,
            zone=f"Patrol Zone {i+1} - Patna City",
            zone_lat=25.5941 + (i * 0.005),
            zone_lng=85.1376 + (i * 0.005),
            zone_radius_km=2.0,
            duty_start=datetime.utcnow() - timedelta(hours=2),
            status="active"
        )
        db.add(duty)
        officer.is_available = False
db.commit()
print("  [OK] Active duties assigned")

# ---- Sample Alert ------------------------------------------------------------
if db.query(models.Alert).count() == 0:
    db.add(models.Alert(
        alert_type="feedback",
        message="HIGH sensitivity feedback received at Patna City Police Station",
        severity="high",
        case_type="feedback",
        target_roles=["ssp", "station_officer"]
    ))
    db.commit()

# ---- Strategic Cases ---------------------------------------------------------
if db.query(models.Case).count() == 0:
    case1 = models.Case(
        title="Sensitive Case: Protection of Minor",
        description="Emergency case involving a minor requiring immediate protection. Investigation into suspicious activities in Patna City Area.",
        priority="high",
        status="Under Investigation",
        station_id=stations[0].id,
        latitude=25.5941, longitude=85.1376
    )
    db.add(case1)
    db.flush()
    
    # Assign to Inspector
    inspector = [u for u in created_users if u.role == "station_officer"][0]
    db.add(models.CaseAssignment(case_id=case1.id, officer_id=inspector.id, notes="Assigned to senior officer due to sensitivity."))
    db.add(models.CaseStatusLog(case_id=case1.id, status="Case Opened", notes="System auto-classified as HIGH priority."))
    db.add(models.CaseStatusLog(case_id=case1.id, status="Assigned", notes=f"Assigned to {inspector.name}."))
    db.add(models.CaseStatusLog(case_id=case1.id, status="Under Investigation", notes="Initial statements recorded."))

    case2 = models.Case(
        title="Neighborhood Dispute: Property Line",
        description="Ongoing dispute between neighbors regarding property boundaries near Bankipur.",
        priority="low",
        status="Assigned",
        station_id=stations[1].id,
        latitude=25.6117, longitude=85.1450
    )
    db.add(case2)
    db.flush()
    
    # Assign to Constable
    constable = [u for u in created_users if u.role == "field_officer"][1]
    db.add(models.CaseAssignment(case_id=case2.id, officer_id=constable.id, notes="Standard priority neighborhood check."))
    db.add(models.CaseStatusLog(case_id=case2.id, status="Case Opened"))
    db.add(models.CaseStatusLog(case_id=case2.id, status="Assigned", notes=f"Assigned to {constable.name}."))

    db.commit()

print("  [OK] Strategic cases seeded")
print("  [OK] Sample alerts seeded")

db.close()
print("\n[DONE] Seed complete! Login credentials:")
print("  SSP:              ssp@copsense.in        / Admin@123")
print("  Station Officer:  inspector1@copsense.in / Admin@123")
print("  Field Officer:    officer1@copsense.in   / Admin@123")
print("  Citizen:          citizen1@copsense.in   / User@123")
