const mysql = require('mysql2/promise');
require('dotenv').config();

async function addVehiclePhotoColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Adding vehicle_photo_url column to independent_drivers...');
    await connection.query(`
      ALTER TABLE independent_drivers
      ADD COLUMN IF NOT EXISTS vehicle_photo_url VARCHAR(500) NULL
      AFTER last_fcm_update
    `);
    console.log('✅ vehicle_photo_url column added successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addVehiclePhotoColumn()
  .then(() => { console.log('Migration completed'); process.exit(0); })
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); });
