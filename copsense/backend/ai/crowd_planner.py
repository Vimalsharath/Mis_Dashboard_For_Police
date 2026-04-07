"""
AI Crowd & Event Deployment Planner
Pure rule-based formula engine — no external API required.
"""
import math
from typing import Any


RISK_MULTIPLIERS = {
    "low": 1.0,
    "medium": 1.4,
    "high": 1.8,
    "critical": 2.5
}

OFFICER_ROLES = {
    "Entry Control": 0.20,      # 20% at entry/exit points
    "Crowd Patrol": 0.35,       # 35% patrolling crowd
    "QRF (Quick Reaction)": 0.15,  # 15% rapid response team
    "VIP/Stage Security": 0.10,  # 10% stage/VIP area
    "Traffic Management": 0.10,  # 10% traffic
    "Medical Escort": 0.05,     # 5% medical
    "Control Room": 0.05        # 5% monitoring
}


def generate_blueprint(
    event_name: str,
    location: str,
    crowd_size: int,
    risk_level: str,
    duration_hours: float,
    latitude: float = None,
    longitude: float = None
) -> dict[str, Any]:
    """
    Generate a full deployment blueprint for an event.
    Returns structured JSON including officer count, role assignments,
    patrol zones, entry/exit points, and emergency routes.
    """
    multiplier = RISK_MULTIPLIERS.get(risk_level, 1.0)

    # Base formula: 1 officer per 100 attendees, minimum 5
    base_officers = max(5, math.ceil(crowd_size / 100))
    total_officers = math.ceil(base_officers * multiplier)

    # Add extra for long events (>8h = extra shift)
    if duration_hours > 8:
        total_officers = math.ceil(total_officers * 1.25)

    # Role assignment breakdown
    role_assignments = {}
    for role, pct in OFFICER_ROLES.items():
        count = max(1, math.ceil(total_officers * pct))
        role_assignments[role] = count

    # Patrol zones — divide area into quadrants
    zones = _generate_patrol_zones(location, latitude, longitude, risk_level)

    # Entry/exit points
    entry_exit = _generate_entry_exit_points(crowd_size, risk_level)

    # Emergency routes
    emergency_routes = _generate_emergency_routes(risk_level)

    # Shift planning
    shifts = []
    if duration_hours > 8:
        shifts = [
            {"shift": "Alpha", "hours": "00:00–08:00", "strength": math.ceil(total_officers * 0.5)},
            {"shift": "Bravo", "hours": "08:00–16:00", "strength": math.ceil(total_officers * 0.7)},
            {"shift": "Charlie", "hours": "16:00–24:00", "strength": total_officers}
        ]
    else:
        shifts = [{"shift": "Main", "hours": f"Event Duration ({duration_hours}h)", "strength": total_officers}]

    # Risk assessment summary
    risk_summary = _risk_assessment(crowd_size, risk_level, duration_hours)

    blueprint = {
        "event_name": event_name,
        "location": location,
        "crowd_size": crowd_size,
        "risk_level": risk_level,
        "duration_hours": duration_hours,
        "total_officers_required": total_officers,
        "role_assignments": role_assignments,
        "patrol_zones": zones,
        "entry_exit_points": entry_exit,
        "emergency_routes": emergency_routes,
        "shifts": shifts,
        "risk_assessment": risk_summary,
        "special_instructions": _special_instructions(risk_level, crowd_size),
        "equipment_required": _equipment_list(risk_level, crowd_size)
    }

    return blueprint


def _generate_patrol_zones(location: str, lat, lng, risk_level: str) -> list:
    zones = [
        {"zone_id": "Z1", "name": "North Perimeter", "priority": "high" if risk_level in ("high", "critical") else "medium"},
        {"zone_id": "Z2", "name": "South Perimeter", "priority": "medium"},
        {"zone_id": "Z3", "name": "East Entry Corridor", "priority": "high"},
        {"zone_id": "Z4", "name": "West Entry Corridor", "priority": "medium"},
        {"zone_id": "Z5", "name": "Central Stage/Event Area", "priority": "critical" if risk_level == "critical" else "high"},
        {"zone_id": "Z6", "name": "Parking Zone", "priority": "low"},
        {"zone_id": "Z7", "name": "Medical Aid Zone", "priority": "medium"},
    ]
    if risk_level in ("high", "critical"):
        zones.append({"zone_id": "Z8", "name": "Inner Security Cordon", "priority": "critical"})
    return zones


