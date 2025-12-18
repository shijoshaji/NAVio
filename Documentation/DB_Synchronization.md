# Database Synchronization Guide

This document details how the SQLite database (`mf_tracker.db`) is synchronized between your local machine (Host) and the Docker/Podman containers.

## 🔗 Architecture: Single Source of Truth

The application is designed to use a **single database file** for both local development and containerized execution. This is achieved through Docker *Volume Mapping*.

- **Host Path**: `backend/mf_tracker.db`
- **Container Path**: `/app/mf_tracker.db`

When the container starts, it does *not* create a new database inside itself. Instead, it "looks" at the file on your hard drive.

### Local Mode (Direct Access)
When you run the backend locally (e.g., via `localrun\navio_start.bat` or `python main.py`):
1. The Python process reads/writes directly to `backend/mf_tracker.db`.
2. Changes are immediate and persistent.

### Container Mode (Volume Mapped)
When you run the application in Docker/Podman (e.g., via `dockerization\docker-navio_start.bat`):
1. The container mounts your local `backend/mf_tracker.db` to `/app/mf_tracker.db`.
2. The code inside the container reads/writes to this mounted path.
3. **Result**: Any change made inside the container is instantly reflected in your local file, and vice versa.

### 🆕 First Run Warning (IMPORTANT)
**Does Docker create the file? NO.**

If `backend/mf_tracker.db` does **not exist** on your host machine when you start the container:
1. Docker will create a **directory** named `mf_tracker.db` instead of a file.
2. The application will crash with permission errors (because it expects a file).

**Solution**: Run the application **Locally** once (using `localrun\navio_start.bat` or `python main.py`) to generate the initial database file BEFORE running Docker.

---

## ⚠️ Critical Warnings

### 1. ⛔ NO Concurrent Access
**NEVER run the Local Backend and the Docker Container at the same time.**

*   **Why?** SQLite is a file-based database. It handles locking to prevent corruption. If two different processes (one on Windows, one in Linux container) try to write to the file simultaneously, you will encounter `sqlite3.OperationalError: database is locked` or potentially corrupt your data.
*   **Rule**: Always fully stop one environment before starting the other.

### 2. 🗑️ Data Persistence & Deletion
Because the file is effectively "shared":
*   **If you delete `mf_tracker.db` on your host machine**, the container loses its data.
*   **If the container modifies data (e.g., adds a user)**, that data exists in your local file even after you destroy the container.
*   **Rebuilding Containers**: You can destroy and rebuild containers (`docker-compose down`, `docker-compose up --build`) without losing data, *as long as you do not delete the local .db file*.

### 3. 🔄 Schema Migrations
If you pull a new version of the code that requires a database schema change (new tables, columns):
1. The migration script will run on whichever environment you start first.
2. Since they share the file, you do not need to migrate "both". Migrating in Docker updates the file for Local, and vice-versa.

---

## ✅ Best Practices

1.  **Backup**: Regularly copy `mf_tracker.db` to a safe location, especially before upgrading the app or running risky bulk operations.
2.  **Check Status**: Before starting Docker, check if a local python process is holding the file lock (e.g., a forgotten terminal running the backend).
3.  **Permissions**: On Linux/Mac hosts (less relevant for Windows), ensure the file permissions allow the Docker user to read/write the mounted file.
