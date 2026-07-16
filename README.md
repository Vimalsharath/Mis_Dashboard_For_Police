<p align="center">

<img src="https://img.shields.io/badge/Status-Active-success?style=for-the-badge"/>

<img src="https://img.shields.io/badge/Maintained-Yes-blue?style=for-the-badge"/>

<img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge"/>

</p>
# CopSense 👮‍♂️👮‍♀️
### AI-Powered Police Intelligence & Management System

CopSense is a comprehensive, full-stack intelligence platform designed to modernize law enforcement operations. It integrates AI-driven analytics, streamlined case management, and real-time resource tracking into a cohesive interface.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.8 or higher installed on your system.

### Quick Start
1. **Clone/Navigate** to the project directory.
2. Run the unified launch script:
   ```bash
   python run.py
   ```
   *The script will automatically seed the database if it's the first run and start the server.*

3. **Access the App**:
   - **Frontend UI**: [http://localhost:8000](http://localhost:8000)
   - **Interactive API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠 Features

### 🧠 AI & Intelligence
- **Automated Case Prioritization**: NLP-based analysis of incident descriptions to rank cases by severity.
- **Crime Heatmaps**: Visual distribution of incidents to identify hotspots.
- **Sentiment Analysis**: Tracking community feedback sentiment using AI.

### 📋 Case Management
- **Digital FIRs**: Standardized electronic First Information Reports with evidence tracking.
- **Case Lifecycle**: Full traceability from complaint filing to investigation and closure.
- **Officer Assignment**: Smart assignment logic based on workload and specialization.

### 🏢 Command Center
- **Deployment Tracker**: Live view of where police resources are stationed.
- **Real-time Alerts**: Critical notifications for emergency incidents and custody updates.
- **Shared Dashboards**: Securely shareable command center views for inter-department coordination.

### 🛡 Custody & Duty
- **Custody Monitor**: Automated auditing of custody status with regular video update requirements (every 4 hours).
- **Duty Board**: Dynamic roster management for police station personnel.

---

## 💻 Tech Stack

- **Backend**: [FastAPI](https://fastapi.tiangolo.com/) (Python)
- **Database**: [SQLAlchemy](https://www.sqlalchemy.org/) with SQLite
- **AI/ML**: `textblob` for NLP, `scikit-learn` for classification
- **Frontend**: Vanilla HTML/JS with CSS3 (Professional "Government Light" UI)
- **Background Tasks**: [APScheduler](https://apscheduler.readthedocs.io/) for custody alerts

---

## 📁 Project Structure

```text
copsense/
├── backend/            # FastAPI application
│   ├── routers/        # API endpoints (Auth, Cases, FIR, Heatmap, etc.)
│   ├── models.py       # DB Schemas
│   ├── main.py         # App Entry Point
│   └── seed_data.py    # Sample database records
├── frontend/           # Static web interface
│   ├── css/            # Style definitions
│   └── js/             # Application logic
└── run.py              # Root launcher script
```

---

## 📄 License
This system is developed for governmental police operations and intelligence management.
