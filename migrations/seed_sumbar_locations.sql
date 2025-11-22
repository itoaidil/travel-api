-- ============================================
-- SEED DATA LOKASI SUMATERA BARAT (SUMBAR)
-- Tabel Referensi Lokasi untuk Autocomplete
-- ============================================

-- Buat tabel referensi lokasi untuk dropdown/autocomplete
CREATE TABLE IF NOT EXISTS location_references (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type ENUM('city', 'regency', 'district') NOT NULL,
  parent_name VARCHAR(255) NULL,
  is_popular TINYINT(1) DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_type (type),
  INDEX idx_popular (is_popular),
  INDEX idx_active (is_active),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- INSERT KOTA DI SUMATERA BARAT (7 Kota)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Padang', 'city', NULL, 1),
('Bukittinggi', 'city', NULL, 1),
('Payakumbuh', 'city', NULL, 1),
('Sawahlunto', 'city', NULL, 0),
('Solok', 'city', NULL, 1),
('Padang Panjang', 'city', NULL, 0),
('Pariaman', 'city', NULL, 1);

-- ============================================
-- INSERT KABUPATEN AGAM - Kecamatan (16)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Ampek Angkek', 'district', 'Kabupaten Agam', 0),
('Ampek Nagari', 'district', 'Kabupaten Agam', 0),
('Banuhampu', 'district', 'Kabupaten Agam', 1),
('Baso', 'district', 'Kabupaten Agam', 0),
('Candung', 'district', 'Kabupaten Agam', 0),
('IV Angkek Candung', 'district', 'Kabupaten Agam', 0),
('IV Koto', 'district', 'Kabupaten Agam', 0),
('Kamang Magek', 'district', 'Kabupaten Agam', 1),
('Lubuk Basung', 'district', 'Kabupaten Agam', 1),
('Malalak', 'district', 'Kabupaten Agam', 1),
('Palembayan', 'district', 'Kabupaten Agam', 0),
('Palupuh', 'district', 'Kabupaten Agam', 0),
('Sungai Pua', 'district', 'Kabupaten Agam', 1),
('Tanjung Mutiara', 'district', 'Kabupaten Agam', 0),
('Tanjung Raya', 'district', 'Kabupaten Agam', 0),
('Tilatang Kamang', 'district', 'Kabupaten Agam', 0);

-- ============================================
-- INSERT KABUPATEN DHARMASRAYA - Kecamatan (11)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Asam Jujuhan', 'district', 'Kabupaten Dharmasraya', 0),
('IX Koto', 'district', 'Kabupaten Dharmasraya', 0),
('Koto Baru', 'district', 'Kabupaten Dharmasraya', 0),
('Koto Besar', 'district', 'Kabupaten Dharmasraya', 1),
('Padang Laweh', 'district', 'Kabupaten Dharmasraya', 0),
('Pulau Punjung', 'district', 'Kabupaten Dharmasraya', 1),
('Sei Rumbai', 'district', 'Kabupaten Dharmasraya', 0),
('Sitiung', 'district', 'Kabupaten Dharmasraya', 1),
('Timpeh', 'district', 'Kabupaten Dharmasraya', 0),
('Tiumang', 'district', 'Kabupaten Dharmasraya', 0),
('XI Tarusan', 'district', 'Kabupaten Dharmasraya', 0);

-- ============================================
-- INSERT KABUPATEN KEPULAUAN MENTAWAI - Kecamatan (10)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Pagai Selatan', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Pagai Utara', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Siberut Barat', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Siberut Barat Daya', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Siberut Selatan', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Siberut Tengah', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Siberut Utara', 'district', 'Kabupaten Kepulauan Mentawai', 1),
('Sikakap', 'district', 'Kabupaten Kepulauan Mentawai', 1),
('Sipora Selatan', 'district', 'Kabupaten Kepulauan Mentawai', 0),
('Sipora Utara', 'district', 'Kabupaten Kepulauan Mentawai', 0);

-- ============================================
-- INSERT KABUPATEN LIMA PULUH KOTA - Kecamatan (13)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Akabiluru', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Bukik Barisan', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Guguak', 'district', 'Kabupaten Lima Puluh Kota', 1),
('Gunuang Omeh', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Harau', 'district', 'Kabupaten Lima Puluh Kota', 1),
('Kapur IX', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Lareh Sago Halaban', 'district', 'Kabupaten Lima Puluh Kota', 1),
('Luak', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Mungka', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Pangkalan Koto Baru', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Payakumbuh', 'district', 'Kabupaten Lima Puluh Kota', 1),
('Situjuah Limo Nagari', 'district', 'Kabupaten Lima Puluh Kota', 0),
('Suliki', 'district', 'Kabupaten Lima Puluh Kota', 1);

-- ============================================
-- INSERT KABUPATEN PADANG PARIAMAN - Kecamatan (17)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('2x11 Enam Lingkung', 'district', 'Kabupaten Padang Pariaman', 0),
('2x11 Kayu Tanam', 'district', 'Kabupaten Padang Pariaman', 0),
('Batang Anai', 'district', 'Kabupaten Padang Pariaman', 1),
('Batang Gasan', 'district', 'Kabupaten Padang Pariaman', 0),
('Enam Lingkung', 'district', 'Kabupaten Padang Pariaman', 0),
('IV Koto Aur Malintang', 'district', 'Kabupaten Padang Pariaman', 0),
('Lubuk Alung', 'district', 'Kabupaten Padang Pariaman', 1),
('Nan Sabaris', 'district', 'Kabupaten Padang Pariaman', 0),
('Padang Sago', 'district', 'Kabupaten Padang Pariaman', 0),
('Patamuan', 'district', 'Kabupaten Padang Pariaman', 0),
('Sei Geringging', 'district', 'Kabupaten Padang Pariaman', 0),
('Sei Limau', 'district', 'Kabupaten Padang Pariaman', 0),
('Sintuk Toboh Gadang', 'district', 'Kabupaten Padang Pariaman', 0),
('Sungai Garingging', 'district', 'Kabupaten Padang Pariaman', 0),
('Sungai Limau', 'district', 'Kabupaten Padang Pariaman', 1),
('Ulakan Tapakih', 'district', 'Kabupaten Padang Pariaman', 0),
('V Koto Kampung Dalam', 'district', 'Kabupaten Padang Pariaman', 0);

-- ============================================
-- INSERT KABUPATEN PASAMAN - Kecamatan (12)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Bonjol', 'district', 'Kabupaten Pasaman', 1),
('Duo Koto', 'district', 'Kabupaten Pasaman', 0),
('Lubuk Sikaping', 'district', 'Kabupaten Pasaman', 1),
('Mapat Tunggul', 'district', 'Kabupaten Pasaman', 0),
('Mapat Tunggul Selatan', 'district', 'Kabupaten Pasaman', 0),
('Padang Gelugur', 'district', 'Kabupaten Pasaman', 0),
('Panti', 'district', 'Kabupaten Pasaman', 0),
('Rao', 'district', 'Kabupaten Pasaman', 1),
('Rao Selatan', 'district', 'Kabupaten Pasaman', 0),
('Rao Utara', 'district', 'Kabupaten Pasaman', 0),
('Simpang Alahan Mati', 'district', 'Kabupaten Pasaman', 0),
('Tigo Nagari', 'district', 'Kabupaten Pasaman', 0);

-- ============================================
-- INSERT KABUPATEN PASAMAN BARAT - Kecamatan (11)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Gunung Tuleh', 'district', 'Kabupaten Pasaman Barat', 0),
('Koto Balingka', 'district', 'Kabupaten Pasaman Barat', 0),
('Kinali', 'district', 'Kabupaten Pasaman Barat', 1),
('Lembah Melintang', 'district', 'Kabupaten Pasaman Barat', 1),
('Luhak Nan Duo', 'district', 'Kabupaten Pasaman Barat', 0),
('Pasaman', 'district', 'Kabupaten Pasaman Barat', 1),
('Ranah Batahan', 'district', 'Kabupaten Pasaman Barat', 0),
('Sasak Ranah Pasisia', 'district', 'Kabupaten Pasaman Barat', 0),
('Sei Beremas', 'district', 'Kabupaten Pasaman Barat', 0),
('Talamau', 'district', 'Kabupaten Pasaman Barat', 0),
('Ujung Gading', 'district', 'Kabupaten Pasaman Barat', 0);

-- ============================================
-- INSERT KABUPATEN PESISIR SELATAN - Kecamatan (15)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Airpura', 'district', 'Kabupaten Pesisir Selatan', 0),
('Bayang', 'district', 'Kabupaten Pesisir Selatan', 1),
('Batang Kapas', 'district', 'Kabupaten Pesisir Selatan', 0),
('Basa Ampek Balai Tapan', 'district', 'Kabupaten Pesisir Selatan', 0),
('IV Jurai', 'district', 'Kabupaten Pesisir Selatan', 0),
('IV Nagari Bayang Utara', 'district', 'Kabupaten Pesisir Selatan', 0),
('Koto XI Tarusan', 'district', 'Kabupaten Pesisir Selatan', 1),
('Lengayang', 'district', 'Kabupaten Pesisir Selatan', 0),
('Linggo Sari Baganti', 'district', 'Kabupaten Pesisir Selatan', 0),
('Lunang', 'district', 'Kabupaten Pesisir Selatan', 1),
('Pancung Soal', 'district', 'Kabupaten Pesisir Selatan', 1),
('Ranah Ampek Hulu Tapan', 'district', 'Kabupaten Pesisir Selatan', 0),
('Ranah Pesisir', 'district', 'Kabupaten Pesisir Selatan', 0),
('Silaut', 'district', 'Kabupaten Pesisir Selatan', 0),
('Sutera', 'district', 'Kabupaten Pesisir Selatan', 0);

-- ============================================
-- INSERT KABUPATEN SIJUNJUNG - Kecamatan (8)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('IV Nagari', 'district', 'Kabupaten Sijunjung', 0),
('Kamang Baru', 'district', 'Kabupaten Sijunjung', 0),
('Koto VII', 'district', 'Kabupaten Sijunjung', 0),
('Kupitan', 'district', 'Kabupaten Sijunjung', 0),
('Lubuk Tarok', 'district', 'Kabupaten Sijunjung', 0),
('Sijunjung', 'district', 'Kabupaten Sijunjung', 1),
('Sumpur Kudus', 'district', 'Kabupaten Sijunjung', 1),
('Tanjung Gadang', 'district', 'Kabupaten Sijunjung', 0);

-- ============================================
-- INSERT KABUPATEN SOLOK - Kecamatan (14)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Bukit Sundi', 'district', 'Kabupaten Solok', 0),
('Danau Kembar', 'district', 'Kabupaten Solok', 1),
('Gunung Talang', 'district', 'Kabupaten Solok', 1),
('Hiliran Gumanti', 'district', 'Kabupaten Solok', 0),
('IX Koto Sungai Lasi', 'district', 'Kabupaten Solok', 0),
('Junjung Sirih', 'district', 'Kabupaten Solok', 0),
('Kubung', 'district', 'Kabupaten Solok', 1),
('Lembah Gumanti', 'district', 'Kabupaten Solok', 0),
('Lembang Jaya', 'district', 'Kabupaten Solok', 0),
('Pantai Cermin', 'district', 'Kabupaten Solok', 0),
('Payung Sekaki', 'district', 'Kabupaten Solok', 0),
('Tigo Lurah', 'district', 'Kabupaten Solok', 0),
('X Koto Diatas', 'district', 'Kabupaten Solok', 0),
('X Koto Singkarak', 'district', 'Kabupaten Solok', 1);

-- ============================================
-- INSERT KABUPATEN SOLOK SELATAN - Kecamatan (7)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Koto Parik Gadang Diateh', 'district', 'Kabupaten Solok Selatan', 0),
('Pauh Duo', 'district', 'Kabupaten Solok Selatan', 1),
('Sangir', 'district', 'Kabupaten Solok Selatan', 1),
('Sangir Balai Janggo', 'district', 'Kabupaten Solok Selatan', 0),
('Sangir Batang Hari', 'district', 'Kabupaten Solok Selatan', 0),
('Sangir Jujuan', 'district', 'Kabupaten Solok Selatan', 0),
('Sungai Pagu', 'district', 'Kabupaten Solok Selatan', 0);

-- ============================================
-- INSERT KABUPATEN TANAH DATAR - Kecamatan (14)
-- ============================================
INSERT INTO location_references (name, type, parent_name, is_popular) VALUES
('Batipuh', 'district', 'Kabupaten Tanah Datar', 1),
('Batipuh Selatan', 'district', 'Kabupaten Tanah Datar', 0),
('IX Koto', 'district', 'Kabupaten Tanah Datar', 0),
('Lima Kaum', 'district', 'Kabupaten Tanah Datar', 1),
('Lintau Buo', 'district', 'Kabupaten Tanah Datar', 0),
('Lintau Buo Utara', 'district', 'Kabupaten Tanah Datar', 0),
('Padang Ganting', 'district', 'Kabupaten Tanah Datar', 0),
('Pariangan', 'district', 'Kabupaten Tanah Datar', 1),
('Rambatan', 'district', 'Kabupaten Tanah Datar', 0),
('Salimpaung', 'district', 'Kabupaten Tanah Datar', 0),
('Sungai Tarab', 'district', 'Kabupaten Tanah Datar', 0),
('Sungayang', 'district', 'Kabupaten Tanah Datar', 0),
('Tanjung Baru', 'district', 'Kabupaten Tanah Datar', 0),
('Tanjung Emas', 'district', 'Kabupaten Tanah Datar', 0);

-- ============================================
-- TOTAL: 7 Kota + 148 Kecamatan = 155 Lokasi
-- ============================================

-- Verifikasi data yang sudah diinsert
SELECT 
    type,
    COUNT(*) as total,
    SUM(CASE WHEN is_popular = 1 THEN 1 ELSE 0 END) as popular_count
FROM location_references 
GROUP BY type;

-- Lihat semua lokasi populer
SELECT name, type, parent_name 
FROM location_references 
WHERE is_popular = 1 
ORDER BY type, name;


-- ============================================
-- KABUPATEN DHARMASRAYA - Kecamatan (11)
-- ============================================
-- Asam Jujuhan, IX Koto, Koto Baru, Koto Besar, Padang Laweh
-- Pulau Punjung, Sei Rumbai, Sitiung, Timpeh, Tiumang, XI Tarusan

-- ============================================
-- KABUPATEN KEPULAUAN MENTAWAI - Kecamatan (10)
-- ============================================
-- Pagai Selatan, Pagai Utara, Siberut Barat, Siberut Barat Daya, Siberut Selatan
-- Siberut Tengah, Siberut Utara, Sikakap, Sipora Selatan, Sipora Utara

-- ============================================
-- KABUPATEN LIMA PULUH KOTA - Kecamatan (13)
-- ============================================
-- Akabiluru, Bukik Barisan, Guguak, Gunuang Omeh, Harau
-- Kapur IX, Lareh Sago Halaban, Luak, Mungka, Pangkalan Koto Baru
-- Payakumbuh, Situjuah Limo Nagari, Suliki

-- ============================================
-- KABUPATEN PADANG PARIAMAN - Kecamatan (17)
-- ============================================
-- 2x11 Enam Lingkung, 2x11 Kayu Tanam, Batang Anai, Batang Gasan, Enam Lingkung
-- IV Koto Aur Malintang, Lubuk Alung, Nan Sabaris, Padang Sago, Patamuan
-- Sei Geringging, Sei Limau, Sintuk Toboh Gadang, Sungai Garingging, Sungai Limau
-- Ulakan Tapakih, V Koto Kampung Dalam

-- ============================================
-- KABUPATEN PASAMAN - Kecamatan (12)
-- ============================================
-- Bonjol, Duo Koto, Lubuk Sikaping, Mapat Tunggul, Mapat Tunggul Selatan
-- Padang Gelugur, Panti, Rao, Rao Selatan, Rao Utara
-- Simpang Alahan Mati, Tigo Nagari

-- ============================================
-- KABUPATEN PASAMAN BARAT - Kecamatan (11)
-- ============================================
-- Gunung Tuleh, Koto Balingka, Kinali, Lembah Melintang, Luhak Nan Duo
-- Pasaman, Ranah Batahan, Sasak Ranah Pasisia, Sei Beremas, Talamau, Ujung Gading

-- ============================================
-- KABUPATEN PESISIR SELATAN - Kecamatan (15)
-- ============================================
-- Airpura, Bayang, Batang Kapas, Basa Ampek Balai Tapan, IV Jurai
-- IV Nagari Bayang Utara, Koto XI Tarusan, Lengayang, Linggo Sari Baganti, Lunang
-- Pancung Soal, Ranah Ampek Hulu Tapan, Ranah Pesisir, Silaut, Sutera

-- ============================================
-- KABUPATEN SIJUNJUNG - Kecamatan (8)
-- ============================================
-- IV Nagari, Kamang Baru, Koto VII, Kupitan
-- Lubuk Tarok, Sijunjung, Sumpur Kudus, Tanjung Gadang

-- ============================================
-- KABUPATEN SOLOK - Kecamatan (14)
-- ============================================
-- Bukit Sundi, Danau Kembar, Gunung Talang, Hiliran Gumanti, IX Koto Sungai Lasi
-- Junjung Sirih, Kubung, Lembah Gumanti, Lembang Jaya, Pantai Cermin
-- Payung Sekaki, Tigo Lurah, X Koto Diatas, X Koto Singkarak

-- ============================================
-- KABUPATEN SOLOK SELATAN - Kecamatan (7)
-- ============================================
-- Koto Parik Gadang Diateh, Pauh Duo, Sangir, Sangir Balai Janggo
-- Sangir Batang Hari, Sangir Jujuan, Sungai Pagu

-- ============================================
-- KABUPATEN TANAH DATAR - Kecamatan (14)
-- ============================================
-- Batipuh, Batipuh Selatan, IX Koto, Lima Kaum, Lintau Buo
-- Lintau Buo Utara, Padang Ganting, Pariangan, Rambatan, Salimpaung
-- Sungai Tarab, Sungayang, Tanjung Baru, Tanjung Emas

-- ============================================
-- CONTOH PENGGUNAAN:
-- Untuk menambahkan rute travel, gunakan nama lokasi di atas
-- sebagai origin dan destination
-- ============================================

-- Contoh: Rute Antar Kota
-- INSERT INTO travels (po_id, vehicle_id, route_name, origin, destination, departure_time, price, status) 
-- VALUES 
-- (1, 1, 'Padang - Bukittinggi', 'Padang', 'Bukittinggi', '2025-11-23 06:00:00', 50000, 'scheduled'),
-- (1, 2, 'Padang - Payakumbuh', 'Padang', 'Payakumbuh', '2025-11-23 07:00:00', 60000, 'scheduled'),
-- (1, 3, 'Padang - Solok', 'Padang', 'Solok', '2025-11-23 08:00:00', 35000, 'scheduled');

-- Contoh: Rute Kota ke Kecamatan
-- INSERT INTO travels (po_id, vehicle_id, route_name, origin, destination, departure_time, price, status) 
-- VALUES 
-- (1, 4, 'Padang - Lubuk Basung', 'Padang', 'Lubuk Basung', '2025-11-23 09:00:00', 45000, 'scheduled'),
-- (1, 5, 'Bukittinggi - Batusangkar', 'Bukittinggi', 'Batusangkar', '2025-11-23 10:00:00', 25000, 'scheduled'),
-- (1, 6, 'Padang - Painan', 'Padang', 'Painan', '2025-11-23 11:00:00', 55000, 'scheduled');

-- ============================================
-- DAFTAR LENGKAP NAMA LOKASI UNTUK COPY-PASTE
-- ============================================

-- KOTA (7):
-- Padang, Bukittinggi, Payakumbuh, Sawahlunto, Solok, Padang Panjang, Pariaman

-- KAB. AGAM - KECAMATAN (16):
-- Ampek Angkek, Ampek Nagari, Banuhampu, Baso, Candung, IV Angkek Candung, IV Koto, Kamang Magek, Lubuk Basung, Malalak, Palembayan, Palupuh, Sungai Pua, Tanjung Mutiara, Tanjung Raya, Tilatang Kamang

-- KAB. DHARMASRAYA - KECAMATAN (11):
-- Asam Jujuhan, IX Koto, Koto Baru, Koto Besar, Padang Laweh, Pulau Punjung, Sei Rumbai, Sitiung, Timpeh, Tiumang, XI Tarusan

-- KAB. KEPULAUAN MENTAWAI - KECAMATAN (10):
-- Pagai Selatan, Pagai Utara, Siberut Barat, Siberut Barat Daya, Siberut Selatan, Siberut Tengah, Siberut Utara, Sikakap, Sipora Selatan, Sipora Utara

-- KAB. LIMA PULUH KOTA - KECAMATAN (13):
-- Akabiluru, Bukik Barisan, Guguak, Gunuang Omeh, Harau, Kapur IX, Lareh Sago Halaban, Luak, Mungka, Pangkalan Koto Baru, Payakumbuh, Situjuah Limo Nagari, Suliki

-- KAB. PADANG PARIAMAN - KECAMATAN (17):
-- 2x11 Enam Lingkung, 2x11 Kayu Tanam, Batang Anai, Batang Gasan, Enam Lingkung, IV Koto Aur Malintang, Lubuk Alung, Nan Sabaris, Padang Sago, Patamuan, Sei Geringging, Sei Limau, Sintuk Toboh Gadang, Sungai Garingging, Sungai Limau, Ulakan Tapakih, V Koto Kampung Dalam

-- KAB. PASAMAN - KECAMATAN (12):
-- Bonjol, Duo Koto, Lubuk Sikaping, Mapat Tunggul, Mapat Tunggul Selatan, Padang Gelugur, Panti, Rao, Rao Selatan, Rao Utara, Simpang Alahan Mati, Tigo Nagari

-- KAB. PASAMAN BARAT - KECAMATAN (11):
-- Gunung Tuleh, Koto Balingka, Kinali, Lembah Melintang, Luhak Nan Duo, Pasaman, Ranah Batahan, Sasak Ranah Pasisia, Sei Beremas, Talamau, Ujung Gading

-- KAB. PESISIR SELATAN - KECAMATAN (15):
-- Airpura, Bayang, Batang Kapas, Basa Ampek Balai Tapan, IV Jurai, IV Nagari Bayang Utara, Koto XI Tarusan, Lengayang, Linggo Sari Baganti, Lunang, Pancung Soal, Ranah Ampek Hulu Tapan, Ranah Pesisir, Silaut, Sutera

-- KAB. SIJUNJUNG - KECAMATAN (8):
-- IV Nagari, Kamang Baru, Koto VII, Kupitan, Lubuk Tarok, Sijunjung, Sumpur Kudus, Tanjung Gadang

-- KAB. SOLOK - KECAMATAN (14):
-- Bukit Sundi, Danau Kembar, Gunung Talang, Hiliran Gumanti, IX Koto Sungai Lasi, Junjung Sirih, Kubung, Lembah Gumanti, Lembang Jaya, Pantai Cermin, Payung Sekaki, Tigo Lurah, X Koto Diatas, X Koto Singkarak

-- KAB. SOLOK SELATAN - KECAMATAN (7):
-- Koto Parik Gadang Diateh, Pauh Duo, Sangir, Sangir Balai Janggo, Sangir Batang Hari, Sangir Jujuan, Sungai Pagu

-- KAB. TANAH DATAR - KECAMATAN (14):
-- Batipuh, Batipuh Selatan, IX Koto, Lima Kaum, Lintau Buo, Lintau Buo Utara, Padang Ganting, Pariangan, Rambatan, Salimpaung, Sungai Tarab, Sungayang, Tanjung Baru, Tanjung Emas

-- ============================================
-- TOTAL: 7 Kota + 12 Kabupaten + 148 Kecamatan
-- ============================================
