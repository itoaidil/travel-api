const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/student', require('./routes/studentRoutes'));
app.use('/api/driver', require('./routes/driverRoutes'));
app.use('/api/po', require('./routes/poRoutes'));
app.use('/api/customer', require('./routes/customerRoutes'));
app.use('/api/payment', require('./routes/paymentRoutes'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/migrate', require('./routes/migrate'));

// Test database connection and run base migrations
db.getConnection()
  .then(connection => {
    console.log('Database connected successfully');
    connection.release();
    
    // Run base table migrations first
    const baseSQLPath = path.join(__dirname, 'migrations', '00_create_base_tables.sql');
    
    if (fs.existsSync(baseSQLPath)) {
      const baseSQL = fs.readFileSync(baseSQLPath, 'utf8');
      const statements = baseSQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
      
      Promise.all(
        statements.map(statement => 
          db.query(statement).catch(err => {
            if (!err.message.includes('already exists')) {
              console.error('Migration statement failed:', err.message);
            }
          })
        )
      ).then(() => {
        console.log('Base tables verified');
        createAdditionalTables();
      });
    } else {
      // If migration file doesn't exist, proceed with additional tables
      createAdditionalTables();
    }
  })
  .catch(err => {
    console.error('Database connection failed:', err);
  });

async function createAdditionalTables() {
  // Ensure customers table exists (used by customer registration/login)
  const createCustomersTable = `CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(20) NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (email),
    INDEX (phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`;

  // Ensure reviews table exists
  const createReviewsTable = `CREATE TABLE IF NOT EXISTS po_reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    po_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (po_id),
    FOREIGN KEY (po_id) REFERENCES pos(id) ON DELETE CASCADE
  )`;
  
  // Booking seats table
  const createBookingSeatsTable = `CREATE TABLE IF NOT EXISTS booking_seats (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    seat_number VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (booking_id),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
  )`;
  
  // Ensure student_auth table exists
  const createStudentAuthTable = `CREATE TABLE IF NOT EXISTS student_auth (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    INDEX (email),
    INDEX (student_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
  
  try {
    await db.query(createCustomersTable).catch(err => {
      if (!err.message.includes('already exists')) {
        console.error('Failed ensuring customers table:', err.message);
      }
    });

    await db.query(createReviewsTable).catch(err => {
      if (!err.message.includes('already exists')) {
        console.error('Failed ensuring po_reviews table:', err.message);
      }
    });
    
    await db.query(createBookingSeatsTable).catch(err => {
      if (!err.message.includes('already exists')) {
        console.error('Failed ensuring booking_seats table:', err.message);
      }
    });
    
    await db.query(createStudentAuthTable).catch(err => {
      if (!err.message.includes('already exists')) {
        console.error('Failed ensuring student_auth table:', err.message);
      }
    });
    
    console.log('Additional tables verified: po_reviews, booking_seats');
    console.log('✅ student_auth table verified');
    console.log('✅ Database initialization complete');
  } catch (error) {
    console.error('Error creating additional tables:', error);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Travel API Server is running' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel API Server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from network: http://192.168.18.7:${PORT}`);
});
