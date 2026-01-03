const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT || 3306,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function runMigration() {
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

  console.log('Starting migration 005...');
  
  for (const statement of statements) {
    try {
      await pool.query(statement);
      console.log('✅', statement.substring(0, 80));
    } catch (err) {
      if (err.message.includes('Duplicate column')) {
        console.log('⏭️  Column already exists:', statement.substring(0, 80));
      } else {
        console.error('❌', statement.substring(0, 80));
        console.error('   Error:', err.message);
      }
    }
  }
  
  console.log('\nVerifying columns...');
  const [rows] = await pool.query("DESCRIBE independent_bookings");
  const columns = rows.map(r => r.Field);
  
  const requiredColumns = ['vehicle_type', 'distance_km', 'total_fare', 'item_size', 'item_type', 
                           'item_photo_url', 'delivery_guarantee', 'guarantee_fee', 
                           'recipient_name', 'recipient_phone', 'recipient_address_detail', 
                           'recipient_note_to_driver'];
  
  console.log('\nColumn verification:');
  requiredColumns.forEach(col => {
    const exists = columns.includes(col);
    console.log(exists ? '✅' : '❌', col);
  });
  
  await pool.end();
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
