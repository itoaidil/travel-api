const mysql = require('mysql2/promise');
require('dotenv').config();

async function addFCMTokenColumn() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('Adding fcm_token column to independent_drivers table...');
    
    await connection.query(`
      ALTER TABLE independent_drivers 
      ADD COLUMN IF NOT EXISTS fcm_token VARCHAR(255)
    `);
    
    console.log('✅ fcm_token column added successfully');
    
    await connection.query(`
      ALTER TABLE independent_drivers
      ADD INDEX IF NOT EXISTS idx_fcm_token (fcm_token)
    `);
    
    console.log('✅ Index on fcm_token created successfully');
    
    await connection.query(`
      ALTER TABLE independent_drivers
      ADD COLUMN IF NOT EXISTS last_fcm_update TIMESTAMP NULL
    `);
    
    console.log('✅ last_fcm_update column added successfully');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

addFCMTokenColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
