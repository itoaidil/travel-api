# Travel API – Railway Deployment & Seeding Log (2025-11-19)

This file summarizes the fixes, configuration, and steps taken to bring the API live on Railway, including database seeding and final runtime settings.

## Final Status
- Service: `travel-api` (Railway)
- Public URL: `https://travel-api-production-23ae.up.railway.app`
- Runtime Port: `3000` (configured via Railway Networking + PORT env var when needed)
- DB: Railway MySQL (internal host `mysql.railway.internal:3306`), database `railway`
- Health: `GET /health` → `{ "status": "OK" }`

## Key Fixes
- DB config updated to support Railway envs and `${VAR}` literals
  - File: `travel_api/config/database.js`
  - Reads `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT` with safe resolver
- Base tables migration added
  - `migrations/00_create_base_tables.sql`
  - Includes: users, pos, drivers, students, vehicles, travels, bookings, po_admins, vehicle_schedules
- Startup migration runner added
  - `server.js` now runs base migrations on boot and ensures `po_reviews`, `booking_seats`
- Seeding scripts
  - Local: `migrations/seed_initial_data.js`
  - Railway: `migrations/seed_railway_data.js` (exits gracefully)
  - Helper guide: `SEEDING_GUIDE.md`

## Railway Configuration Notes
- Networking → Public domain points to app on port 3000
- Variables used (examples):
  - `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`
  - Optional: `PORT=3000` (we ultimately aligned server to listen on 3000)
- If cold-start 502 occurs, wait a few seconds and retry – service wakes up.

## Seeding Summary
- Users: 7 (3 PO admins, 2 drivers, 2 students)
- POs: 3
- Vehicles: sample set added
- Vehicle schedules & travels: added

Credentials (dev/testing only):
- PO Admin: `admin1@po.com` / `admin123`
- Driver: `driver1@mail.com` / `driver123`
- Student: `student1@mail.com` / `student123`

## Useful Test Endpoints
- Health: `/health`
- Vehicles by PO: `/api/po/1/vehicles`
- Search PO: `/api/student/search-po?from=Jakarta&to=Bandung`
- Vehicles by schedule: `/api/student/vehicles-by-schedule?destination=Bandung`
- Travels list (legacy): `/api/student/travels`

## Release Notes
- Deployment fixed from ENOTFOUND `${MYSQLHOST}` to working MySQL connection
- 502 routed to port mismatch; resolved by aligning to port 3000
- Logs confirm: DB connected, migrations verified, API serving requests

---
Generated automatically to document the final working configuration and steps taken on 2025-11-19.
