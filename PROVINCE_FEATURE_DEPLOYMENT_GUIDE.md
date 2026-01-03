# Province Filtering Feature - Deployment & Testing Guide
**Created:** December 6, 2025  
**Feature:** Smart location filtering berdasarkan provinsi user

## 📋 Overview

Fitur ini menambahkan province-based filtering untuk location selection:
- Auto-detect provinsi user dari GPS
- Filter tempat berangkat & tujuan berdasarkan provinsi
- Backward compatible dengan feature flag
- Easy rollback jika ada masalah

---

## 🚀 Deployment Steps

### **Phase 1: Database Migration (CRITICAL - Backup First!)**

#### 1.1 Backup Database
```bash
# Via Railway CLI
railway login
railway link
railway run psql \$DATABASE_URL -c "\copy (SELECT * FROM location_references) TO '/tmp/locations_backup.csv' CSV HEADER"

# Atau export via Railway Dashboard:
# Settings → Database → Export Data
```

#### 1.2 Run Migrations
```bash
cd /Volumes/SSD_FITRO/drive-download-20251121T145750Z-1-001/travel_api

# Via Railway CLI
railway run psql \$DATABASE_URL < migrations/001_add_province_support.sql
railway run psql \$DATABASE_URL < migrations/002_seed_province_data.sql

# Verify migration success
railway run psql \$DATABASE_URL -c "SELECT * FROM provinces;"
railway run psql \$DATABASE_URL -c "SELECT COUNT(*) FROM location_references WHERE province_id IS NOT NULL;"
```

**Expected Output:**
```
provinces table: 1 row (Sumatera Barat)
location_references: All existing rows have province_id = 1
```

### **Phase 2: Deploy Backend**

#### 2.1 Test Locally First
```bash
cd /Volumes/SSD_FITRO/drive-download-20251121T145750Z-1-001/travel_api

# Start server
npm start

# Test endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/provinces
curl "http://localhost:3000/api/provinces/detect?lat=-0.947&lng=100.417"
curl "http://localhost:3000/api/locations?search=padang&province_id=1"
```

#### 2.2 Deploy to Railway
```bash
# Commit changes
git add .
git commit -m "feat: add province filtering with feature flag (backward compatible)"
git push origin main

# Railway will auto-deploy
# Monitor logs:
railway logs
```

#### 2.3 Set Feature Flag (DEFAULT: ENABLED)
```bash
# To ENABLE (default)
railway variables set ENABLE_PROVINCE_FEATURES=true

# To DISABLE (rollback tanpa code change)
railway variables set ENABLE_PROVINCE_FEATURES=false

# Check current status
railway variables
```

### **Phase 3: Verify Production**

```bash
# Test health endpoint
curl https://travel-api-production-23ae.up.railway.app/health

# Expected response:
{
  "status": "OK",
  "database": "connected",
  "features": {
    "provinceFiltering": true
  }
}

# Test province endpoints
curl https://travel-api-production-23ae.up.railway.app/api/provinces

# Test province detection
curl "https://travel-api-production-23ae.up.railway.app/api/provinces/detect?lat=-0.947&lng=100.417"

# Test location filtering
curl "https://travel-api-production-23ae.up.railway.app/api/locations?search=padang&province_id=1"
```

---

## 🧪 Testing Checklist

### **Backend API Tests**

- [ ] **Health Check**
  ```
  GET /health
  ✓ Returns status OK
  ✓ Shows provinceFiltering: true
  ✓ Database connected
  ```

- [ ] **Get All Provinces**
  ```
  GET /api/provinces
  ✓ Returns Sumatera Barat
  ✓ Status 200
  ✓ JSON format correct
  ```

- [ ] **Detect Province from GPS**
  ```
  GET /api/provinces/detect?lat=-0.947&lng=100.417
  ✓ Returns Sumatera Barat
  ✓ Coordinates for Padang work
  ✓ Invalid coordinates return 404
  ✓ Missing params return 400
  ```

- [ ] **Get Locations (Existing - No Province Filter)**
  ```
  GET /api/locations?search=padang
  ✓ Still works (backward compatible)
  ✓ Returns all matching locations
  ✓ Old frontend apps still work
  ```

- [ ] **Get Locations (New - With Province Filter)**
  ```
  GET /api/locations?search=padang&province_id=1
  ✓ Returns only Sumbar locations
  ✓ Filters correctly by province
  ```

- [ ] **Feature Flag OFF Test**
  ```
  Set ENABLE_PROVINCE_FEATURES=false
  GET /api/provinces → 404
  GET /api/locations?search=padang → Still works
  ✓ Old functionality intact
  ```

