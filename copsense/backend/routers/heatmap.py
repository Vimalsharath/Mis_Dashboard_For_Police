from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from dependencies import get_current_user, require_roles
import models

router = APIRouter(prefix="/api/heatmap", tags=["Heatmap"])


@router.get("/data")
def get_heatmap_data(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """
    Returns crime event data for Leaflet.js heatmap.
    Each point: {lat, lng, intensity, crime_type, severity, date}
    """
    events = db.query(models.CrimeEvent).all()
    severity_weight = {"low": 0.3, "medium": 0.6, "high": 1.0}

    points = []
    for e in events:
        points.append({
            "lat": e.latitude,
            "lng": e.longitude,
            "intensity": severity_weight.get(e.severity, 0.5),
            "crime_type": e.crime_type,
            "severity": e.severity,
            "date": e.date.isoformat() if e.date else None,
            "district": e.district
        })

    # Zone summary for color-coding
    fir_count = db.query(models.FIR).count()
    complaint_count = db.query(models.Complaint).count()
    high_crimes = sum(1 for e in events if e.severity == "high")
    medium_crimes = sum(1 for e in events if e.severity == "medium")
    low_crimes = sum(1 for e in events if e.severity == "low")

    # Risk zone classification
    risk_level = "green"
    if high_crimes > 5 or fir_count > 20:
        risk_level = "red"
    elif high_crimes > 2 or medium_crimes > 10 or fir_count > 10:
        risk_level = "orange"

    return {
        "points": points,
        "summary": {
            "total_events": len(events),
            "fir_count": fir_count,
            "complaint_count": complaint_count,
            "high_crimes": high_crimes,
            "medium_crimes": medium_crimes,
            "low_crimes": low_crimes,
            "overall_risk": risk_level
        }
    }


@router.get("/stations-overview")
def station_crime_overview(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles("ssp", "station_officer"))
):
    """Per-station crime summary for district-level heatmap view."""
    stations = db.query(models.Station).all()
    result = []

    for station in stations:
        firs = db.query(models.FIR).filter(models.FIR.station_id == station.id).count()
        complaints = db.query(models.Complaint).filter(models.Complaint.station_id == station.id).count()
        open_firs = db.query(models.FIR).filter(
            models.FIR.station_id == station.id,
            models.FIR.status == "open"
        ).count()

        total_crime_index = firs * 2 + complaints
        if total_crime_index > 20:
            risk = "red"
        elif total_crime_index > 8:
            risk = "orange"
        else:
            risk = "green"

        result.append({
            "station_id": station.id,
            "station_name": station.name,
            "district": station.district,
            "lat": station.latitude,
            "lng": station.longitude,
            "fir_count": firs,
            "complaint_count": complaints,
            "open_firs": open_firs,
            "risk_level": risk
        })

    return result
