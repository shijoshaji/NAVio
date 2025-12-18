# Technical Walkthrough

## Architecture Overview

**NAViō** follows a modern single-page application (SPA) architecture:

- **Frontend**: React (Vite) + TailwindCSS. Serves the UI and communicates with the backend via REST API.
- **Backend**: FastAPI (Python). Handles business logic, data processing, and external API calls.
- **Database**: SQLite (`backend/mf_tracker.db`). Single file database for easy portability and backup.
- **External Data**:
  - **AMFI India**: Daily NAV text file for heavy lifting.
  - **MFAPI.in**: JSON API for granular historical data.

---

## Core Systems

### 1. NAV Synchronization Engine (`backend/services/nav.py`)

The synchronization process is capable of handling both daily updates and historical backfilling.

**The "Daily" Sync**:

1.  Downloads the raw text feed from AMFI.
2.  Parses the delimited data to find funds matching your database.
3.  Updates the `Scheme` table with the latest `net_asset_value` and `date`.
4.  Inserts a record into `NAVHistory` **only** for Active Schemes (Watchlist/Portfolio funds). This keeps the database size manageable.

### 2. Self-Healing History (Gap Recovery)

This feature ensures that your historical charts are accurate even if you miss syncing for weeks or add a completely new fund.

**Logic Flow**:

- **Trigger**: Occurs automatically after the daily sync.
- **Check**: Systems iterates through all Active Schemes.
- **Condition**:
  1.  Is the gap between the latest record and the previous record > **5 Days**?
  2.  OR, does the fund have < **2** history records?
- **Action**:
  - If Triggered, calls `https://api.mfapi.in/mf/{scheme_code}`.
  - Backfills missing dates efficiently (scanning backwards until it hits existing data).

### 3. Portfolio Analytics (`backend/services/portfolio.py`)

Calculates real-time metrics for your investments.

- **XIRR**: Extended Internal Rate of Return calculation for SIPs.
- **Absolute Returns**: Simple percentage gain/loss.
- **Allocation**: Asset allocation by AMC or Category.

---

## Database Schema

**Location**: `backend/mf_tracker.db`
**Technology**: SQLite (via SQLAlchemy ORM)

### Key Tables

- **Schemes**: Master list of mutual funds (metadata).
- **Transactions**: User investment records (SIP/Lumpsum).
- **NAVHistory**: Historical price points (Date, NAV) for active funds.
- **Watchlist**: User's tracked funds with target prices.

---

## Directory Structure

```text
NAVio/
├── backend/
│   ├── main.py              # Application Entry Point
│   ├── database.py          # DB Connection & Scheduler
│   ├── models.py            # SQLAlchemy Models
│   ├── mf_tracker.db        # SQLite Database (Persisted)
│   └── services/
│       ├── nav.py           # Sync Logic & History
│       ├── transaction.py   # CRUD for Investments
│       └── portfolio.py     # Analytics Engine
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Watchlist.jsx
│   │   │   └── Portfolio.jsx
│   │   ├── services/
│   │   │   └── api.js       # Axios Configuration
│   │   └── components/      # Reusable UI components
├── *.bat                    # Convenience Scripts
└── [Documentation].md       # You are reading this
```

---

## Production vs Development

- **Development**: `navio_start.bat` runs frontend/backend in watch mode.
- **Production (Docker)**:
  - Frontend utilizes Nginx to serve static assets and proxy `/api/*` to the backend.
  - Backend runs via Uvicorn.
  - Database is bind-mounted for persistence.
