# 📊 ON-DEMAND DRIVER SYSTEM - DATABASE DOCUMENTATION

## Overview
Sistem ini menggunakan **11 tabel** yang saling terintegrasi untuk mendukung fitur on-demand ride, komisi fleksibel, dan diskon.

---

## 🔑 KEY FEATURES

### 1. **Driver Management** (`independent_drivers`, `driver_locations`)
- Driver bisa daftar langsung dari app
- Real-time GPS tracking
- Rating & earnings tracking

### 2. **Trip Management** (`on_demand_trips`, `driver_earnings`)
- Request trip → find nearest driver (radius 1km)
- Track status: searching → accepted → in_transit → completed
- Auto-calculate earnings breakdown

### 3. **Flexible Commission System** (`service_types`, `commission_configs`, `pricing_details`, `commission_breakdown`)
- Support multiple service types (hantar pulang, on-demand, antar paket, dll)
- Commission bisa percentage atau fixed
- Tax configurable per commission
- **Reusable untuk service baru tanpa ALTER TABLE**

### 4. **Discount System** (`discounts`, `discount_usage`)
- Global discount atau PO-specific
- Usage limits (per user & total)
- Validity period
- **Works for all service types**

### 5. **Withdrawal System** (`driver_withdrawals`)
- Daily withdrawal requests
- Bank transfer tracking
- Status: pending → processing → completed

---

## 📋 TABLE DESCRIPTIONS

### 1. `independent_drivers`
**Purpose:** Master data driver yang daftar langsung (bukan via PO)

**Key Columns:**
- `id` - Primary key, auto increment
- `user_id` - Link ke tabel users (untuk login)
- `vehicle_type` - bike/motorcycle/car/truck
- `rating` - Rating 1-5 (default 5.0)
- `status` - pending/active/inactive/offline
- `is_verified` - Apakah sudah diverifikasi admin

**Example Data:**
```sql
INSERT INTO independent_drivers 
(user_id, full_name, phone, email, vehicle_type, vehicle_plate, license_number, status, is_verified)
VALUES
(100, 'Budi Driver', '08123456789', 'budi@mail.com', 'motorcycle', 'B 1234 CD', 'SIM123456', 'active', TRUE);
```

---

### 2. `driver_locations`
**Purpose:** Real-time GPS tracking driver

**Key Columns:**
- `driver_id` - UNIQUE (1 driver = 1 current location)
- `latitude`, `longitude` - GPS coordinates
- `is_online` - TRUE = tersedia, FALSE = offline
- `updated_at` - Auto-update setiap GPS sync

**Update Frequency:** Every 5-10 seconds from driver app

**Example Query - Find Drivers Within 1km:**
```sql
SELECT d.full_name, d.rating, dl.latitude, dl.longitude,
  (6371 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS((dl.latitude - -6.2088) / 2)), 2) +
    COS(RADIANS(-6.2088)) * COS(RADIANS(dl.latitude)) * 
    POWER(SIN(RADIANS((dl.longitude - 106.8456) / 2)), 2)
  ))) as distance_km
FROM independent_drivers d
JOIN driver_locations dl ON d.id = dl.driver_id
WHERE d.status = 'active' AND dl.is_online = TRUE
HAVING distance_km < 1
ORDER BY distance_km ASC;
```

---

### 3. `on_demand_trips`
**Purpose:** Track trip lifecycle dari request sampai selesai

**Status Flow:**
```
searching → accepted → arrived_pickup → in_transit → arrived_dropoff → completed
                                ↓
                            cancelled
```

**Key Columns:**
- `customer_id` - Who requested
- `driver_id` - Who accepted (NULL = still searching)
- `pickup_lat/lng` - Pickup coordinates
- `dropoff_lat/lng` - Dropoff coordinates
- `status` - Current trip status
- `total_fare` - Total before commission

**Pricing Calculation:**
```
total_fare = base_fare + (distance_km * per_km_rate) + (duration_minutes * per_minute_rate)
```

---

### 4. `driver_earnings`
**Purpose:** Breakdown pendapatan driver per trip

