"""
CopSense – Launch Script
Run: python run.py
"""
import subprocess
import sys
import os


def install_deps():
    req_file = os.path.join(os.path.dirname(__file__), "backend", "requirements.txt")
    print("[*] Installing dependencies...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", req_file, "-q"])
    print("[OK] Dependencies installed\n")


def seed():
    seed_file = os.path.join(os.path.dirname(__file__), "backend", "seed_data.py")
    db_file   = os.path.join(os.path.dirname(__file__), "backend", "copsense.db")
    if not os.path.exists(db_file):
        print("[*] Running seed data...")
        subprocess.check_call([sys.executable, seed_file])
        print()


def run():
    backend_dir = os.path.join(os.path.dirname(__file__), "backend")
    print("[*] Starting CopSense server at http://localhost:8000")
    print("[*] API docs at  http://localhost:8000/docs")
    print("[*] App UI at    http://localhost:8000\n")
    os.chdir(backend_dir)
    subprocess.check_call([
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--host", "0.0.0.0",
        "--port", "8000",
        "--reload",
        "--reload-dir", "."
    ])


if __name__ == "__main__":
    # install_deps() # Skip if already installed
    seed()
    run()

