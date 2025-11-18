const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'travel_booking',
  });

  try {
    console.log('🚀 Running migration: add_pickup_dropoff_coordinates.sql');

    // Add columns for pickup and dropoff coordinates
    await connection.query(`
      ALTER TABLE bookings 
      ADD COLUMN IF NOT EXISTS pickup_lat DECIMAL(10, 8) NULL,
      ADD COLUMN IF NOT EXISTS pickup_lng DECIMAL(11, 8) NULL,
      ADD COLUMN IF NOT EXISTS pickup_address TEXT NULL,
      ADD COLUMN IF NOT EXISTS dropoff_lat DECIMAL(10, 8) NULL,
      ADD COLUMN IF NOT EXISTS dropoff_lng DECIMAL(11, 8) NULL,
      ADD COLUMN IF NOT EXISTS dropoff_address TEXT NULL
    `);

    console.log('✅ Successfully added pickup/dropoff columns to bookings table');

    // Add indexes (akan skip jika sudah ada)
    try {
      await connection.query(`
        CREATE INDEX idx_bookings_pickup ON bookings(pickup_lat, pickup_lng)
      `);
      console.log('✅ Created index idx_bookings_pickup');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index idx_bookings_pickup already exists');
      } else {
        throw err;
      }
    }

    try {
      await connection.query(`
        CREATE INDEX idx_bookings_dropoff ON bookings(dropoff_lat, dropoff_lng)
      `);
      console.log('✅ Created index idx_bookings_dropoff');
    } catch (err) {
      if (err.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️  Index idx_bookings_dropoff already exists');
      } else {
        throw err;
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration();
