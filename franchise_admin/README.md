# Franchise Admin Frontend

Frontend dashboard untuk admin franchise menggunakan React + Vite.

## Tech Stack

- React 18
- Vite 5
- Recharts

## Menjalankan Project

Pastikan Node.js + npm tersedia di mesin Anda.

```bash
cd franchise_admin
cp .env.example .env
npm install
npm run dev
```

Akses di browser:

- http://localhost:5175

## Catatan

- Dashboard terhubung ke endpoint backend `/api/franchise-admin/*` dengan fallback mock jika request gagal.
- Ubah konfigurasi API dan partner franchise di `.env`.
