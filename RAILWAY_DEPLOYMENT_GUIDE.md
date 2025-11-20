# Railway API Deployment Guide

## 🚀 Deployment Information

**Production URL:** https://travel-api-production-23ae.up.railway.app  
**Platform:** Railway  
**Runtime:** Node.js  
**Database:** MySQL (Internal)  
**Port:** 3000

---

## 📋 Environment Variables Setup

Konfigurasi berikut di Railway Dashboard → Variables:

```env
# Database Configuration
MYSQLHOST=mysql.railway.internal
MYSQLPORT=3306
MYSQLUSER=root
MYSQLPASSWORD=[your-mysql-password]
MYSQLDATABASE=railway

# Server Configuration
PORT=3000
NODE_ENV=production

# Optional: API Keys, JWT Secret, etc.
JWT_SECRET=[your-jwt-secret]
```

### Cara Set Environment Variables di Railway:
1. Buka project di Railway Dashboard
2. Klik tab "Variables"
3. Klik "New Variable"
4. Masukkan key dan value
5. Klik "Add" untuk setiap variable
6. Railway akan auto-restart service setelah perubahan

---

## 🗄️ Database Schema

### Tables Structure

```sql
-- 1. users (base authentication)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('customer', 'driver', 'po', 'student') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. pos (travel operators)
CREATE TABLE pos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    office_address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    rating DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. vehicles
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    po_id INT NOT NULL,
    vehicle_number VARCHAR(50) NOT NULL,
    vehicle_type ENUM('bus', 'minibus', 'travel') NOT NULL,
    capacity INT NOT NULL,
    amenities TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES pos(id)
);

-- 4. travels
CREATE TABLE travels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    po_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    departure_date DATE NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    available_seats INT NOT NULL,
    status ENUM('scheduled', 'ongoing', 'completed', 'cancelled') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES pos(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 5. bookings
CREATE TABLE bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    travel_id INT NOT NULL,
    user_id INT NOT NULL,
    passenger_name VARCHAR(255) NOT NULL,
    passenger_phone VARCHAR(20) NOT NULL,
    seat_numbers VARCHAR(255) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    pickup_location VARCHAR(255),
    dropoff_location VARCHAR(255),
    payment_status ENUM('pending', 'paid', 'cancelled') DEFAULT 'pending',
    booking_status ENUM('confirmed', 'cancelled', 'completed') DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (travel_id) REFERENCES travels(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 6. drivers
CREATE TABLE drivers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    license_number VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    po_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (po_id) REFERENCES pos(id)
);

-- 7. students
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    student_id VARCHAR(50) NOT NULL,
    university VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8. po_admins
CREATE TABLE po_admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    po_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (po_id) REFERENCES pos(id)
);

-- 9. vehicle_schedules
CREATE TABLE vehicle_schedules (
    id INT PRIMARY KEY AUTO_INCREMENT,
    vehicle_id INT NOT NULL,
    day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
    departure_time TIME NOT NULL,
    route_origin VARCHAR(255) NOT NULL,
    route_destination VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 10. po_reviews (created by server.js)
CREATE TABLE po_reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    po_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (po_id) REFERENCES pos(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 11. booking_seats (created by server.js)
CREATE TABLE booking_seats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    booking_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    passenger_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(id),
    UNIQUE KEY unique_booking_seat (booking_id, seat_number)
);
```

---

## 🔄 Migration & Seeding

### Auto Migration
Server otomatis menjalankan migrations saat startup:
- `migrations/00_create_base_tables.sql` - Creates base tables
- `server.js` - Creates additional tables (po_reviews, booking_seats)

### Manual Seeding
Jika perlu seed data baru:

```bash
# Connect to Railway MySQL
railway connect mysql

# Run seeding script
node migrations/seed_railway_data.js
```

### Seed Data yang Sudah Ada:
- 7 users dengan berbagai roles
- 3 PO operators (Sinar Jaya, Kramat Djati, Eka)
- 40+ vehicles (bus & minibus)
- Multiple travel schedules
- Sample bookings

---

## 🔍 Testing Endpoints

### Health Check
```bash
curl https://travel-api-production-23ae.up.railway.app/health
# Response: {"status":"OK"}
```

