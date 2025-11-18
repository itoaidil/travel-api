const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');

// Register new customer
router.post('/register', async (req, res) => {
  const { full_name, email, phone, password } = req.body;

  // Validation
  if (!full_name || !email || !phone || !password) {
    return res.status(400).json({
      success: false,
      message: 'Semua field harus diisi'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Password minimal 6 karakter'
    });
  }

  try {
    // Check if email already exists
    const checkEmailQuery = 'SELECT id FROM customers WHERE email = ?';
    db.query(checkEmailQuery, [email], async (err, results) => {
      if (err) {
        console.error('Error checking email:', err);
        return res.status(500).json({
          success: false,
          message: 'Terjadi kesalahan server'
        });
      }

      if (results.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Email sudah terdaftar'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new customer
      const insertQuery = `
        INSERT INTO customers (full_name, email, phone, password, is_active)
        VALUES (?, ?, ?, ?, 1)
      `;

      db.query(insertQuery, [full_name, email, phone, hashedPassword], (err, result) => {
        if (err) {
          console.error('Error inserting customer:', err);
          return res.status(500).json({
            success: false,
            message: 'Gagal mendaftar, coba lagi'
          });
        }

        res.status(201).json({
          success: true,
          message: 'Pendaftaran berhasil!',
          data: {
            id: result.insertId,
            full_name,
            email,
            phone
          }
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

// Login customer
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email dan password harus diisi'
    });
  }

  const query = 'SELECT * FROM customers WHERE email = ? AND is_active = 1';

  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error('Error during login:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server'
      });
    }

    if (results.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    const customer = results[0];

    // Compare password
    const isPasswordValid = await bcrypt.compare(password, customer.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    // Return customer data (without password)
    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id: customer.id,
        full_name: customer.full_name,
        email: customer.email,
        phone: customer.phone
      }
    });
  });
});

// Get customer profile
router.get('/profile/:id', (req, res) => {
  const customerId = req.params.id;

  const query = 'SELECT id, full_name, email, phone, created_at FROM customers WHERE id = ? AND is_active = 1';

  db.query(query, [customerId], (err, results) => {
    if (err) {
      console.error('Error fetching profile:', err);
      return res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan server'
      });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Customer tidak ditemukan'
      });
    }

    res.json({
      success: true,
      data: results[0]
    });
  });
});

// Create booking with payment method
router.post('/booking', (req, res) => {
  const {
    customer_id,
    travel_id,
    selected_seats,
    payment_method,
    total_price,
    pickup_location,
    dropoff_location,
  } = req.body;

  // Validation
  if (!customer_id || !travel_id || !selected_seats || !payment_method || !total_price) {
    return res.status(400).json({
      success: false,
      message: 'Semua field harus diisi',
    });
  }

  if (!Array.isArray(selected_seats) || selected_seats.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Pilih minimal 1 kursi',
    });
  }

  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Gagal memulai transaksi',
      });
    }

    // Check if selected seats are already booked
    const checkSeatsQuery = `
      SELECT bs.seat_number
      FROM booking_seats bs
      JOIN bookings b ON bs.booking_id = b.id
      WHERE b.travel_id = ? 
      AND bs.seat_number IN (?)
      AND b.booking_status IN ('pending', 'confirmed', 'paid', 'boarded', 'completed')
    `;

    db.query(checkSeatsQuery, [travel_id, selected_seats], (err, alreadyBooked) => {
      if (err) {
        return db.rollback(() => {
          console.error('Error checking seats:', err);
          res.status(500).json({
            success: false,
            message: 'Gagal memeriksa ketersediaan kursi',
          });
        });
      }

      if (alreadyBooked.length > 0) {
        const bookedSeatNumbers = alreadyBooked.map(s => s.seat_number);
        return db.rollback(() => {
          res.status(400).json({
            success: false,
            message: `Kursi ${bookedSeatNumbers.join(', ')} sudah dipesan. Silakan pilih kursi lain.`,
            booked_seats: bookedSeatNumbers,
          });
        });
      }

      // Generate booking code
      const bookingCode = 'BK' + Date.now();

      // Insert booking
      const bookingQuery = `
        INSERT INTO bookings 
        (booking_code, student_id, customer_id, travel_id, num_passengers, total_price, payment_method, pickup_location, dropoff_location, booking_status, payment_status)
        VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, 'pending', 'unpaid')
      `;

      db.query(
        bookingQuery,
        [bookingCode, customer_id, travel_id, selected_seats.length, total_price, payment_method, pickup_location, dropoff_location],
        (err, bookingResult) => {
          if (err) {
            return db.rollback(() => {
              console.error('Error inserting booking:', err);
              res.status(500).json({
                success: false,
                message: 'Gagal membuat booking',
            });
          });
        }

        const bookingId = bookingResult.insertId;

        // Insert booking seats
        const seatValues = selected_seats.map((seatNumber) => [
          bookingId,
          seatNumber,
        ]);

        const seatQuery = `
          INSERT INTO booking_seats (booking_id, seat_number)
          VALUES ?
        `;

        db.query(seatQuery, [seatValues], (err) => {
          if (err) {
            return db.rollback(() => {
              console.error('Error inserting seats:', err);
              res.status(500).json({
                success: false,
                message: 'Gagal menyimpan kursi',
              });
            });
          }

          // Commit transaction
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                console.error('Error committing transaction:', err);
                res.status(500).json({
                  success: false,
                  message: 'Gagal menyimpan booking',
                });
              });
            }

            // Return success with booking details
            res.status(201).json({
              success: true,
              message: 'Booking berhasil dibuat',
              data: {
                booking_id: bookingId,
                customer_id,
                travel_id,
                selected_seats,
                num_passengers: selected_seats.length,
                total_price,
                payment_method,
                status: 'pending',
              },
            });
          });
        });
      });
    });
  });
});

// Get customer bookings
router.get('/bookings/:customer_id', (req, res) => {
  const customerId = req.params.customer_id;

  const query = `
    SELECT 
      b.id,
      b.travel_id,
      b.num_passengers,
      b.total_price,
      b.payment_method,
      b.status,
      b.booking_date,
      t.departure_time,
      t.origin,
      t.destination,
      p.po_name,
      GROUP_CONCAT(bs.seat_number ORDER BY bs.seat_number) as seats
    FROM bookings b
    JOIN travels t ON b.travel_id = t.id
    JOIN vehicles v ON t.vehicle_id = v.id
    JOIN pos p ON v.po_id = p.id
    LEFT JOIN booking_seats bs ON b.id = bs.booking_id
    WHERE b.customer_id = ?
    GROUP BY b.id
    ORDER BY b.booking_date DESC
  `;

  db.query(query, [customerId], (err, results) => {
    if (err) {
      console.error('Error fetching bookings:', err);
      return res.status(500).json({
        success: false,
        message: 'Gagal mengambil data booking',
      });
    }

    res.json({
      success: true,
      data: results,
    });
  });
});

module.exports = router;
