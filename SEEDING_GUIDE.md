# Database Seeding Guide

## 📋 Overview

Script untuk populate database dengan initial data (PO, vehicles, users, travels, dll).

## 🚀 Cara Seeding Railway MySQL

### Opsi 1: Dari Railway Console (Recommended)

1. Buka Railway Dashboard → Project `travel-api`
2. Pilih service `travel-api` 
3. Buka tab **Settings** → scroll ke **Custom Start Command**
4. Temporary ganti start command dengan:
   ```bash
   npm run seed:railway && npm start
   ```
5. Klik **Deploy** 
6. Check logs - seharusnya muncul:
   ```
   ✅ Connected to Railway MySQL
   ✅ Users created
   ✅ POs created
   ...
   🎉 Railway database seeded successfully!
   ```
7. **IMPORTANT**: Kembalikan start command ke `npm start` setelah seeding berhasil!

### Opsi 2: Dari Local dengan Railway CLI

```bash
# Install Railway CLI (jika belum)
npm i -g @railway/cli

# Login ke Railway
railway login

# Link ke project
railway link

# Run seeding dengan Railway env vars
railway run npm run seed:railway
```

### Opsi 3: Manual dengan Railway MySQL URL

1. Buka Railway → MySQL service → **Connect** tab
2. Copy MySQL connection URL atau individual variables
3. Set di local `.env`:
   ```env
   MYSQLHOST=your-railway-mysql-host
   MYSQLUSER=root
   MYSQLPASSWORD=your-password
   MYSQLDATABASE=railway
   MYSQLPORT=3306
   ```
4. Run seeding:
   ```bash
   npm run seed:railway
   ```

## 🏠 Seeding Local Database

Jika ingin seeding ke database local:

```bash
# Pastikan MySQL local running
# Update .env dengan config local:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=travel_booking
DB_PORT=3306

# Run seeding
npm run seed:local
```

## 📝 Data yang di-seed

### Users (7 total)
- 3 PO Admins: `admin1@po.com`, `admin2@po.com`, `admin3@po.com` / password: `admin123`
- 2 Drivers: `driver1@mail.com`, `driver2@mail.com` / password: `driver123`
- 2 Students: `student1@mail.com`, `student2@mail.com` / password: `student123`

### POs (3 total)
- Prima Jaya Travel
- Sinar Dunia Transport
- Harapan Jaya Express

### Vehicles (4 total)
- Bus Mercedes (50 seats)
- Mini Bus Isuzu (20 seats)
- Bus Hino (45 seats)
- Van Toyota Hiace (15 seats)

### Vehicle Schedules
- Multiple routes: Jakarta-Bandung, Jakarta-Surabaya, Bandung-Jakarta, Yogyakarta

### Sample Travels (3 scheduled)
- Jakarta → Bandung (Rp 150,000)
- Jakarta → Surabaya (Rp 300,000)
- Bandung → Jakarta (Rp 150,000)

## ✅ Verifikasi Seeding Berhasil

Test dengan hit API endpoints:

```bash
# Get all POs
curl https://your-railway-url.up.railway.app/api/student/search-po?from=Jakarta&to=Bandung

# Get vehicles
curl https://your-railway-url.up.railway.app/api/student/vehicles-by-schedule?destination=Bandung

# Get travels
curl https://your-railway-url.up.railway.app/api/student/travels
```

## 🔧 Troubleshooting

### Error: "Unknown database 'railway'"
- Database name salah. Check Railway MySQL → Variables → `MYSQLDATABASE`
- Update value di `migrations/seed_railway_data.js` jika perlu

### Error: "Access denied"
- Password atau user salah. Verify Railway MySQL credentials

### Error: "Cannot find module 'bcryptjs'"
- Install dependencies: `npm install`

### Foreign key constraint fails
- Base tables belum dibuat. Server otomatis create base tables saat startup
- Atau jalankan manual: `npm run migrate:base`

## 📌 Notes

- Script menggunakan `INSERT IGNORE` jadi aman di-run multiple kali (tidak akan duplicate)
- Setelah seeding, Railway API siap digunakan oleh Flutter app
- Default passwords di atas hanya untuk development/testing
