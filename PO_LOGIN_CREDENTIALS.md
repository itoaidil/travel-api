# Daftar Login PO Travel

Berikut adalah daftar lengkap PO yang sudah terdaftar di sistem beserta kredensial login:

## PO Companies List

| No | Nama PO          | Username              | Password    | Email                  | Phone        |
|----|------------------|-----------------------|-------------|------------------------|--------------|
| 1  | PT Trans Jaya    | admin_transjaya       | password123 | info@transjaya.com     | 021-1234567  |
| 2  | Test PO Demo     | test_po1              | password123 | testpo1@example.com    | 081234567890 |
| 3  | PO PALALA        | palala_admin          | password123 | admin@popalala.com     | 081234567001 |
| 4  | PO PADANG EXPRES | padangexpres_admin    | password123 | admin@padangexpres.com | 081234567002 |
| 5  | PO SUKMA JAYA    | sukmajaya_admin       | password123 | admin@sukmajaya.com    | 081234567003 |
| 6  | PO RIDHO MAKMUR  | ridhomakmur_admin     | password123 | admin@ridhomakmur.com  | 081234567004 |
| 7  | PO NPM           | npm_admin             | password123 | admin@ponpm.com        | 081234567005 |
| 8  | PO ALS           | als_admin             | password123 | admin@poals.com        | 081234567006 |
| 9  | PO ANS           | ans_admin             | password123 | admin@poans.com        | 081234567007 |

## Cara Login

1. Buka aplikasi **PO Travel App**
2. Pada halaman login, masukkan username dan password dari tabel di atas
3. Klik "Login"
4. Setelah login, Anda bisa:
   - Melihat daftar kendaraan
   - Menambah kendaraan baru
   - Mengatur jadwal keberangkatan untuk setiap kendaraan
   - Mengelola data perjalanan

## Fitur Jadwal Keberangkatan

### Cara Mengatur Jadwal:
1. Login sebagai admin PO
2. Pilih menu **"Kendaraan"**
3. Pilih salah satu kendaraan
4. Tap icon **⋮** (titik tiga) di kanan atas
5. Pilih **"Jadwal"**
6. Pada halaman jadwal:
   - Lihat jadwal yang sudah ada
   - Tap **"+ Tambah Jam"** untuk menambah jadwal baru
   - Pilih destinasi (kota tujuan)
   - Pilih jam keberangkatan (bisa pilih beberapa jam)
   - Simpan

### Konsep Jadwal:
- **1 jadwal = 1 destinasi + beberapa jam keberangkatan per hari**
- Contoh: Jakarta dengan jam 06:00, 09:00, 14:00, 17:00
- Jadwal berlaku **setiap hari** (recurring daily)
- Satu kendaraan bisa punya beberapa jadwal ke berbagai destinasi

### Contoh Penggunaan:
Bus B 1234 AB bisa punya jadwal:
- Jakarta: 06:00, 09:00, 14:00, 17:00
- Bandung: 07:00, 11:00, 15:00
- Surabaya: 05:00, 13:00, 20:00

## Testing Notes

### PO yang Sudah Punya Data Kendaraan:
- **PT Trans Jaya** (admin_transjaya): Sudah ada 5 kendaraan
  - B 1234 AB (Bus, 45 seats) - Sudah ada jadwal Jakarta
  - B 5678 CD (Minibus, 16 seats)
  - BA 223 HH (Van, 4 seats)
  - Dan lainnya...

### PO Baru (Belum Punya Kendaraan):
- PO PALALA
- PO PADANG EXPRES
- PO SUKMA JAYA
- PO RIDHO MAKMUR
- PO NPM
- PO ALS
- PO ANS

**Note:** Untuk PO baru, Anda perlu menambahkan kendaraan terlebih dahulu sebelum bisa mengatur jadwal.

## Database Information

- **Database:** travel_booking
- **Tables:**
  - `users` - Data user/admin PO
  - `pos` - Data perusahaan PO
  - `po_admins` - Relasi user dengan PO
  - `vehicles` - Data kendaraan
  - `vehicle_schedules` - Jadwal keberangkatan kendaraan

## API Endpoints (untuk development)

### Authentication:
- `POST /api/po/login` - Login PO admin
- `POST /api/po/register` - Register PO baru

### Vehicles:
- `GET /api/po/:id/vehicles` - List kendaraan
- `POST /api/po/:id/vehicles` - Tambah kendaraan
- `PUT /api/po/vehicles/:vehicle_id` - Update kendaraan
- `DELETE /api/po/vehicles/:vehicle_id` - Hapus kendaraan

### Schedules:
- `GET /api/po/vehicles/:id/schedules` - List jadwal kendaraan
- `POST /api/po/vehicles/:id/schedules` - Tambah jadwal
- `PUT /api/po/vehicles/:id/schedules/:schedule_id` - Update jadwal
- `DELETE /api/po/vehicles/:id/schedules/:schedule_id` - Hapus jadwal

---

**Last Updated:** 2025
**Server:** localhost:3000
