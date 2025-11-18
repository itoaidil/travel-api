# Travel Booking API - Testing Summary

## Server Status
✅ **API Server Running**: http://localhost:3000  
✅ **Database Connected**: MySQL (XAMPP) - travel_booking  
✅ **Node.js Version**: v25.1.0  
✅ **Dependencies Installed**: express, mysql2, cors, bcrypt, jsonwebtoken, dotenv

---

## Tested Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```
**Response**:
```json
{
  "status": "OK",
  "message": "Travel API Server is running"
}
```

---

### Student Endpoints

#### 1. Get All Travels (Available for booking)
```bash
curl http://localhost:3000/api/student/travels
```
**Response**: List of scheduled travels with PO name, vehicle details, capacity

#### 2. Get Travel Details
```bash
curl http://localhost:3000/api/student/travels/1
```
**Response**: Detailed travel info including driver, vehicle type, PO contact

#### 3. Create Booking (POST)
```bash
curl -X POST http://localhost:3000/api/student/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "student_id": 1,
    "travel_id": 1,
    "pickup_location": "Kampus UI Depok",
    "dropoff_location": "Dago, Bandung",
    "num_passengers": 2
  }'
```

#### 4. Get Student Bookings
```bash
curl http://localhost:3000/api/student/bookings/1
```
**Response**: List of bookings by student_id with travel details

---

### Driver Endpoints

#### 1. Get Driver's Assigned Travels
```bash
curl http://localhost:3000/api/driver/travels/1
```
**Response**: List of travels assigned to driver_id

#### 2. Get Bookings for Specific Travel
```bash
curl http://localhost:3000/api/driver/travels/1/bookings
```
**Response**: List of passengers/bookings for a travel

#### 3. Update Travel Status (PUT)
```bash
curl -X PUT http://localhost:3000/api/driver/travels/1/status \
  -H "Content-Type: application/json" \
  -d '{"status": "departed"}'
```
**Allowed Status**: scheduled, boarding, departed, arrived, cancelled

---

### PO (Perusahaan Otobus) Endpoints

#### 1. Get PO's Vehicles
```bash
curl http://localhost:3000/api/po/1/vehicles
```
**Response**: List of vehicles owned by PO

#### 2. Get PO's Travels
```bash
curl http://localhost:3000/api/po/1/travels
```
**Response**: List of travels with booking count

#### 3. Create New Travel (POST)
```bash
curl -X POST http://localhost:3000/api/po/travels \
  -H "Content-Type: application/json" \
  -d '{
    "po_id": 1,
    "vehicle_id": 1,
    "driver_id": 1,
    "route_name": "Jakarta - Semarang",
    "origin": "Terminal Kampung Rambutan",
    "destination": "Terminal Terboyo, Semarang",
    "departure_time": "2024-12-26 06:00:00",
    "arrival_time": "2024-12-26 13:00:00",
    "price": 120000,
    "total_seats": 45
  }'
```

#### 4. Get PO's Bookings
```bash
curl http://localhost:3000/api/po/1/bookings
```
**Response**: All bookings for PO's travels with student info

---

## Database Schema Notes

### Key Tables:
- **users**: user_type (student, driver, po, po_admin), phone
- **students**: full_name, student_id, university
- **drivers**: full_name, license_number, rating
- **pos**: po_name, company_code, phone
- **vehicles**: vehicle_type, plate_number, capacity
- **travels**: route_name, origin, destination, departure_time (datetime)
- **bookings**: student_id, travel_id, pickup_location, dropoff_location

### Important Column Mappings:
- ✅ PO name: `pos.po_name` (NOT business_name)
- ✅ Student name: `students.full_name` (NOT name)
- ✅ Driver name: `drivers.full_name` (NOT name)
- ✅ Phone: `users.phone` (join via user_id)
- ✅ Vehicle type: `vehicles.vehicle_type` (NOT type)
- ✅ Route: `travels.route_name`, `origin`, `destination` (NOT single "route")
- ✅ Departure: `travels.departure_time` (datetime, NOT separate date/time)

---

## Next Steps

### For Flutter Apps:
1. **Install http package**: Add `http: ^1.1.0` to pubspec.yaml
2. **Create API Service**: Build `lib/services/api_service.dart`
3. **Replace SQLite calls**: Convert `DatabaseHelper` to API calls
4. **Add error handling**: Handle network errors, timeouts
5. **Implement auth**: Add JWT authentication for secure endpoints

### For Production:
- [ ] Add authentication middleware (JWT)
- [ ] Add input validation
- [ ] Add rate limiting
- [ ] Setup environment variables (.env file)
- [ ] Add logging (morgan, winston)
- [ ] Add HTTPS support
- [ ] Deploy to cloud server
- [ ] Update MySQL to remote host

---

## Quick Start Commands

### Start Server:
```bash
cd /Users/fitroaidil/travel_api
node server.js
```

### Start Server with Auto-reload (Development):
```bash
npm run dev
```

### View Logs:
```bash
tail -f /tmp/api.log
```

### Stop Server:
```bash
pkill -f "node server.js"
```

---

## Contact
API Server Location: `/Users/fitroaidil/travel_api`  
Database: MySQL on XAMPP (localhost:3306)  
Date Created: November 15, 2025