**Calculation:**
```
driver_earnings = gross_amount - app_commission_amount - tax_amount
```

**Key Columns:**
- `gross_amount` - Total yang customer bayar
- `app_commission_percentage` - % komisi platform
- `app_commission_amount` - Nominal komisi
- `driver_earnings` - **AUTO CALCULATED** (GENERATED column)
- `payment_status` - unpaid/pending/paid

---

### 5. `driver_withdrawals`
**Purpose:** Request withdrawal earnings ke bank

**Workflow:**
1. Driver request withdrawal
2. Admin review (`status='pending'`)
3. Admin process transfer (`status='processing'`)
4. Transfer completed (`status='completed'`, `completed_at` set)

---

### 6. `service_types`
**Purpose:** Master data semua jenis layanan

**Pre-populated Services:**
```sql
INSERT INTO service_types (service_code, service_name, service_category, pricing_model, base_fare) VALUES
('hantar_pulang', 'Hantar Pulang', 'scheduled', 'fixed', 0),
('on_demand_ride', 'Cari Driver Terdekat', 'on_demand', 'per_km_minute', 5000),
('antar_paket', 'Antar Paket', 'delivery', 'per_km', 3000),
('hantar_barang', 'Hantar Barang', 'scheduled', 'per_km', 0);
```

**Adding New Service:**
```sql
INSERT INTO service_types (service_code, service_name, service_category, pricing_model, base_fare)
VALUES ('sewa_mobil_harian', 'Sewa Mobil Harian', 'rental', 'fixed', 300000);
```

---

### 7. `commission_configs`
**Purpose:** Aturan komisi per service type (FLEXIBLE!)

**Example - On-Demand Ride Commission:**
```sql
-- Platform gets 10%
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, is_active, effective_from)
VALUES
(2, 'app', 'Platform Fee', 'percentage', 10, TRUE, CURDATE());

-- Driver gets 90%
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, is_active, effective_from)
VALUES
(2, 'driver', 'Driver Earnings', 'percentage', 90, TRUE, CURDATE());
```

**Tiered Commission Example:**
```sql
-- Rp 0-50k: 15% commission
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, min_amount, max_amount, effective_from)
VALUES
(2, 'app', 'Platform Fee (Tier 1)', 'percentage', 15, 0, 50000, CURDATE());

-- Rp 50k+: 10% commission
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, min_amount, effective_from)
VALUES
(2, 'app', 'Platform Fee (Tier 2)', 'percentage', 10, 50000, NULL, CURDATE());
```

---

### 8. `pricing_details`
**Purpose:** Universal breakdown harga untuk SEMUA transaksi

**Key Columns:**
- `transaction_type` - booking/on_demand_trip/delivery
- `transaction_id` - ID dari tabel transaksi
- `service_type_id` - Jenis service
- `base_amount` - Harga dasar
- `distance_fare` - Biaya jarak
- `duration_fare` - Biaya durasi
- `discount_amount` - Potongan diskon
- `subtotal` - **AUTO CALCULATED**

---

### 9. `commission_breakdown`
**Purpose:** Actual komisi yang dihitung per transaksi

**Example Calculation for Rp 50,000 trip:**
```
Customer pays: Rp 50,000
Platform (10%): Rp 5,000
Driver (90%): Rp 45,000
```

Stored as:
```sql
INSERT INTO commission_breakdown 
(pricing_detail_id, commission_config_id, party_type, party_name, commission_percentage, commission_base_amount, commission_amount)
VALUES
(1, 1, 'app', 'Platform Fee', 10, 50000, 5000),
(1, 2, 'driver', 'Driver Earnings', 90, 50000, 45000);
```

---

### 10. `discounts`
**Purpose:** Master data diskon (reusable for all services)

**Example - Global 20% Discount:**
```sql
INSERT INTO discounts 
(service_type_id, po_id, discount_code, discount_name, discount_type, discount_value, 
 min_transaction_amount, max_discount_amount, valid_from, valid_until, max_usage_total, status)
VALUES
(NULL, NULL, 'PROMO20', 'Diskon 20% Semua Service', 'percentage', 20, 
 0, 20000, '2025-12-21', '2025-12-31', 100, 'active');
```

