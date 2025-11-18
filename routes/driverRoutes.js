const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET driver's assigned travels
router.get('/travels/:driver_id', (req, res) => {
  const { driver_id } = req.params;
  const query = `
    SELECT t.*, p.po_name, v.plate_number, v.vehicle_type
    FROM travels t
    JOIN pos p ON t.po_id = p.id
    JOIN vehicles v ON t.vehicle_id = v.id
    WHERE t.driver_id = ?
    ORDER BY t.departure_time
  `;
  
  db.query(query, [driver_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// GET bookings for specific travel
router.get('/travels/:travel_id/bookings', (req, res) => {
  const { travel_id } = req.params;
  const query = `
    SELECT b.*, s.full_name as student_name, u.phone as student_phone,
           u.email as student_email
    FROM bookings b
    JOIN students s ON b.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE b.travel_id = ?
    ORDER BY b.created_at
  `;
  
  db.query(query, [travel_id], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// PUT update travel status
router.put('/travels/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const query = 'UPDATE travels SET status = ? WHERE id = ?';
  
  db.query(query, [status, id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true, message: 'Travel status updated' });
  });
});

module.exports = router;
