# 🔧 DRIVER REGISTRATION FIX - Dec 21, 2025

## ✅ Masalah yang Diperbaiki

**Problem:** Error "KTP photo, selfie, and license photo are required" muncul untuk semua jenis kendaraan, termasuk sepeda/wheels/skateboard yang seharusnya tidak memerlukan SIM.

**Root Cause:** Backend API hardcoded validation untuk semua file foto tanpa melihat jenis kendaraan.

---

## 🚀 Perubahan yang Dilakukan

### 1. Backend API Update (routes/onDemandDriver.js)

#### A. File Upload Validation (Conditional)
**Before:**
```javascript
if (!req.files.ktp_photo || !req.files.selfie_photo || !req.files.license_photo) {
  return res.status(400).json({
    success: false,
    message: 'KTP photo, selfie, and license photo are required'
  });
}
```

**After:**
```javascript
// Only KTP is always required
if (!req.files || !req.files.ktp_photo) {
  return res.status(400).json({
    success: false,
    message: 'KTP photo is required'
  });
}

// License photo only required for motorized vehicles
const motorizedVehicles = ['motorcycle', 'car', 'truck'];
if (motorizedVehicles.includes(vehicle_type)) {
  if (!req.files.license_photo) {
    return res.status(400).json({
      success: false,
      message: 'License photo is required for motorcycle, car, and truck'
    });
  }
}
```

#### B. Field Validation (Conditional)
**Before:**
```javascript
if (!user_id || !full_name || !phone || !email || !vehicle_type || !vehicle_plate || !license_number) {
  // Required for ALL
}
```

**After:**
```javascript
// Base required fields
if (!user_id || !full_name || !phone || !email || !vehicle_type) {
  // ...
}

// Conditional validation for motorized vehicles
if (motorizedVehicles.includes(vehicle_type)) {
  if (!vehicle_plate) { /* error */ }
  if (!license_number) { /* error */ }
}
```

#### C. File URL Handling (Optional)
```javascript
const selfie_photo_url = req.files.selfie_photo 
  ? `/uploads/driver_documents/${req.files.selfie_photo[0].filename}` 
  : null;  // OPTIONAL for all

const license_photo_url = req.files.license_photo 
  ? `/uploads/driver_documents/${req.files.license_photo[0].filename}` 
  : null;  // OPTIONAL for bike/wheels/skateboard
```

#### D. Database Insert (Handle NULL)
```javascript
[
  // ...
  vehicle_plate || null,           // NULL for bike/wheels/skateboard
  license_number || null,          // NULL for bike/wheels/skateboard
  license_photo_url || null,       // NULL if not uploaded
  selfie_photo_url || null,        // NULL if not uploaded
  // ...
]
```

---

### 2. Database Schema Update (REQUIRED)

**File:** `RAILWAY_SCHEMA_UPDATE.sql`

**Action:** Run SQL di Railway MySQL Console

**Changes:**
1. ✅ Add `wheels` dan `skateboard` ke `vehicle_type` ENUM
2. ✅ Make `vehicle_plate` NULLABLE (NULL untuk bike/wheels/skateboard)
3. ✅ Make `license_number` NULLABLE (NULL untuk bike/wheels/skateboard)

**Status:** ⚠️ **BELUM DIJALANKAN** - Perlu akses Railway console

---

## 📋 Validation Rules Summary

| Jenis Kendaraan | KTP Photo | Selfie Photo | License Photo | Plat Nomor | License Number | Service Allowed |
|----------------|-----------|--------------|---------------|------------|----------------|-----------------|
| **Sepeda** | ✅ Required | ⭕ Optional | ⭕ Optional | ⭕ Optional | ⭕ Optional | delivery |
| **Wheels** | ✅ Required | ⭕ Optional | ⭕ Optional | ⭕ Optional | ⭕ Optional | delivery |
| **Skateboard** | ✅ Required | ⭕ Optional | ⭕ Optional | ⭕ Optional | ⭕ Optional | delivery |
| **Motor** | ✅ Required | ⭕ Optional | ✅ Required | ✅ Required | ✅ Required | both |
| **Mobil** | ✅ Required | ⭕ Optional | ✅ Required | ✅ Required | ✅ Required | both |
| **Truck** | ✅ Required | ⭕ Optional | ✅ Required | ✅ Required | ✅ Required | delivery |

