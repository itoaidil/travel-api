# 🔄 API Migration Guide: Vercel → Railway

## Status: Parallel Running (Opsi 2)

### Current State
- ✅ **Vercel API** (ACTIVE): `travelapifresh-aw9m3822a-fitros-projects-1b98d7a0.vercel.app`
- ✅ **Railway API** (TESTING): `travel-api-production-23ae.up.railway.app`
- 📱 **Flutter App**: Masih pointing ke Vercel

### Routes yang Sudah Di-sync

#### 1. Student Routes (`/api/student/*`)
- ✅ `/login` - Login student
- ✅ `/departure-cities` - Autocomplete kota asal
- ✅ `/destination-cities?from=X` - Autocomplete kota tujuan
- ✅ `/search-po?from=X&to=Y` - Cari PO berdasarkan rute
- ✅ `/schedules` - Jadwal perjalanan
- ✅ `/travels` - List perjalanan tersedia
- ✅ `/bookings/:student_id` - Riwayat booking
- ✅ `/travels/:travel_id/booked-seats` - Kursi yang sudah dipesan

#### 2. Customer Routes (`/api/customer/*`)
- ✅ `/register` - Registrasi customer
- ✅ `/login` - Login customer
- ✅ `/booking` - Create booking baru
- ✅ `/bookings/:customer_id` - Riwayat booking (sudah fix b.status issue)

#### 3. Payment Routes (`/api/payment/*`)
- ✅ `/create-token` - Generate Midtrans token
- ✅ `/notification` - Midtrans webhook callback
- ✅ `/status/:orderId` - Check payment status
- ✅ `/config` - Get Midtrans config

### Database
- **Location**: Railway MySQL
- **Host**: `autorack.proxy.rlwy.net:46846`
- **Database**: `railway`
- **Connection**: Shared between Vercel & Railway API

---

## 🧪 Testing Railway API

### 1. Test Student Login
```bash
curl -X POST "https://travel-api-production-23ae.up.railway.app/api/student/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "a@gmail.com",
    "password": "123456"
  }'
```

Expected response:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "a@gmail.com",
    "student": {
      "id": 1,
      "full_name": "..."
    }
  }
}
```

### 2. Test Search Flow
```bash
# Get departure cities
curl "https://travel-api-production-23ae.up.railway.app/api/student/departure-cities"

# Get destination cities
curl "https://travel-api-production-23ae.up.railway.app/api/student/destination-cities?from=Padang"

# Search PO
curl "https://travel-api-production-23ae.up.railway.app/api/student/search-po?from=Padang&to=Bukittinggi"

# Get schedules
curl "https://travel-api-production-23ae.up.railway.app/api/student/schedules?origin=Padang&destination=Bukittinggi"
```

### 3. Test Booking History
```bash
curl "https://travel-api-production-23ae.up.railway.app/api/student/bookings/1"
```

### 4. Test Payment Config
```bash
curl "https://travel-api-production-23ae.up.railway.app/api/payment/config"
```

---

## 📱 Switch Flutter App ke Railway

### File yang Perlu Diubah

**`lib/services/api_service.dart`**

```dart
class ApiService {
  // OLD (Vercel)
  // static const String baseUrl = 'https://travelapifresh-aw9m3822a-fitros-projects-1b98d7a0.vercel.app';
  
  // NEW (Railway)
  static const String baseUrl = 'https://travel-api-production-23ae.up.railway.app';
  
  // ... rest of the code
}
```

### Steps untuk Switch

1. **Update API URL**
   ```bash
   cd travel_booking_app
   # Edit lib/services/api_service.dart
   # Change baseUrl ke Railway URL
   ```

2. **Test di Emulator**
   ```bash
   # Start emulator
   export ANDROID_HOME=/Volumes/SSD_FITRO/android-development/sdk
   $ANDROID_HOME/emulator/emulator -avd TravelApp_Test &
   
   # Install app
   flutter run
   ```

3. **Test Full Flow**
   - Login dengan a@gmail.com / 123456
   - Search Padang → Bukittinggi
   - Pilih PO
   - Pilih jadwal
   - Pilih kursi
   - Booking
   - Payment
   - Check riwayat booking

4. **Build APK Baru**
   ```bash
   export ANDROID_HOME=/Volumes/SSD_FITRO/android-development/sdk
   export JAVA_HOME=/Applications/Android\ Studio.app/Contents/jbr/Contents/Home
   flutter clean
   flutter build apk --release
   ```

5. **Install ke HP**
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```

---

## ⚠️ Rollback Plan (Jika Ada Masalah)

Jika Railway API bermasalah, tinggal kembalikan URL di Flutter:

```dart
// Rollback to Vercel
static const String baseUrl = 'https://travelapifresh-aw9m3822a-fitros-projects-1b98d7a0.vercel.app';
```

Build APK lagi dan install.

---

## 📊 Monitoring

### Railway Logs
https://railway.app/project/1c2d5d-e912-4c25-9bba-011e98dcceb1/service/travel-api/logs

### Endpoints to Monitor
- `/api/student/login` - Paling sering dipakai
- `/api/student/departure-cities` - Autocomplete
- `/api/customer/booking` - Create booking (critical!)
- `/api/payment/notification` - Midtrans webhook (critical!)

### Known Issues Fixed
- ✅ `b.status` column error → Changed to `b.booking_status` & `b.payment_status`
- ✅ Callback style → Migrated to async/await
- ✅ Database connection → Same Railway MySQL

---

## ✅ Checklist Sebelum Switch Permanent

- [ ] All Railway endpoints tested and working
- [ ] Login flow works
- [ ] Search autocomplete works
- [ ] Booking creation works
- [ ] Payment flow tested (Midtrans)
- [ ] Booking history displays correctly
- [ ] No error in Railway logs
- [ ] Tested on emulator
- [ ] Tested on real device
- [ ] APK built and distributed
- [ ] Vercel can be safely shut down

---

## 🎯 Next Steps

1. **Wait for Railway deployment** (~2-3 min)
2. **Test all endpoints** (run test script)
3. **Update Flutter app** (change baseUrl)
4. **Build & test APK**
5. **Monitor for 1-2 days**
6. **Shut down Vercel** (optional, save cost)

---

**Last Updated**: December 1, 2025  
**Status**: Railway deployment in progress (Building 01:09)