**Example - PO Specific Discount:**
```sql
INSERT INTO discounts 
(service_type_id, po_id, discount_code, discount_name, discount_type, discount_value, 
 valid_from, valid_until, status)
VALUES
(2, 5, 'POHANDRA10', 'Diskon PO Handra 10%', 'percentage', 10, 
 '2025-12-21', '2025-12-31', 'active');
```

---

### 11. `discount_usage`
**Purpose:** Track siapa pakai diskon apa

**Key Columns:**
- `discount_id` - Which discount
- `pricing_detail_id` - Which transaction
- `customer_id` - Who used it
- `discount_amount` - Actual discount given

**Check Usage:**
```sql
SELECT c.full_name, d.discount_code, du.discount_amount, du.used_at
FROM discount_usage du
JOIN discounts d ON du.discount_id = d.id
JOIN customers c ON du.customer_id = c.id
WHERE d.discount_code = 'PROMO20'
ORDER BY du.used_at DESC;
```

---

## 🔄 TRANSACTION FLOW EXAMPLE

### Scenario: Customer Request On-Demand Ride

**Step 1: Customer Request Trip**
```sql
-- Insert trip request
INSERT INTO on_demand_trips 
(customer_id, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, total_fare, status)
VALUES
(10, -6.2088, 106.8456, 'Monas Jakarta', -6.2215, 106.8001, 'Grand Indonesia', 45000, 'searching');

-- Get trip_id = 100
```

**Step 2: Find Nearest Driver (Backend Logic)**
```sql
SELECT d.id as driver_id, d.full_name, d.rating,
  (6371 * 2 * ASIN(SQRT(...))) as distance_km
FROM independent_drivers d
JOIN driver_locations dl ON d.id = dl.driver_id
WHERE d.status = 'active' AND dl.is_online = TRUE
HAVING distance_km < 1
ORDER BY distance_km ASC
LIMIT 5;
```

**Step 3: Driver Accept Trip**
```sql
UPDATE on_demand_trips 
SET driver_id = 25, status = 'accepted', accepted_at = NOW()
WHERE id = 100;
```

**Step 4: Trip Completed**
```sql
UPDATE on_demand_trips 
SET status = 'completed', completed_at = NOW(), distance_km = 5.2, duration_minutes = 18
WHERE id = 100;
```

**Step 5: Calculate Pricing**
```sql
-- Insert pricing details
INSERT INTO pricing_details 
(transaction_type, transaction_id, service_type_id, base_amount, distance_km, duration_minutes, distance_fare, duration_fare)
VALUES
('on_demand_trip', 100, 2, 5000, 5.2, 18, 13000, 3600);
-- subtotal = 5000 + 13000 + 3600 = 21600

-- Get pricing_detail_id = 50
```

**Step 6: Calculate Commissions**
```sql
-- Platform commission (10%)
INSERT INTO commission_breakdown 
(pricing_detail_id, commission_config_id, party_type, party_name, commission_percentage, commission_base_amount, commission_amount)
VALUES
(50, 1, 'app', 'Platform Fee', 10, 21600, 2160);

-- Driver earnings (90%)
INSERT INTO commission_breakdown 
(pricing_detail_id, commission_config_id, party_type, party_name, commission_percentage, commission_base_amount, commission_amount)
VALUES
(50, 2, 'driver', 'Driver Earnings', 90, 21600, 19440);
```

**Step 7: Record Driver Earnings**
```sql
INSERT INTO driver_earnings 
(driver_id, trip_id, gross_amount, app_commission_percentage, app_commission_amount, tax_amount, payment_status)
VALUES
(25, 100, 21600, 10, 2160, 0, 'unpaid');
-- driver_earnings = 21600 - 2160 - 0 = Rp 19,440 (AUTO CALCULATED)
```

---

## 📊 USEFUL QUERIES