---

## 🧪 Testing Steps

### Step 1: Update Database Schema
```sql
-- Run in Railway MySQL Console
-- Copy paste from RAILWAY_SCHEMA_UPDATE.sql
```

### Step 2: Test dengan Flutter App
1. Buka app Hantar Driver
2. Pilih "Daftar Sebagai Driver"
3. Upload KTP photo (OCR auto-fill)
4. Upload selfie (optional)
5. Pilih kendaraan: **Sepeda**
6. Isi warna: "merah", tahun: "2023"
7. Lewati plat nomor (tidak muncul) ✅
8. Lewati SIM (tidak muncul) ✅
9. Isi rekening bank
10. Klik "DAFTAR SEBAGAI DRIVER"

**Expected Result:** ✅ Success - Data masuk ke database

### Step 3: Test Motor/Mobil
1. Ulangi step 2
2. Pilih kendaraan: **Motor**
3. **HARUS** isi plat nomor
4. **HARUS** upload foto SIM
5. **HARUS** isi nomor SIM
6. Klik "DAFTAR SEBAGAI DRIVER"

**Expected Result:** ✅ Success jika semua required field diisi

---

## 📝 Files Modified

1. ✅ `travel_api/routes/onDemandDriver.js` - API validation logic
2. ✅ `travel_api/update_schema.js` - Schema update script (not needed, use SQL directly)
3. ✅ `travel_api/RAILWAY_SCHEMA_UPDATE.sql` - Manual schema update (IMPORTANT)
4. ✅ `travel_api/test_registration.js` - API test script

---

## 🚨 IMPORTANT: Next Steps

### ⚠️ MUST DO: Update Database Schema
**Backend sudah deployed ✅**, tapi **database schema belum diupdate ❌**.

**Action Required:**
1. Login ke Railway dashboard
2. Buka MySQL console
3. Copy paste isi file `RAILWAY_SCHEMA_UPDATE.sql`
4. Execute semua query

**Tanpa schema update, akan error:**
```
Error: Data too long for column 'vehicle_type' at row 1
```

---

## 🔗 Deployment Info

**API URL:** https://travel-api-production-23ae.up.railway.app

**Status:** ✅ DEPLOYED (Git commit: 254b0b1)

**Last Updated:** Dec 21, 2025 15:47 WIB

**Validation:** ✅ Tested - returns correct error message

---

## 📊 Expected Database Insert Example

**Bike Registration:**
```sql
INSERT INTO independent_drivers (
  user_id, full_name, phone, email,
  nik, ktp_photo_url, selfie_photo_url,
  vehicle_type, vehicle_plate, vehicle_color,
  license_number, license_photo_url,
  service_type_allowed, status
) VALUES (
  123, 'Ahmad Sepeda', '081234567890', 'ahmad@email.com',
  '1234567890123456', '/uploads/ktp123.jpg', NULL,  -- selfie optional
  'bike', NULL, 'merah',                             -- no plate
  NULL, NULL,                                         -- no license
  'delivery', 'pending'
);
```

**Motor Registration:**
```sql
INSERT INTO independent_drivers (
  user_id, full_name, phone, email,
  nik, ktp_photo_url, selfie_photo_url,
  vehicle_type, vehicle_plate, vehicle_color,
  license_number, license_photo_url,
  service_type_allowed, status
) VALUES (
  124, 'Budi Motor', '081234567891', 'budi@email.com',
  '1234567890123457', '/uploads/ktp124.jpg', '/uploads/selfie124.jpg',
  'motorcycle', 'B1234XYZ', 'hitam',
  'SIM123456', '/uploads/sim124.jpg',
  'both', 'pending'
);
```

---

## ✅ Success Criteria

- [ ] Database schema updated (ENUM + nullable columns)
- [ ] Bike registration succeeds without license
- [ ] Motor registration requires license
- [ ] No error "selfie and license photo are required" for bike
- [ ] Data successfully inserted to `independent_drivers` table
- [ ] User can login dengan nomor HP setelah registrasi

---

**Status:** 🟡 Waiting for database schema update
