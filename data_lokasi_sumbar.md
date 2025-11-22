# Data Lokasi Sumatera Barat (Sumbar)
## Untuk digunakan di field origin dan destination

### 🏙️ Kota (7)
1. Padang
2. Bukittinggi
3. Payakumbuh
4. Sawahlunto
5. Solok
6. Padang Panjang
7. Pariaman

---

### 🏘️ Kabupaten (12)

#### 1. **Kabupaten Agam**
**Kecamatan:**
- Ampek Angkek
- Ampek Nagari
- Banuhampu
- Baso
- Candung
- IV Angkek Candung
- IV Koto
- Kamang Magek
- Lubuk Basung
- Malalak
- Palembayan
- Palupuh
- Sungai Pua
- Tanjung Mutiara
- Tanjung Raya
- Tilatang Kamang

#### 2. **Kabupaten Dharmasraya**
**Kecamatan:**
- Asam Jujuhan
- IX Koto
- Koto Baru
- Koto Besar
- Padang Laweh
- Pulau Punjung
- Sei Rumbai
- Sitiung
- Timpeh
- Tiumang
- XI Tarusan

#### 3. **Kabupaten Kepulauan Mentawai**
**Kecamatan:**
- Pagai Selatan
- Pagai Utara
- Siberut Barat
- Siberut Barat Daya
- Siberut Selatan
- Siberut Tengah
- Siberut Utara
- Sikakap
- Sipora Selatan
- Sipora Utara

#### 4. **Kabupaten Lima Puluh Kota**
**Kecamatan:**
- Akabiluru
- Bukik Barisan
- Guguak
- Gunuang Omeh
- Harau
- Kapur IX
- Lareh Sago Halaban
- Luak
- Mungka
- Pangkalan Koto Baru
- Payakumbuh
- Situjuah Limo Nagari
- Suliki

#### 5. **Kabupaten Padang Pariaman**
**Kecamatan:**
- 2x11 Enam Lingkung
- 2x11 Kayu Tanam
- Batang Anai
- Batang Gasan
- Enam Lingkung
- IV Koto Aur Malintang
- Lubuk Alung
- Nan Sabaris
- Padang Sago
- Patamuan
- Sei Geringging
- Sei Limau
- Sintuk Toboh Gadang
- Sungai Garingging
- Sungai Limau
- Ulakan Tapakih
- V Koto Kampung Dalam
- V Koto Timur

#### 6. **Kabupaten Pasaman**
**Kecamatan:**
- Bonjol
- Duo Koto
- Lubuk Sikaping
- Mapat Tunggul
- Mapat Tunggul Selatan
- Padang Gelugur
- Panti
- Rao
- Rao Selatan
- Rao Utara
- Simpang Alahan Mati
- Tigo Nagari

#### 7. **Kabupaten Pasaman Barat**
**Kecamatan:**
- Gunung Tuleh
- Koto Balingka
- Kinali
- Lembah Melintang
- Luhak Nan Duo
- Pasaman
- Ranah Batahan
- Sasak Ranah Pasisia
- Sei Beremas
- Talamau
- Ujung Gading

#### 8. **Kabupaten Pesisir Selatan**
**Kecamatan:**
- Airpura
- Bayang
- Batang Kapas
- Basa Ampek Balai Tapan
- IV Jurai
- IV Nagari Bayang Utara
- Koto XI Tarusan
- Lengayang
- Linggo Sari Baganti
- Lunang
- Pancung Soal
- Ranah Ampek Hulu Tapan
- Ranah Pesisir
- Silaut
- Sutera

#### 9. **Kabupaten Sijunjung**
**Kecamatan:**
- IV Nagari
- Kamang Baru
- Koto VII
- Kupitan
- Lubuk Tarok
- Sijunjung
- Sumpur Kudus
- Tanjung Gadang

#### 10. **Kabupaten Solok**
**Kecamatan:**
- Bukit Sundi
- Danau Kembar
- Gunung Talang
- Hiliran Gumanti
- IX Koto Sungai Lasi
- Junjung Sirih
- Kubung
- Lembah Gumanti
- Lembang Jaya
- Pantai Cermin
- Payung Sekaki
- Tigo Lurah
- X Koto Diatas
- X Koto Singkarak

#### 11. **Kabupaten Solok Selatan**
**Kecamatan:**
- Koto Parik Gadang Diateh
- Pauh Duo
- Sangir
- Sangir Balai Janggo
- Sangir Batang Hari
- Sangir Jujuan
- Sungai Pagu

#### 12. **Kabupaten Tanah Datar**
**Kecamatan:**
- Batipuh
- Batipuh Selatan
- IX Koto
- Lima Kaum
- Lintau Buo
- Lintau Buo Utara
- Padang Ganting
- Pariangan
- Rambatan
- Salimpaung
- Sungai Tarab
- Sungayang
- Tanjung Baru
- Tanjung Emas

---

## 📝 Contoh Penggunaan di Travels Table

```sql
-- Origin dan Destination bisa berupa:
-- 1. Nama Kota: "Padang", "Bukittinggi"
-- 2. Nama Kabupaten: "Kabupaten Agam", "Kabupaten Solok"
-- 3. Nama Kecamatan: "Lubuk Basung", "Malalak", "Kamang Magek"
-- 4. Kombinasi: "Padang", "Lubuk Basung, Kab. Agam"

-- Contoh Insert:
INSERT INTO travels (po_id, vehicle_id, route_name, origin, destination, departure_time, price, status) 
VALUES 
(1, 1, 'Padang - Bukittinggi', 'Padang', 'Bukittinggi', '2025-11-23 06:00:00', 50000, 'scheduled'),
(1, 2, 'Padang - Lubuk Basung', 'Padang', 'Lubuk Basung', '2025-11-23 07:00:00', 45000, 'scheduled'),
(1, 3, 'Bukittinggi - Payakumbuh', 'Bukittinggi', 'Payakumbuh', '2025-11-23 08:00:00', 25000, 'scheduled');
```

---

## 🎯 Rekomendasi Rute Populer Sumbar:

### Antar Kota Utama:
- Padang ↔ Bukittinggi
- Padang ↔ Payakumbuh
- Padang ↔ Solok
- Padang ↔ Pariaman
- Bukittinggi ↔ Payakumbuh
- Bukittinggi ↔ Padang Panjang

### Kota ke Kabupaten:
- Padang → Lubuk Basung (Kab. Agam)
- Padang → Lubuk Sikaping (Kab. Pasaman)
- Padang → Muaro Sijunjung (Kab. Sijunjung)
- Padang → Painan (Kab. Pesisir Selatan)
- Bukittinggi → Batusangkar (Kab. Tanah Datar)

### Wisata Populer:
- Padang → Jam Gadang, Bukittinggi
- Padang → Ngarai Sianok, Bukittinggi
- Padang → Danau Singkarak, Solok
- Padang → Danau Maninjau, Agam
- Padang → Lembah Harau, Lima Puluh Kota
- Padang → Istana Pagaruyung, Tanah Datar

---

**Total Lokasi:**
- 7 Kota
- 12 Kabupaten
- 150+ Kecamatan
- Ribuan Desa/Nagari

Semua data ini bisa langsung digunakan di field `origin` dan `destination` pada tabel `travels` tanpa perlu tabel tambahan! 🚌✨
