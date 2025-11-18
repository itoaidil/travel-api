# Daftar Login Student

Berikut adalah daftar akun student yang sudah terdaftar di sistem untuk testing:

## Daftar Akun Student

| No | Email | Password | Nama Lengkap | NIM | Universitas |
|----|-------|----------|--------------|-----|-------------|
| 1 | student1@email.com | student123 | Ahmad Rizki | STD001 | Universitas Negeri Padang |
| 2 | student2@email.com | student123 | Siti Nurhaliza | STD002 | Universitas Andalas |
| 3 | student3@email.com | student123 | Budi Santoso | STD003 | Institut Teknologi Padang |
| 4 | student4@email.com | student123 | Dewi Lestari | STD004 | Universitas Bung Hatta |
| 5 | student5@email.com | student123 | Rendra Pratama | STD005 | Politeknik Negeri Padang |

## Cara Login

1. Buka aplikasi Student Travel App
2. Pada halaman login, masukkan email dan password dari tabel di atas
3. Klik "Login"
4. Setelah login berhasil, Anda akan diarahkan ke dashboard student

## Fitur yang Tersedia Setelah Login

- **Cari Travel**: Mencari jadwal travel berdasarkan rute dan tanggal
- **Pilih Kursi**: Memilih kursi yang tersedia (bisa lebih dari 1 kursi)
- **Pembayaran**: Melakukan pembayaran untuk booking
- **Riwayat Booking**: Melihat daftar booking yang pernah dibuat
- **Profil**: Melihat dan mengelola profil student

## Catatan Keamanan

⚠️ **PENTING**: Password di atas hanya untuk development/testing. Pada production:
- Password harus di-hash menggunakan bcrypt atau algoritma hashing lainnya
- Implementasi JWT atau session token untuk autentikasi
- HTTPS untuk keamanan komunikasi
- Password policy yang kuat (minimal 8 karakter, kombinasi huruf, angka, simbol)

## Database Setup

Untuk membuat akun student di database, jalankan:

```bash
mysql -u root -p travel_system < migrations/create_student_users.sql
```

Atau copy-paste isi file `create_student_users.sql` ke MySQL client.

## API Endpoint

### Login Student
```
POST /api/student/login
Content-Type: application/json

{
  "email": "student1@email.com",
  "password": "student123"
}
```

**Response Success:**
```json
{
  "success": true,
  "data": {
    "user_id": 1,
    "student_id": 1,
    "email": "student1@email.com",
    "full_name": "Ahmad Rizki",
    "nim": "STD001",
    "university": "Universitas Negeri Padang",
    "address": "Jl. Hamka No. 1 Padang",
    "emergency_contact": "081234567891"
  }
}
```

**Response Error:**
```json
{
  "success": false,
  "message": "Email atau password salah"
}
```
