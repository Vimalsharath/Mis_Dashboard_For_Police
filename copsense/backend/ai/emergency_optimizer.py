"""
Emergency Response Optimizer
Suggests nearest available officer based on:
- Haversine distance (GPS)
- Officer availability
- Specialization match
- Current workload
No external API required.
"""
import math
from typing import Optional


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two GPS points in km."""
    R = 6371.0  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


SPECIALIZATION_SCORES = {
    # (required_type, officer_specialization) → bonus score
    ("crime", "crime"): 30,
    ("crime", "cyber"): 10,
    ("traffic", "traffic"): 30,
    ("vip", "vip"): 30,
    ("cyber", "cyber"): 30,
    ("riot", "crime"): 20,
    ("medical", "crime"): 5,
}


def score_officer(
    officer: dict,
    incident_lat: float,
    incident_lng: float,
    required_specialization: Optional[str] = None
) -> dict:
    """
    Score an officer for emergency dispatch.
    Higher score = better match.

    officer dict keys:
        id, name, latitude, longitude, is_available,
        specialization, active_case_count
    """
    if not officer.get("is_available"):
        return {"officer_id": officer["id"], "score": -1, "disqualified": "unavailable"}

    # Distance factor — max 80 points, 0km = 80pts, 20km+ = 0pts
    dist_km = haversine_km(
        incident_lat, incident_lng,
        officer.get("latitude", incident_lat),
        officer.get("longitude", incident_lng)
    )
    distance_score = max(0, 80 - (dist_km * 4))

    # Specialization bonus
    spec_score = 0
    if required_specialization and officer.get("specialization"):
        key = (required_specialization.lower(), officer["specialization"].lower())
        spec_score = SPECIALIZATION_SCORES.get(key, 5)  # 5 pts default if somewhat relevant

    # Workload penalty — each active case deducts 5 points
    workload_penalty = officer.get("active_case_count", 0) * 5

    total_score = distance_score + spec_score - workload_penalty

    return {
        "officer_id": officer["id"],
        "officer_name": officer.get("name", "Unknown"),
        "badge_id": officer.get("badge_id", ""),
        "specialization": officer.get("specialization", "general"),
        "distance_km": round(dist_km, 2),
        "distance_score": round(distance_score, 1),
        "specialization_bonus": spec_score,
        "workload_penalty": workload_penalty,
        "total_score": round(total_score, 1),
        "eta_minutes": round(dist_km * 3, 0),  # ~20km/h average in traffic
        "disqualified": None
    }


def rank_officers(
    officers: list[dict],
    incident_lat: float,
    incident_lng: float,
    required_specialization: Optional[str] = None,
    top_n: int = 5
) -> list[dict]:
    """
    Score and rank all available officers for an emergency.
    Returns top_n recommendations sorted by score descending.
    """
    scored = [
        score_officer(o, incident_lat, incident_lng, required_specialization)
        for o in officers
    ]
    # Filter out disqualified
    eligible = [s for s in scored if s.get("disqualified") is None and s["total_score"] >= 0]
    ranked = sorted(eligible, key=lambda x: x["total_score"], reverse=True)
    return ranked[:top_n]
