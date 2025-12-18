# API Documentation 

This document describes the REST API endpoints for the NAViō Mutual Fund Tracker.

Base URL (Local): `http://localhost:8002`

## Table of Contents
- [Sync](#sync)
- [Portfolio & Investments](#portfolio--investments)
- [Watchlist](#watchlist)
- [Schemes & Market Data](#schemes--market-data)

---

## Sync

### Trigger NAV Sync
Fetches the latest NAV data from AMFI India and updates the local database. Also triggers historical data backfill for active funds.

`POST /api/sync-nav`

**Response (200 OK):**
```json
{
  "message": "Successfully synced 1245 schemes."
}
```

### Get Sync Status
Returns the date of the last successful synchronization.

`GET /api/sync-status`

**Response (200 OK):**
```json
{
  "last_sync": "2024-12-17T14:30:00",
  "total_schemes": 14500
}
```

---

## Portfolio & Investments

### Get Portfolio Summary
Returns the overall portfolio value, total investment, day's change, and XIRR.

`GET /api/portfolio`

**Response (200 OK):**
```json
{
  "total_invested": 500000,
  "current_value": 550000,
  "absolute_returns": 10.0,
  "xirr": 12.5,
  "todays_change": 1200
}
```

### List Investments
Get a list of all SIP and Lumpsum investments.

`GET /api/investments`
- **Query Params**: `type` (Optional: "SIP" or "LUMPSUM")

### Add Investment
Record a new investment.

`POST /api/investments`

**Body:**
```json
{
  "scheme_code": "100033",
  "type": "SIP",
  "amount": 5000,
  "purchase_nav": 150.25,
  "purchase_date": "2024-01-15"
}
```

### Update Investment
`PUT /api/investments/{investment_id}`

### Delete Investment
`DELETE /api/investments/{investment_id}`

---

## Watchlist

### Get Watchlist
Returns all tracked funds with their current NAV, target prices, and calculated metrics.

`GET /api/watchlist`

### Add to Watchlist
Start tracking a fund.

`POST /api/watchlist`

**Body:**
```json
{
  "scheme_code": "102885",
  "target_nav": 200.0,
  "group_id": 1,
  "units": 0,
  "invested_amount": 0
}
```

### Delete Watchlist Item
`DELETE /api/watchlist/item/{item_id}`

### Mark Item as Sold
Moves an item from active watchlist to sold history (logical delete/archive).

`POST /api/watchlist/item/{item_id}/sell`

**Body:**
```json
{
  "sold_nav": 250.0,
  "sold_date": "2024-12-01"
}
```

### Update Tracking Date
Change the "Start Date" for "Since Tracking" metrics.

`PATCH /api/watchlist/item/{item_id}/date`

### Watchlist Groups
Manage custom groups (e.g., "Long Term", "High Risk").

- `GET /api/watchlist/groups`
- `POST /api/watchlist/groups`
- `PUT /api/watchlist/groups/{group_id}`
- `DELETE /api/watchlist/groups/{group_id}`

---

## Schemes & Market Data

### Search Schemes
Search for funds by name.

`GET /api/schemes/search?query={fund_name}`

### List AMCs
Get a list of all Asset Management Companies.

`GET /api/schemes/amc`

### Get Schemes by AMC
`GET /api/schemes?amc={amc_name}`

### Get Scheme Details
Get metadata for a specific scheme code.

`GET /api/schemes/code/{scheme_code}`

### Get Scheme History
Get historical NAV data.

`GET /api/schemes/{scheme_code}/history`

### Get Scheme Stats
Returns 52-week High/Low and current price.

`GET /api/schemes/{scheme_code}/stats`

**Response:**
```json
{
  "high_52w": 180.5,
  "low_52w": 120.0,
  "current_nav": 175.0
}
```
