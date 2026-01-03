# Midtrans Payment Gateway Setup Guide

**Status:** ✅ Backend code sudah siap, tinggal setup kredensial

**Tanggal Setup:** 20 November 2025

---

## 📦 Yang Sudah Dikerjakan

### 1. Install Dependencies
```bash
npm install midtrans-client --save
```
✅ Package ter-install tanpa error (2 packages added)

### 2. File yang Dibuat

#### `config/midtrans.js`
- Konfigurasi Midtrans client (Snap API & Core API)
- Support sandbox dan production mode
- Functions: `createTransaction()`, `checkTransactionStatus()`, `verifySignature()`

#### `routes/paymentRoutes.js`
5 endpoints siap pakai:
- **POST** `/api/payment/create-token` - Generate Snap token untuk pembayaran
- **POST** `/api/payment/notification` - Webhook dari Midtrans (otomatis dipanggil saat status berubah)
- **GET** `/api/payment/status/:orderId` - Cek status transaksi manual
- **GET** `/api/payment/config` - Get client key untuk frontend
- **GET** `/api/payment/test` - Test endpoint untuk verifikasi

#### `test_midtrans_connection.js`
- Script test koneksi Midtrans tanpa butuh database
- Bisa dijalankan dengan: `node test_midtrans_connection.js`

#### `.env.example` (updated)
- Template environment variables untuk Midtrans
- Kredensial sandbox/production

### 3. Integration di `server.js`
```javascript
app.use('/api/payment', require('./routes/paymentRoutes'));
```
✅ Routes sudah teregistrasi, tidak mengganggu endpoint existing

---

## 🔑 Langkah Setup Kredensial

### Step 1: Daftar Midtrans Sandbox (5 menit)
1. Buka https://dashboard.sandbox.midtrans.com/
2. Klik **"Merchant"** (bukan Partner)
3. Isi form registrasi:
   - Email bisnis
   - Nama bisnis: Travel Booking App / nama PO Anda
   - Jenis bisnis: Transportation / Travel
   - Phone number
4. Verifikasi email

### Step 2: Dapatkan Kredensial (1 menit)
1. Login ke dashboard sandbox
2. Masuk ke **Settings → Access Keys**
3. Copy 2 kredensial:
   - **Server Key** (dimulai dengan `SB-Mid-server-...`)
   - **Client Key** (dimulai dengan `SB-Mid-client-...`)

### Step 3: Set Environment Variables

#### Untuk Railway (Production):
```bash
# Di Railway dashboard → Variables
MIDTRANS_ENVIRONMENT=sandbox
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxx
FRONTEND_URL=https://your-app-url.com
```

#### Untuk Development (Local):
Buat file `.env` di root `travel_api/`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=travel_booking
DB_PORT=3306

PORT=3000
NODE_ENV=development
JWT_SECRET=your-secret-key-here

# Midtrans Configuration
MIDTRANS_ENVIRONMENT=sandbox
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxx
FRONTEND_URL=http://localhost:3000
```

### Step 4: Test Koneksi
```bash
cd travel_api
node test_midtrans_connection.js
```

**Expected output jika berhasil:**
```
✅ SUCCESS! Midtrans is working!
Token: abc123...
Redirect URL: https://app.sandbox.midtrans.com/snap/v2/...
```

**Jika gagal (401 Unauthorized):**
- Periksa Server Key dan Client Key
- Pastikan tidak ada spasi di awal/akhir kredensial
- Restart server setelah update .env

---

## 🧪 Testing Payment Flow

### Test dengan Kartu Kredit Dummy
Midtrans menyediakan kartu test untuk sandbox:

**Kartu yang BERHASIL:**
```
Card Number: 4811 1111 1111 1114
CVV: 123
Expiry: 01/25 (atau bulan/tahun di masa depan)
OTP: 112233
```

**Kartu yang GAGAL (untuk test error handling):**
```
Card Number: 4911 1111 1111 1113
```

### Test Flow dari Postman/curl:

#### 1. Create Payment Token
```bash
curl -X POST http://localhost:3000/api/payment/create-token \
  -H "Content-Type: application/json" \
  -d '{
    "booking_id": 1,
    "amount": 100000,
    "customer_name": "Test User",
    "customer_email": "test@example.com",
    "customer_phone": "081234567890"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "abc123-token-xyz",
  "redirect_url": "https://app.sandbox.midtrans.com/snap/v2/...",
  "order_id": "TRAVEL-1-1234567890"
}
```

#### 2. Check Payment Status
```bash
curl http://localhost:3000/api/payment/status/TRAVEL-1-1234567890
```

#### 3. Get Config (untuk Flutter app)
```bash
curl http://localhost:3000/api/payment/config
```

---

## 📱 Integrasi ke Flutter App (Next Phase)

### Package yang Dibutuhkan:
```yaml
# pubspec.yaml
dependencies:
  midtrans_sdk: ^0.2.0  # Official Midtrans Flutter SDK
  webview_flutter: ^4.0.0  # Untuk tampilkan payment page