### Customer Endpoints
```bash
# Get POs by route
curl "https://travel-api-production-23ae.up.railway.app/api/customer/pos-by-route?origin=Jakarta&destination=Bandung"

# Get available travels
curl "https://travel-api-production-23ae.up.railway.app/api/customer/travels?origin=Jakarta&destination=Bandung&date=2025-11-18"

# Login customer
curl -X POST https://travel-api-production-23ae.up.railway.app/api/customer/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer1@example.com","password":"password123"}'
```

### PO Endpoints
```bash
# Get vehicles for PO
curl https://travel-api-production-23ae.up.railway.app/api/po/1/vehicles

# Get travels for PO
curl https://travel-api-production-23ae.up.railway.app/api/po/1/travels

# PO login
curl -X POST https://travel-api-production-23ae.up.railway.app/api/po/login \
  -H "Content-Type: application/json" \
  -d '{"email":"po1@example.com","password":"password123"}'
```

### Student Endpoints
```bash
# Student login
curl -X POST https://travel-api-production-23ae.up.railway.app/api/student/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student1@example.com","password":"password123"}'

# Get student bookings
curl https://travel-api-production-23ae.up.railway.app/api/student/1/bookings
```

---

## 🐛 Troubleshooting

### Issue: Database Connection Error
```
Error: getaddrinfo ENOTFOUND ${MYSQLHOST}
```
**Solution:** Check environment variables di Railway, pastikan tidak ada literal `${VAR}` syntax

### Issue: 502 Bad Gateway
**Possible Causes:**
1. Server belum start (check logs)
2. Port mismatch (harus 3000)
3. Health check endpoint tidak response

**Solution:**
```bash
# Check Railway logs
railway logs

# Verify PORT env var is set to 3000
# Restart service if needed
```

### Issue: Foreign Key Constraint Failed
**Solution:** Pastikan base tables sudah dibuat sebelum seeding:
```bash
# Check if tables exist
railway connect mysql
SHOW TABLES;
DESCRIBE users;
```

### Issue: Migration Fails on Startup
**Solution:** Check `server.js` migration logic dan `migrations/00_create_base_tables.sql` syntax

---

## 📊 Monitoring

### Railway Dashboard
- **Logs:** Lihat real-time logs di Railway dashboard
- **Metrics:** CPU, Memory, Network usage
- **Deployments:** History of deployments

### Health Monitoring
Setup automated health checks:
```bash
# Cron job atau monitoring service
*/5 * * * * curl -f https://travel-api-production-23ae.up.railway.app/health || alert
```

### Database Monitoring
```sql
-- Check table sizes
SELECT 
    table_name,
    ROUND(((data_length + index_length) / 1024 / 1024), 2) AS "Size (MB)"
FROM information_schema.TABLES
WHERE table_schema = "railway"
ORDER BY (data_length + index_length) DESC;

-- Check row counts
SELECT 
    table_name,
    table_rows
FROM information_schema.TABLES
WHERE table_schema = "railway";
```

---

## 🔐 Security Best Practices

1. **Environment Variables**
   - Jangan commit `.env` ke Git
   - Gunakan Railway env vars untuk production
   - Rotate passwords secara berkala

2. **Database Access**
   - Gunakan internal hostname (mysql.railway.internal)
   - Limit public access jika tidak perlu
   - Enable SSL/TLS untuk connections

3. **API Security**
   - Implement rate limiting
   - Add CORS configuration
   - Use helmet.js for security headers
   - Implement JWT authentication properly

4. **Logging**
   - Jangan log sensitive data (passwords, tokens)
   - Implement structured logging
   - Monitor error rates

---

## 🚀 Deployment Process

### Initial Deployment
1. Push code ke GitHub
2. Connect Railway ke GitHub repo
3. Set environment variables
4. Railway auto-deploy on push

### Updates & Rollback
```bash
# Railway will auto-deploy on git push
git push origin main

# Rollback to previous deployment
# Use Railway dashboard → Deployments → Rollback
```

### Manual Deployment via Railway CLI
```bash
# Install Railway CLI
npm install -g railway

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

---

## 📞 Support Resources

- Railway Docs: https://docs.railway.app
- Express.js Guide: https://expressjs.com/en/guide
- MySQL Docs: https://dev.mysql.com/doc/
- Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices

---

*Last Updated: 19 November 2025*
