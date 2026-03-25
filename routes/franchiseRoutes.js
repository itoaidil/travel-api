const express = require('express');
const router = express.Router();

/**
 * POST /api/franchise/register
 * Pendaftaran calon mitra franchise dari landing page
 * Body: {
 *   name, owner_name, phone, email, city, address,
 *   coverage_areas (string dipisah koma), notes
 * }
 */
router.post('/register', async (req, res) => {
  const db = req.db;

  if (!db) {
    return res.status(500).json({
      success: false,
      message: 'Database not available'
    });
  }

  try {
    const {
      name,
      owner_name,
      phone,
      email,
      city,
      address,
      coverage_areas,
      notes
    } = req.body;

    // Validasi field wajib
    if (!name || !owner_name || !phone || !email || !city || !address || !coverage_areas) {
      return res.status(400).json({
        success: false,
        message: 'Semua field wajib diisi: nama bisnis, nama pemilik, telepon, email, kota, alamat, area coverage'
      });
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format email tidak valid'
      });
    }

    // Validasi format telepon (minimal 8 digit, hanya angka/+/-)
    const phoneClean = phone.replace(/[\s\-().]/g, '');
    if (!/^[\+]?[0-9]{8,15}$/.test(phoneClean)) {
      return res.status(400).json({
        success: false,
        message: 'Format nomor telepon tidak valid'
      });
    }

    // Cek duplikat email atau telepon
    const [existing] = await db.query(
      'SELECT id FROM franchise_partners WHERE email = ? OR phone = ? LIMIT 1',
      [email.toLowerCase().trim(), phoneClean]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email atau nomor telepon sudah terdaftar sebelumnya'
      });
    }

    // Insert ke franchise_partners dengan status pending
    const [result] = await db.query(
      `INSERT INTO franchise_partners (name, owner_name, phone, email, city, address, notes, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [
        name.trim(),
        owner_name.trim(),
        phoneClean,
        email.toLowerCase().trim(),
        city.trim(),
        address.trim(),
        notes ? notes.trim() : null
      ]
    );

    const franchisePartnerId = result.insertId;

    // Parse coverage_areas: split by koma, trim, buang yang kosong
    const kabupatenList = coverage_areas
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (kabupatenList.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu area coverage harus diisi'
      });
    }

    // Insert tiap kabupaten ke franchise_coverage_areas
    for (const kabupaten of kabupatenList) {
      await db.query(
        `INSERT INTO franchise_coverage_areas (franchise_partner_id, kabupaten_name, is_active, created_at)
         VALUES (?, ?, 1, NOW())`,
        [franchisePartnerId, kabupaten]
      );
    }

    console.log(`✅ Franchise registration: ${name} (${owner_name}) - ${kabupatenList.length} area(s) - ID: ${franchisePartnerId}`);

    return res.status(201).json({
      success: true,
      message: 'Pendaftaran berhasil! Tim kami akan menghubungi Anda dalam 1-3 hari kerja.',
      data: {
        id: franchisePartnerId,
        name: name.trim(),
        owner_name: owner_name.trim(),
        city: city.trim(),
        coverage_areas: kabupatenList,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('❌ Error franchise registration:', error);
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan. Silakan coba lagi.',
      error: error.message
    });
  }
});

module.exports = router;
