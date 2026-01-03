# 🔄 DRIVER REGISTRATION - AUTO USER CREATION

## ✅ Update Terbaru (Dec 21, 2025 - 16:05)

**Backend sudah di-update** untuk support **2 scenario registrasi driver**:

---

## 📊 **2 TABEL YANG DI-INSERT**

### **Scenario 1: Driver Baru (Belum Punya Akun)**

Ketika driver **baru pertama kali** daftar:

```
1. INSERT ke table: customers
   ├─ full_name
   ├─ phone (untuk login)
   ├─ email
   ├─ password (hashed dengan bcrypt)
   ├─ email_verified: 1 (langsung verified)
   └─ is_active: 1 (langsung aktif)

2. INSERT ke table: independent_drivers
   ├─ user_id (dari customers.id yang baru dibuat)
   ├─ Data KTP (NIK, nama, alamat, dll)
   ├─ Data kendaraan
   ├─ Data SIM (conditional)
   ├─ Data bank
   └─ status: 'pending'
```

**Total: 2 INSERT statements dalam 1 transaction**

---

### **Scenario 2: User Existing (Sudah Punya Akun)**

Ketika user **sudah punya akun**, lalu daftar jadi driver:

```
1. SKIP (customers sudah ada)

2. INSERT ke table: independent_drivers
   ├─ user_id (dari parameter)
   ├─ Data lengkap driver
   └─ status: 'pending'
```

**Total: 1 INSERT statement**

---

## 🔑 **Parameter API yang Berubah**

### **Before:**
```javascript
{
  user_id: REQUIRED,     // Harus sudah ada user
  full_name: REQUIRED,
  phone: REQUIRED,
  email: REQUIRED,
  password: NOT ACCEPTED,
  vehicle_type: REQUIRED,
  // ... other fields
}
```

### **After:**
```javascript
{
  user_id: OPTIONAL,      // Jika tidak ada, auto-create user
  full_name: REQUIRED,
  phone: REQUIRED,
  email: REQUIRED,
  password: REQUIRED (jika user_id kosong),
  vehicle_type: REQUIRED,
  // ... other fields
}
```

---

## 🧪 **Testing Scenario**

### **Test 1: Driver Baru (No user_id)**

**Request:**
```json
{
  "full_name": "Ahmad Driver Baru",
  "phone": "081234567890",
  "email": "ahmad.driver@email.com",
  "password": "password123",
  "vehicle_type": "motorcycle",
  "vehicle_plate": "B1234XYZ",
  "license_number": "SIM123456",
  "bank_name": "BCA",
  "bank_account_number": "1234567890",
  "bank_account_holder": "AHMAD DRIVER BARU",
  "ktp_photo": [FILE],
  "license_photo": [FILE]
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Account created and driver registration successful",
  "driver": {
    "id": 1,
    "user_id": 123,  // Auto-created
    "full_name": "Ahmad Driver Baru",
    "vehicle_type": "motorcycle",
    "status": "pending"
  }
}
```

**Database Changes:**
- ✅ 1 row baru di `customers` (user_id: 123)
- ✅ 1 row baru di `independent_drivers` (driver_id: 1, user_id: 123)

---

### **Test 2: User Existing (With user_id)**

**Request:**
```json
{
  "user_id": 456,  // Sudah punya akun
  "full_name": "Budi Driver Existing",
  "phone": "081234567891",
  "email": "budi@email.com",
  "vehicle_type": "bike",
  "vehicle_color": "merah",
  "bank_name": "Mandiri",
  "bank_account_number": "9876543210",
  "bank_account_holder": "BUDI DRIVER EXISTING",
  "ktp_photo": [FILE]
}
```

**Expected Result:**
```json
{
  "success": true,
  "message": "Driver registration successful",
  "driver": {
    "id": 2,
    "user_id": 456,  // From parameter
    "vehicle_type": "bike",
    "status": "pending"
  }
}
```

**Database Changes:**
- ⏭️ Skip `customers` (sudah ada)
- ✅ 1 row baru di `independent_drivers` (driver_id: 2, user_id: 456)

---

## 🔒 **Validasi & Security**

### **1. Phone Number Uniqueness**
```javascript
// Check di table customers
SELECT id FROM customers WHERE phone = ?

// Jika ada → Error: "Phone number already registered"
```

### **2. Email Uniqueness**
```javascript
// Check di table customers
SELECT id FROM customers WHERE email = ?

// Jika ada → Error: "Email already registered"
```

### **3. Driver Already Registered**
```javascript
// Check di table independent_drivers
SELECT id FROM independent_drivers WHERE user_id = ?

// Jika ada → Error: "User already registered as driver"
```

### **4. Password Hashing**
```javascript
const bcrypt = require('bcryptjs');
const hashedPassword = await bcrypt.hash(password, 10);
```

### **5. Transaction Safety**
```javascript
await connection.beginTransaction();
// ... INSERT ke customers
// ... INSERT ke independent_drivers
await connection.commit();

// Jika error:
await connection.rollback();
```

---

## 📝 **Flutter App Update (Tidak Perlu)**

Flutter app **TIDAK PERLU update** karena:
- ✅ Parameter `user_id` sudah optional di Flutter code
- ✅ Parameter `password` bisa ditambahkan jika user belum login
- ✅ API backward compatible (user_id tetap diterima)

**Yang perlu update di Flutter:**
- Jika user **belum login**, tampilkan field **password**
- Jika user **sudah login**, skip field password, kirim `user_id`

---

## 🚀 **Login Flow Setelah Registrasi**

### **Driver Baru:**
```
1. User install app
2. Buka "Daftar Sebagai Driver"
3. Isi form + upload foto
4. Masukkan password
5. Klik "DAFTAR"
   → Backend create user account di `customers`
   → Backend create driver di `independent_drivers`
6. Success → Auto login dengan phone + password
7. Status: "pending" (tunggu verifikasi admin)
```

### **User Existing:**
```
1. User sudah punya akun (customer)
2. Login dengan phone + password
3. Buka "Daftar Sebagai Driver"
4. Isi form + upload foto
5. Klik "DAFTAR" (no password needed)
   → Backend skip user creation
   → Backend create driver di `independent_drivers`
6. Success → Continue as logged in user
7. Status: "pending" (tunggu verifikasi admin)
```

---

## 📊 **Database Schema**

### **Table: customers**
```sql
CREATE TABLE customers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  email_verified TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Table: independent_drivers**
```sql
CREATE TABLE independent_drivers (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  -- ... 30+ other fields
  status ENUM('pending', 'active', 'inactive') DEFAULT 'pending',
  is_verified BOOLEAN DEFAULT FALSE,
  
  FOREIGN KEY (user_id) REFERENCES customers(id)
);
```

---

## ✅ **Status Update**

**Backend API:** ✅ Deployed (Git commit: 11068a1)

**Changes:**
1. ✅ `user_id` now optional
2. ✅ `password` required if no `user_id`
3. ✅ Auto-create user in `customers` table
4. ✅ Transaction support (rollback on error)
5. ✅ Phone & email uniqueness validation
6. ✅ Success message different for new vs existing user

**API URL:** https://travel-api-production-23ae.up.railway.app

**Endpoint:** POST /api/on-demand/driver/register

**Last Updated:** Dec 21, 2025 16:05 WIB

---

## 🎯 **Next Steps**

1. ✅ Database schema updated (wheels/skateboard support)
2. ✅ Backend API updated (auto-create user)
3. ⏳ Test dengan Flutter app (existing APK should work)
4. ⏳ Verify data masuk ke kedua tabel

**Ready for testing!** 🚀