def _generate_entry_exit_points(crowd_size: int, risk_level: str) -> list:
    # More entry points for larger crowds
    num_entry = max(2, math.ceil(crowd_size / 5000))
    num_exit = max(2, math.ceil(crowd_size / 3000))  # More exits for safety

    points = []
    for i in range(1, num_entry + 1):
        points.append({"id": f"E{i}", "type": "Entry", "location": f"Entry Gate {i}", "officers_required": 3})
    for i in range(1, num_exit + 1):
        points.append({"id": f"X{i}", "type": "Exit", "location": f"Exit Gate {i}", "officers_required": 2})
    if risk_level in ("high", "critical"):
        points.append({"id": "VIP1", "type": "VIP Entry", "location": "VIP Gate", "officers_required": 5})
    return points


def _generate_emergency_routes(risk_level: str) -> list:
    routes = [
        {"route_id": "ER1", "name": "Primary Ambulance Route", "type": "Medical Emergency"},
        {"route_id": "ER2", "name": "Fire Brigade Access Route", "type": "Fire Emergency"},
        {"route_id": "ER3", "name": "Mass Evacuation Route North", "type": "Evacuation"},
        {"route_id": "ER4", "name": "Mass Evacuation Route South", "type": "Evacuation"},
    ]
    if risk_level in ("high", "critical"):
        routes.append({"route_id": "ER5", "name": "Riot Control Corridor", "type": "Law Enforcement"})
    return routes


def _risk_assessment(crowd_size: int, risk_level: str, duration_hours: float) -> dict:
    crowd_risk = "low" if crowd_size < 1000 else "medium" if crowd_size < 10000 else "high"
    duration_risk = "low" if duration_hours < 4 else "medium" if duration_hours < 8 else "high"
    return {
        "crowd_density_risk": crowd_risk,
        "duration_risk": duration_risk,
        "declared_risk_level": risk_level,
        "stampede_risk": crowd_size > 5000 and risk_level in ("high", "critical"),
        "vip_protection_needed": risk_level in ("high", "critical"),
        "anti_social_threat": risk_level in ("critical",)
    }


def _special_instructions(risk_level: str, crowd_size: int) -> list:
    instructions = [
        "All officers must carry communication devices",
        "Designated first aid stations every 500m",
        "CCTV monitoring from control room throughout the event"
    ]
    if risk_level == "medium":
        instructions += ["Deploy plainclothes officers in crowd", "Coordinate with local intelligence"]
    if risk_level == "high":
        instructions += [
            "Anti-riot vehicles on standby",
            "Water cannon on alert",
            "Plainclothes infiltration team deployed",
            "Real-time crowd density monitoring"
        ]
    if risk_level == "critical":
        instructions += [
            "NSG/STF on standby if applicable",
            "Complete crowd metadata verification at entry",
            "Sniper teams on rooftops (if VIP)",
            "Full communication blackout protocol ready"
        ]
    if crowd_size > 10000:
        instructions.append("Drone surveillance for aerial monitoring")
    return instructions


def _equipment_list(risk_level: str, crowd_size: int) -> list:
    equipment = [
        "Walkie-talkie sets", "First aid kits", "Barricades",
        "Loudspeakers", "Crowd control barriers", "Body cameras"
    ]
    if risk_level in ("medium", "high", "critical"):
        equipment += ["Tear gas shells", "Riot shields", "Batons", "Helmets"]
    if risk_level in ("high", "critical"):
        equipment += ["Water cannon", "Armored vehicle", "Drone units"]
    if crowd_size > 5000:
        equipment += ["Mobile command center", "Additional communication relay"]
    return equipment
