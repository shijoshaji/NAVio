# Installation & Usage Guide

## Prerequisites

- **OS**: Windows (Bat scripts provided)
- **Runtime**:
  - Python 3.10+ (for local backend)
  - Node.js 18+ (for local frontend)
  - **OR** Docker Desktop / Podman (for containerized setup)

---

## 🚀 Quick Start (Local)

> **⚠️ Database Warning**: Before running, please understand how the database is shared. Read the [DB Synchronization Guide](DB_Synchronization.md) to avoid data corruption or locking errors.

### 🪟 Windows Users
The easiest way to run the application is using the provided batch scripts.

1.  **Start Application**:
    
    You can simply **double-click** the file `localrun\navio_start.bat` in File Explorer, or run it from the terminal:

    ````bash
    ```bash
    localrun\navio_start.bat
    ````

    This will launch both the Backend (Port 8002) and Frontend (Port 5174) in separate terminals and open your browser.

2.  **Stop Application**:
    
    Similarly, **double-click** `localrun\navio_stop.bat` or run:

    ````bash
    ```bash
    localrun\navio_stop.bat
    ````

### 🐧 Linux / macOS Users

You will need to run the Backend and Frontend manually in separate terminals.

**Terminal 1 (Backend):**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m uvicorn main:app --port 8002 --reload
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm install
npm run dev
```

---

## 🐳 Docker / Podman Setup

You can run the full application (Frontend + Backend + Database) in containers. The `mf_tracker.db` is shared between your local file system and the container, ensuring data persistence.

### 🪟 Windows Users

#### Option 1: Docker Desktop

1.  Ensure Docker Desktop is running.
2.  **Prerequisite**: Ensure `backend/mf_tracker.db` exists (Run local start once if needed).
3.  **Start**: **Double-click** `dockerization\docker-navio_start.bat`
4.  **Stop**: **Double-click** `dockerization\docker-navio_stop.bat`

#### Option 2: Podman

1.  Ensure Podman is installed (`podman --version`).
2.  **Prerequisite**: Ensure `backend/mf_tracker.db` exists.
3.  **Start**: **Double-click** `dockerization\podman-navio_start.bat`
4.  **Stop**: **Double-click** `dockerization\podman-navio_stop.bat`

### 🐧 Linux / macOS Users

Ensure you are in the project root and `backend/mf_tracker.db` exists.

**Docker**:
```bash
cd dockerization
docker-compose up --build -d  # Start
docker-compose down           # Stop
```

**Podman**:
```bash
cd dockerization
podman-compose up --build -d  # Start
podman-compose down           # Stop
```

### Container Management (Manual)

If you need to manually manage the containers or view logs:

```bash
# View Logs
cd dockerization
docker-compose logs -f       # Docker
podman-compose logs -f       # Podman

# Rebuild Containers (Required after code changes)
docker-compose up --build -d # Docker
podman-compose up --build -d # Podman
cd ..
```

---

## 🛠️ Manual Setup (Development)

If you prefer to run the services manually for development:

### 1. Backend Setup

```bash
cd backend
# Create virtual environment (in root)
python -m venv ..\venv
# Activate venv (Windows)
..\venv\Scripts\activate
# Install dependencies
pip install -r requirements.txt
# Run Server
python -m uvicorn main:app --port 8002 --reload
```

### 2. Frontend Setup

```bash
cd frontend
# Install dependencies
npm install
# Run Dev Server
npm run dev
```

---

## 🔧 Troubleshooting

### Port Conflicts

If ports **8002** or **5174** are in use:

```bash
# Find process
netstat -ano | findstr :8002
# Kill process
taskkill /PID <PID> /F
```

### Database Locked (`sqlite3.OperationalError`)

SQLite does not support concurrent writes. **Do not run the local backend and containerized backend at the same time.** Ensure one is stopped before starting the other.

### Podman Rebuild Issues

If you are seeing 404 errors or old versions in Podman, you must force a clean rebuild:

```bash
# 1. Stop
dockerization\podman-navio_stop.bat
# 2. Remove Images
podman rmi navio-frontend navio-backend
# 3. Start (Triggers Rebuild)
dockerization\podman-navio_start.bat
```
