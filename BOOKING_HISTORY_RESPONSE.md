# Booking History Response Documentation

## UI Flow
```
Customer App → Tap "Riwayat" Tab (index 2)
                ↓
        BookingHistoryScreen initiated
                ↓
        initState() → _loadBookingHistory()
                ↓
        ApiService.getCustomerBookings(customerId)
                ↓
        HTTP GET /api/customer/bookings/29
                ↓
        Backend Query Runs
                ↓
        Response JSON returned
                ↓
        setState() → _bookings = response['data']
                ↓
        UI renders booking cards
```

---

## Expected Response Format

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "travel_id": 5,
      "customer_id": 29,
      "student_id": null,
      "booking_status": "confirmed",
      "pickup_lat": "-6.2088",
      "pickup_lng": "106.8456",
      "pickup_location": "Jakarta Pusat",
      "pickup_address": "Jl. Sudirman No. 123",
      "dropoff_lat": "-6.2156",
      "dropoff_lng": "106.8652",
      "dropoff_location": "Jakarta Selatan",
      "dropoff_address": "Jl. Gatot Subroto No. 456",
      "booking_date": "2026-02-15 10:30:00",
      "total_price": "150000",
      "payment_method": "QRIS",
      "payment_status": "PAID",
      "origin": "Stasiun Kota",
      "destination": "Grand Indonesia",
      "departure_time": "2026-02-16 14:00:00",
      "vehicle_number": "B 1234 ABC",
      "vehicle_type": "sedan",
      "po_name": "PT. Travel Jaya",
      "seats": "A1,A2"
    },
    {
      "id": 2,
      "travel_id": 6,
      "customer_id": 29,
      "student_id": null,
      "booking_status": "pending",
      "pickup_lat": "-6.1750",
      "pickup_lng": "106.8272",
      "pickup_location": "Jakarta Barat",
      "pickup_address": "Jl. Hayam Wuruk No. 789",
      "dropoff_lat": "-6.2088",
      "dropoff_lng": "106.8456",
      "dropoff_location": "Jakarta Pusat",
      "dropoff_address": "Jl. Sudirman No. 100",
      "booking_date": "2026-02-16 08:15:00",
      "total_price": "120000",
      "payment_method": "CASH",
      "payment_status": "UNPAID",
      "origin": "Bandara Soetta",
      "destination": "Hotel Borobudur",
      "departure_time": "2026-02-17 09:00:00",
      "vehicle_number": "B 5678 XYZ",
      "vehicle_type": "mpv",
      "po_name": "PT. Antar Jaya",
      "seats": "B1"
    }
  ]
}
```

---

## Fields Used in UI

| Field | UI Component | Purpose |
|-------|--------------|---------|
| `po_name` | Header | Show travel company name (blue, 18px bold) |
| `booking_status` / `status` | Status Badge | Show booking status (pending/confirmed/cancelled) with color |
| `origin` | Location Row | Show "from" location |
| `destination` | Location Row | Show "to" location |
| `departure_time` | Date Row | Show departure date (split by 'T')[0] |
| `booking_date` | Date Row | Fallback if departure_time missing |
| `seats` | Seats Row | Show booked seats (e.g., "A1, A2") |
| `num_passengers` | Seats Row | Fallback if seats missing |
| `total_price` | Price Row | Show total payment in Rp format |
| `travel_id` | Live Tracking Button | Navigate to tracking screen |
| `id` | Live Tracking Button | Pass bookingId to tracking |
| `pickup_lat` | Live Tracking Button | Show on map |
| `pickup_lng` | Live Tracking Button | Show on map |

---

## Current Query Issues

### ❌ BROKEN COLUMNS (causing 500 error):
1. `b.seat_number` → Column not in bookings table
2. `b.status` → Should be `b.booking_status`
3. `t.departure_date` → Column not in travels table (only `departure_time`)

### ✅ CORRECT COLUMNS:
- `b.booking_status` (instead of `b.status`)
- `b.payment_method` (for showing payment type)
- `b.payment_status` (for showing if paid)
- `t.departure_time` (includes both date and time)
- `seats` from GROUP_CONCAT(bs.seat_number)

---

## Corrected Query

```sql
SELECT 
  b.id,
  b.travel_id,
  b.customer_id,
  b.student_id,
  b.booking_status,          -- ✅ CORRECT (not b.status)
  b.pickup_lat,
  b.pickup_lng,
  b.pickup_location,
  b.pickup_address,
  b.dropoff_lat,
  b.dropoff_lng,
  b.dropoff_location,
  b.dropoff_address,
  b.booking_date,
  b.total_price,
  b.payment_method,          -- ✅ Added
  b.payment_status,          -- ✅ Added
  t.origin,
  t.destination,
  t.departure_time,          -- ✅ CORRECT (not t.departure_date)
  v.vehicle_number,
  v.vehicle_type,
  p.po_name,
  GROUP_CONCAT(bs.seat_number ORDER BY bs.seat_number) as seats
FROM bookings b
LEFT JOIN travels t ON b.travel_id = t.id
LEFT JOIN vehicles v ON t.vehicle_id = v.id
LEFT JOIN pos p ON v.po_id = p.id
LEFT JOIN booking_seats bs ON b.id = bs.booking_id
WHERE b.customer_id = ?
GROUP BY b.id
ORDER BY b.booking_date DESC;
```

---

## Current Status (Feb 16 21:55)

**BLOCKING ISSUE:** Customer cannot view booking history after login

- Customer a@gmail.com (id=29) tried to view "Riwayat" tab
- App made request to GET /api/customer/bookings/29
- Backend query failed with multiple column errors
- Customer sees error message: "Error: Unknown column..."
- **Cannot proceed to see any bookings**

**IMPACT:** 🔴 **CRITICAL** - Core feature blocked
