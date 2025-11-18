# Konsep Vehicle Schedule

## Struktur Data

### Database: `vehicle_schedules`
```sql
CREATE TABLE vehicle_schedules (
  id INT PRIMARY KEY,
  vehicle_id INT,
  destination VARCHAR(255),           -- Kota tujuan
  departure_times JSON,                -- Array jam: ["06:00", "09:00", "14:00", "17:00"]
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Konsep Bisnis

### 1 Schedule = 1 Destinasi + Multiple Jam Per Hari

**Contoh**: 
Kendaraan **BA 123 AA** memiliki 2 schedule:

#### Schedule 1: Ke Jakarta
- Jam: 06:00, 09:00, 14:00, 17:00
- Artinya: Setiap hari, mobil ini berangkat ke Jakarta di 4 waktu tersebut

#### Schedule 2: Ke Bandung  
- Jam: 07:00, 10:00, 15:00
- Artinya: Setiap hari, mobil ini berangkat ke Bandung di 3 waktu tersebut

## Cara Kerja

### PO Side (Setup Jadwal):
1. PO login → Menu Kendaraan
2. Pilih kendaraan → Tap menu (⋮) → "Jadwal"
3. Tap "+ Tambah Jam"
4. Pilih **1 destinasi** (contoh: Jakarta)
5. Pilih **multiple jam** (contoh: 06:00, 09:00, 14:00, 17:00)
6. Simpan

Jadwal tersimpan dan berlaku **setiap hari**.

### Student Side (Cari Travel):
1. Student pilih:
   - Dari: Padang
   - Ke: Jakarta
   - (Opsional) Tanggal: 2025-11-25
   
2. Backend mencari:
   - Kendaraan yang punya schedule ke Jakarta
   - Yang punya jadwal keberangkatan aktif
   
3. Student melihat:
   - List kendaraan yang tersedia
   - Dengan jam-jam keberangkatan (06:00, 09:00, 14:00, 17:00)
   
4. Student bisa pilih jam yang sesuai untuk booking

## Keuntungan Konsep Ini

✅ **Fleksibel**: 1 kendaraan bisa melayani multiple destinasi
✅ **Efisien**: Tidak perlu input jadwal setiap hari
✅ **Jelas**: PO tau kapan mobil berangkat, Student tau jam yang tersedia
✅ **Scalable**: Mudah tambah/hapus jadwal

## API Endpoints

### GET /api/po/vehicles/:id/schedules
Ambil semua jadwal kendaraan

### POST /api/po/vehicles/:id/schedules
```json
{
  "destination": "Jakarta",
  "departure_times": ["06:00", "09:00", "14:00", "17:00"]
}
```

### PUT /api/po/vehicles/:id/schedules/:schedule_id
Update jadwal existing

### DELETE /api/po/vehicles/:id/schedules/:schedule_id
Hapus jadwal