### 1. **Dashboard Driver - Show Earnings Today**
```sql
SELECT 
  SUM(de.driver_earnings) as today_earnings,
  COUNT(de.trip_id) as trips_today,
  AVG(t.customer_rating) as avg_rating
FROM driver_earnings de
JOIN on_demand_trips t ON de.trip_id = t.id
WHERE de.driver_id = 25
  AND DATE(de.created_at) = CURDATE()
  AND t.status = 'completed';
```

### 2. **Find Available Drivers Near Location**
```sql
SELECT d.id, d.full_name, d.vehicle_type, d.rating, dl.latitude, dl.longitude
FROM independent_drivers d
JOIN driver_locations dl ON d.id = dl.driver_id
WHERE d.status = 'active' 
  AND d.is_verified = TRUE
  AND dl.is_online = TRUE
ORDER BY RAND()
LIMIT 10;
```

### 3. **Commission Report by Service**
```sql
SELECT 
  st.service_name,
  COUNT(DISTINCT pd.id) as total_transactions,
  SUM(pd.subtotal) as total_revenue,
  SUM(cb.commission_amount) as total_commission
FROM service_types st
JOIN pricing_details pd ON st.id = pd.service_type_id
JOIN commission_breakdown cb ON pd.id = cb.pricing_detail_id
WHERE cb.party_type = 'app'
  AND DATE(pd.created_at) >= '2025-12-01'
GROUP BY st.id
ORDER BY total_revenue DESC;
```

### 4. **Pending Withdrawals**
```sql
SELECT 
  d.full_name,
  d.phone,
  dw.withdrawal_amount,
  dw.requested_at,
  d.bank_name,
  d.bank_account_number
FROM driver_withdrawals dw
JOIN independent_drivers d ON dw.driver_id = d.id
WHERE dw.status = 'pending'
ORDER BY dw.requested_at ASC;
```

---

## 🚀 ADDING NEW SERVICE TYPE

### Example: Add "Sewa Mobil Harian"

**Step 1: Add Service Type**
```sql
INSERT INTO service_types 
(service_code, service_name, service_category, pricing_model, base_fare)
VALUES
('sewa_mobil_harian', 'Sewa Mobil Harian', 'rental', 'fixed', 300000);
-- Returns service_type_id = 8
```

**Step 2: Configure Commissions**
```sql
-- Platform 5% commission
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, effective_from)
VALUES
(8, 'app', 'Platform Fee - Rental', 'percentage', 5, CURDATE());

-- Partner (rental company) 70%
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, effective_from)
VALUES
(8, 'partner', 'Rental Company Share', 'percentage', 70, CURDATE());

-- Driver 25%
INSERT INTO commission_configs 
(service_type_id, party_type, party_name, commission_type, commission_value, effective_from)
VALUES
(8, 'driver', 'Driver Commission', 'percentage', 25, CURDATE());
```

**Step 3: Add Discount (Optional)**
```sql
INSERT INTO discounts 
(service_type_id, discount_code, discount_name, discount_type, discount_value, 
 valid_from, valid_until, max_usage_total, status)
VALUES
(8, 'RENTAL10', 'Diskon Sewa Mobil 10%', 'percentage', 10, 
 '2025-12-21', '2026-01-31', -1, 'active');
```

**DONE! No ALTER TABLE needed!** ✅

---

## ✨ BENEFITS OF THIS ARCHITECTURE

1. **Flexible Commission** - Ubah % komisi tanpa code change
2. **Multi-Service Support** - Tambah service baru tanpa ALTER TABLE
3. **Audit Trail** - Track semua perubahan komisi dengan `effective_from/until`
4. **Discount Flexibility** - Buat diskon global/PO-specific/service-specific
5. **Scalable** - Support tiered pricing, seasonal rates, dll
6. **Query-able** - Easy generate reports & analytics

---

## 📝 NEXT STEPS

1. Run `setup_on_demand_tables.sql` di Railway MySQL
2. Test insert dummy data
3. Build API endpoints untuk:
   - Driver registration
   - Location tracking
   - Trip request/accept
   - Earnings calculation
4. Build Flutter UI untuk customer & driver app
5. Setup WebSocket untuk real-time updates

---

Generated: December 21, 2025
