import sys
import os
from datetime import datetime, timedelta

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal
import models
from main import check_custody_alerts

def setup_test_data():
    db = SessionLocal()
    print("[*] Setting up test custody record...")
    
    # Check for test record
    test_arrest_id = "ARR-2024-TEST-001"
    existing = db.query(models.Custody).filter(models.Custody.arrest_id == test_arrest_id).first()
    
    if existing:
        print(f"  [!] Found existing {test_arrest_id}, resetting status...")
        existing.status = "in_custody"
        existing.alert_sent = False
        existing.last_video_upload = datetime.utcnow() - timedelta(hours=6)
    else:
        # Create a new overdue record
        officer = db.query(models.User).filter(models.User.role == "field_officer").first()
        station = db.query(models.Station).first()
        
        new_record = models.Custody(
            arrest_id=test_arrest_id,
            accused_name="Amitabh (Test Case)",
            arrest_date=datetime.utcnow() - timedelta(hours=10),
            custody_location="Test Lock-Up",
            relative_phone="+919999988888",
            relative_name="Test Relative",
            officer_id=officer.id if officer else 1,
            station_id=station.id if station else 1,
            status="in_custody",
            last_video_upload=datetime.utcnow() - timedelta(hours=6),
            alert_sent=False
        )
        db.add(new_record)
        print(f"  [OK] Created new {test_arrest_id} (6h since last video)")
    
    db.commit()
    db.close()

def run_monitor():
    print("\n[*] Manually triggering check_custody_alerts()...")
    check_custody_alerts()
    print("[DONE] Alert generation complete.")

if __name__ == "__main__":
    setup_test_data()
    run_monitor()