```

### Flow Pembayaran:
1. User pilih jadwal travel → isi data penumpang
2. App call `POST /api/payment/create-token` → dapat Snap token
3. App buka Midtrans Snap UI dengan token
4. User bayar (kartu kredit/e-wallet/bank transfer)
5. Midtrans kirim notifikasi ke `POST /api/payment/notification`
6. Backend update status booking di database
7. App polling status atau terima push notification

---

## 🔒 Security Checklist

✅ **Signature verification** - webhook hanya proses jika signature valid  
✅ **Environment separation** - sandbox vs production terpisah  
✅ **Credentials dari .env** - tidak hardcode di code  
✅ **HTTPS required** - webhook Midtrans hanya ke HTTPS (production)  
✅ **Isolated routes** - `/api/payment/*` tidak ganggu endpoint lain  

---

## 💰 Biaya Transaksi (Sandbox = GRATIS)

### Sandbox Mode:
- ✅ Unlimited transaksi test
- ✅ Semua payment method available
- ✅ Settlement simulasi (tidak ada uang sungguhan)

### Production Mode:
- **Kartu Kredit/Debit:** 2.9% + Rp 2,000 per transaksi
- **GoPay/OVO/DANA:** 2% per transaksi
- **Bank Transfer:** Rp 4,000 per transaksi
- **Settlement:** H+1 s/d H+7 ke rekening terdaftar

---

## 🚀 Deployment ke Railway

### Prerequisites:
1. Kredensial Midtrans sudah didapat
2. HTTPS endpoint (Railway otomatis provide)

### Set Environment Variables di Railway:
```bash
railway variables set MIDTRANS_ENVIRONMENT=sandbox
railway variables set MIDTRANS_SERVER_KEY=SB-Mid-server-xxx
railway variables set MIDTRANS_CLIENT_KEY=SB-Mid-client-xxx
railway variables set FRONTEND_URL=https://travel-api-production-23ae.up.railway.app
```

### Deploy:
```bash
git add .
git commit -m "feat: add Midtrans payment gateway integration"
git push origin main
```

Railway akan auto-deploy, payment routes langsung aktif di:
```
https://travel-api-production-23ae.up.railway.app/api/payment/test
```

---

## 📊 Database Changes (Otomatis)

Payment routes akan update kolom di table `bookings`:
- `payment_order_id` - Order ID dari Midtrans
- `payment_status` - pending/success/failed
- `payment_method` - credit_card/gopay/bank_transfer/dll
- `payment_amount` - Jumlah yang dibayar
- `updated_at` - Timestamp update terakhir

**Note:** Kolom ini sudah ada di schema, tidak perlu migration baru.

---

## 🐛 Troubleshooting

### Error 401 Unauthorized
- ❌ Server Key salah atau belum diset
- ✅ Copy ulang dari dashboard, pastikan format `SB-Mid-server-...`
- ✅ Restart server setelah update .env

### Webhook Tidak Masuk
- ❌ URL tidak HTTPS (production only)
- ❌ Server tidak accessible dari internet
- ✅ Test dengan ngrok untuk local development
- ✅ Cek Railway logs: `railway logs`

### Signature Verification Failed
- ❌ Server Key tidak match dengan yang di dashboard
- ❌ Data notification ter-modify sebelum sampai ke endpoint
- ✅ Pastikan raw body JSON diterima (jangan parse sebelum verify)

---

## 📞 Support

**Midtrans Documentation:**
- Dashboard Sandbox: https://dashboard.sandbox.midtrans.com/
- API Docs: https://docs.midtrans.com/
- Postman Collection: https://docs.midtrans.com/reference/

**Current Status:**
- ✅ Backend setup complete
- ⏳ Menunggu kredensial dari dashboard
- ⏳ Flutter integration (phase selanjutnya)

---

## ✅ Next Steps

1. [ ] Daftar di Midtrans Sandbox sebagai **Merchant**
2. [ ] Copy Server Key & Client Key
3. [ ] Set di Railway environment variables
4. [ ] Test dengan `test_midtrans_connection.js`
5. [ ] Deploy ke Railway
6. [ ] Test endpoint `/api/payment/test`
7. [ ] Lanjut implementasi di Flutter app

**Estimated Time:** 15 menit untuk setup kredensial + test koneksi

---

**Last Updated:** 20 November 2025, 15:07 WIB  
**Status:** Ready for credential setup 🚀
