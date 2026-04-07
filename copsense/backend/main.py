from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.background import BackgroundScheduler
from database import engine, SessionLocal
import models
import os

# ── Create all tables ─────────────────────────────────────────────────────────
models.Base.metadata.create_all(bind=engine)

# ── App setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CopSense – Police Intelligence & Management System",
    description="Full-stack Police MIS with AI-powered modules",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Upload directory ──────────────────────────────────────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "fir_evidence"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "custody_videos"), exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Register routers ──────────────────────────────────────────────────────────
from routers.auth import router as auth_router
from routers.feedback import router as feedback_router
from routers.fir import router as fir_router
from routers.complaints import router as complaints_router
from routers.duty import router as duty_router
from routers.custody import router as custody_router
from routers.deployment import router as deployment_router
from routers.heatmap import router as heatmap_router
from routers.alerts import router as alerts_router
from routers.ai import router as ai_router
from routers.cases import router as cases_router

app.include_router(auth_router)
app.include_router(feedback_router)
app.include_router(fir_router)
app.include_router(complaints_router)
app.include_router(duty_router)
app.include_router(custody_router)
app.include_router(deployment_router)
app.include_router(heatmap_router)
app.include_router(alerts_router)
app.include_router(ai_router)
app.include_router(cases_router)


# ── Static frontend ───────────────────────────────────────────────────────────
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")


# ── Background Scheduler: Custody 4-hour video alert ─────────────────────────
def check_custody_alerts():
    """Runs every 30 minutes — checks for overdue custody video uploads."""
    from datetime import datetime, timedelta
    db = SessionLocal()
    try:
        threshold = datetime.utcnow() - timedelta(hours=4)
        overdue = db.query(models.Custody).filter(
            models.Custody.status == "in_custody",
            models.Custody.alert_sent == False
        ).all()

        for c in overdue:
            is_overdue = (
                c.last_video_upload is None or
                c.last_video_upload < threshold
            )
            if is_overdue:
                # Create alert
                existing_alert = db.query(models.Alert).filter(
                    models.Alert.case_id == c.id,
                    models.Alert.case_type == "custody",
                    models.Alert.status == "open"
                ).first()

                if not existing_alert:
                    hours_since = round(
                        (datetime.utcnow() - (c.last_video_upload or c.created_at)).total_seconds() / 3600, 1
                    )
                    alert = models.Alert(
                        alert_type="custody",
                        message=(
                            f"🚨 CUSTODY UPDATE MISSING: Arrest ID {c.arrest_id} "
                            f"({c.accused_name}) — No video uploaded for {hours_since}h. "
                            f"Officer must upload custody video immediately."
                        ),
                        severity="critical",
                        case_id=c.id,
                        case_type="custody",
                        target_roles=["ssp", "station_officer"]
                    )
                    db.add(alert)
                    c.alert_sent = True
                    print(
                        f"[ALERT] Custody video overdue for arrest {c.arrest_id} — "
                        f"[MOCK SMS/WHATSAPP to {c.relative_phone}]: "
                        f"Custody update overdue for {c.accused_name}. Please contact station."
                    )

        db.commit()
    except Exception as e:
        print(f"[Scheduler Error] {e}")
    finally:
        db.close()


scheduler = BackgroundScheduler()
scheduler.add_job(check_custody_alerts, "interval", minutes=30)
scheduler.start()


@app.get("/api/health")
def health():
    return {"status": "ok", "system": "CopSense v1.0"}


@app.on_event("shutdown")
def shutdown():
    scheduler.shutdown()