### **Postman Collection**

Import this to Postman for quick testing:

```json
{
  "info": {
    "name": "Province Filtering API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "url": "https://travel-api-production-23ae.up.railway.app/health"
      }
    },
    {
      "name": "Get All Provinces",
      "request": {
        "method": "GET",
        "url": "https://travel-api-production-23ae.up.railway.app/api/provinces"
      }
    },
    {
      "name": "Detect Province (Padang)",
      "request": {
        "method": "GET",
        "url": {
          "raw": "https://travel-api-production-23ae.up.railway.app/api/provinces/detect?lat=-0.947&lng=100.417",
          "query": [
            {"key": "lat", "value": "-0.947"},
            {"key": "lng", "value": "100.417"}
          ]
        }
      }
    },
    {
      "name": "Search Locations - No Filter (Old)",
      "request": {
        "method": "GET",
        "url": {
          "raw": "https://travel-api-production-23ae.up.railway.app/api/locations?search=padang",
          "query": [{"key": "search", "value": "padang"}]
        }
      }
    },
    {
      "name": "Search Locations - With Province Filter (New)",
      "request": {
        "method": "GET",
        "url": {
          "raw": "https://travel-api-production-23ae.up.railway.app/api/locations?search=padang&province_id=1",
          "query": [
            {"key": "search", "value": "padang"},
            {"key": "province_id", "value": "1"}
          ]
        }
      }
    }
  ]
}
```

---

## ⚠️ Rollback Procedures

### **Level 1: Feature Flag Rollback (0 Downtime)**
```bash
# Disable province features immediately
railway variables set ENABLE_PROVINCE_FEATURES=false

# Restart server
railway up

# Verify
curl https://travel-api-production-23ae.up.railway.app/health
# Should show: provinceFiltering: false
```
**Impact:** 🟢 ZERO - API tetap jalan, province endpoints disabled

### **Level 2: Code Rollback (2-3 min downtime)**
```bash
cd /Volumes/SSD_FITRO/drive-download-20251121T145750Z-1-001/travel_api

# Revert commits
git log --oneline -5
git revert <commit-hash>
git push origin main

# Railway auto-deploys
```
**Impact:** 🟡 Minimal - Railway rolling deployment

### **Level 3: Database Rollback (5-10 min downtime)**
```bash
# Run rollback script
railway run psql \$DATABASE_URL < migrations/rollback_province_support.sql

# Verify
railway run psql \$DATABASE_URL -c "\\dt"
# provinces and province_coordinates should be gone
```
**Impact:** 🔴 High - Database operation, booking disabled temporarily

---

## 📊 Success Criteria

### **Before Declaring Success:**

- [  ] All API tests passing
- [ ] Health check shows correct feature flag status
- [ ] Province detection works for Sumbar coordinates
- [ ] Location filtering by province works
- [ ] Old API endpoints still work (backward compatible)
- [ ] Feature flag OFF = system works as before
- [ ] No errors in Railway logs
- [ ] Response times < 500ms

### **Performance Benchmarks:**

```
GET /api/provinces          → < 100ms
GET /api/provinces/detect   → < 200ms
GET /api/locations          → < 300ms (same as before)
GET /api/locations?province → < 400ms (with filter)
```

---

## 📝 Next Steps (After Successful Backend Deploy)

1. **Flutter App Update** (Separate Phase)
2. **Gradual Rollout** (10% → 50% → 100%)
3. **Monitor Metrics** (Error rate, response time)
4. **User Feedback** (Is filtering helpful?)

---

## 🆘 Emergency Contacts

```
Railway Dashboard: https://railway.app/project/...
Database: PostgreSQL on Railway
Logs: `railway logs`
Support: Railway Discord or Slack
```

---

## ✅ Deployment Checklist

**Pre-Deployment:**
- [ ] Database backup complete
- [ ] Migration scripts tested locally
- [ ] Rollback script ready
- [ ] Feature flag documented

**Deployment:**
- [ ] Migrations run successfully
- [ ] Code deployed to Railway
- [ ] Feature flag set correctly
- [ ] All tests passing

**Post-Deployment:**
- [ ] Health check verified
- [ ] API endpoints tested
- [ ] Logs checked (no errors)
- [ ] Performance acceptable
- [ ] Backward compatibility confirmed

**Ready for Flutter Phase:**
- [ ] Backend stable for 24 hours
- [ ] No critical errors reported
- [ ] Response times within SLA
- [ ] Rollback procedure tested

---

**Last Updated:** December 6, 2025  
**Status:** Ready for deployment  
**Risk Level:** 🟡 Medium (with easy rollback options)
