const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database with timeout protection (OPTIONAL - for routes that need it)
let db = null;
try {
  const DatabaseModule = require('./config/database');
  db = DatabaseModule;
} catch (err) {
  console.error('⚠️ Database initialization error (routes may be unavailable):', err.message);
  // db will be null, but server will still start
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (admin panel)
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files (chat images, driver documents, etc.)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add database to request object
app.use((req, res, next) => {
  req.db = db;
  next();
});

// Simple health check (no DB needed)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Travel API is running', timestamp: new Date().toISOString() });
});

// Routes - Driver App Only (minimal setup)
// Comment out missing routes to avoid crashes
// TODO: Restore other routes when files are available

// Driver endpoints (NEW - for driver app)
app.use('/api/driver-location', require('./routes/trackingRoutes'));
app.use('/api/broadcast', require('./routes/broadcastRoutes')); // Driver broadcast accept/reject
app.use('/api/driver', require('./routes/driverStatusRoutes')); // Driver status & FCM
app.use('/api/driver-auth', require('./routes/driverRegistrationRoutes')); // Driver registration & login

// Commented out routes (files not in repo):
// app.use('/api/student', require('./routes/studentRoutes'));
// app.use('/api/driver', require('./routes/driverRoutes'));
// app.use('/api/drivers', require('./routes/driverRoutes'));
// app.use('/api/driver-simple', require('./routes/driver_simple_login'));
// app.use('/api/po', require('./routes/poRoutes'));
// app.use('/api/admin', require('./routes/adminSetup'));
// app.use('/api/admin', require('./routes/adminDriverRoutes'));
// app.use('/api', require('./routes/poRoutes'));
// app.use('/api/customer', require('./routes/customerRoutes'));
// app.use('/api/auth', require('./routes/otpRoutes'));
// app.use('/api/bookings', require('./routes/bookingRoutes'));
// app.use('/api/payment', require('./routes/paymentRoutes'));
// app.use('/api/locations', require('./routes/locations'));
// app.use('/api/migrate', require('./routes/migrate'));
// app.use('/api/migrate', require('./routes/migrate_tracking'));
// app.use('/api/upload', require('./routes/uploadRoutes'));
// app.use('/api/notifications', require('./routes/notificationRoutes'));
// app.use('/api/admin/migrate', require('./routes/adminMigrationRoutes'));
// app.use('/api/migration', require('./routes/migrationRoutes'));
// app.use('/api/on-demand/driver', require('./routes/onDemandDriver'));
// app.use('/api/pricing', require('./routes/pricingRoutes'));
// app.use('/api/migration/pricing', require('./routes/pricingMigration'));
// app.use('/api/migration/payment', require('./routes/paymentMigration'));
// app.use('/api/chat', require('./routes/chatRoutes'));

// TEMPORARY: Manual migration 005 endpoint (DISABLED - causing startup crashes)
// Uncomment only when needed for manual migrations
/*
app.post('/api/migration/run-005', async (req, res) => {
  const statements = [
    "ALTER TABLE independent_bookings ADD COLUMN vehicle_type VARCHAR(50) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN distance_km DECIMAL(8,2) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN total_fare DECIMAL(10,2) NOT NULL DEFAULT 0",
    "ALTER TABLE independent_bookings ADD COLUMN item_size ENUM('S', 'M', 'L') NULL",
    "ALTER TABLE independent_bookings ADD COLUMN item_type VARCHAR(50) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN item_photo_url VARCHAR(512) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN delivery_guarantee BOOLEAN DEFAULT FALSE",
    "ALTER TABLE independent_bookings ADD COLUMN guarantee_fee DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE independent_bookings ADD COLUMN recipient_name VARCHAR(255) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN recipient_phone VARCHAR(20) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN recipient_address_detail VARCHAR(512) NULL",
    "ALTER TABLE independent_bookings ADD COLUMN recipient_note_to_driver TEXT NULL"
  ];
  
  const results = [];
  for (const statement of statements) {
    try {
      await db.query(statement);
      results.push({ success: true, statement: statement.substring(0, 80) });
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        results.push({ success: true, skipped: true, statement: statement.substring(0, 80) });
      } else {
        results.push({ success: false, error: err.message, statement: statement.substring(0, 80) });
      }
    }
  }
  
  res.json({ success: true, results });
});

// TEMPORARY: Check table schema (REMOVE AFTER USE!)
app.get('/api/migration/schema/independent_bookings', async (req, res) => {
  try {
    const [columns] = await db.query('DESCRIBE independent_bookings');
    res.json({ success: true, columns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// TEMPORARY: Make driver_id nullable (REMOVE AFTER USE!)
app.post('/api/migration/make-driver-nullable', async (req, res) => {
  try {
    await db.query('ALTER TABLE independent_bookings MODIFY driver_id INT NULL');
    res.json({ success: true, message: 'driver_id is now nullable' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// NEW: Province routes with feature flag (backward compatible)
// Set ENABLE_PROVINCE_FEATURES=false in Railway to disable
if (process.env.ENABLE_PROVINCE_FEATURES !== 'false') {
  console.log('✅ Province features ENABLED');
  // app.use('/api/provinces', require('./routes/provinceRoutes')); // DISABLED: provinceRoutes not found
} else {
  console.log('⚠️  Province features DISABLED (feature flag OFF)');
}

// Test database connection and run base migrations (DISABLED: causes startup crash)
/*
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
*/

/* Database initialization disabled - commented out to avoid startup blocking
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

    // Run migration 005 for delivery item and recipient fields
    try {
      const migration005Path = path.join(__dirname, 'migrations', '005_add_delivery_item_and_recipient_fields.sql');
      if (fs.existsSync(migration005Path)) {
        const sql = fs.readFileSync(migration005Path, 'utf8');
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));
        
        for (const statement of statements) {
          await db.query(statement).catch(err => {
            // Ignore "Duplicate column" or "Duplicate key" errors (idempotency)
            if (!err.message.includes('Duplicate column') && 
                !err.message.includes('Duplicate key') &&
                !err.message.includes('already exists')) {
              console.error('Migration 005 statement failed:', statement.substring(0, 100), err.message);
            }
          });
        }
        console.log('✅ Migration 005: Delivery item and recipient fields verified');
      }
    } catch (e) {
      console.error('Failed to run migration 005:', e.message);
    }
  } catch (error) {
    console.error('Error creating additional tables:', error);
  }
*/

// Detailed health check endpoint with DB status (moved to bottom, skipped if DB unavailable)

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Travel API Server running on http://0.0.0.0:${PORT}`);
  console.log(`Access from network: http://192.168.18.7:${PORT}`);
});

// Graceful shutdown handler for Railway deployments
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    db.end()
      .then(() => {
        console.log('Database connections closed');
        process.exit(0);
      })
      .catch(err => {
        console.error('Error closing database:', err);
        process.exit(1);
      });
  });
  
  // Force close after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    console.error('Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
