require('dotenv').config();
const mysql = require('mysql2/promise');

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to Railway database...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Connected to database');
    console.log('');

    // Check if column exists first
    console.log('🔍 Checking if verification_status column exists...');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'independent_drivers' 
      AND COLUMN_NAME = 'verification_status'
    `, [process.env.DB_NAME]);

    if (columns.length > 0) {
      console.log('⚠️  verification_status column already exists!');
      console.log('');
    } else {
      console.log('➕ Adding verification_status column...');
      
      await connection.execute(`
        ALTER TABLE independent_drivers
        ADD COLUMN verification_status ENUM('pending', 'approved', 'rejected') 
        NOT NULL DEFAULT 'pending' 
        AFTER is_active
      `);
      
      console.log('✅ verification_status column added');
      console.log('');
    }

    // Add other columns if they don't exist
    console.log('🔍 Checking if verified_at column exists...');
    const [verifiedAtColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'independent_drivers' 
      AND COLUMN_NAME = 'verified_at'
    `, [process.env.DB_NAME]);

    if (verifiedAtColumns.length === 0) {
      console.log('➕ Adding verified_at column...');
      await connection.execute(`
        ALTER TABLE independent_drivers
        ADD COLUMN verified_at TIMESTAMP NULL AFTER verification_status
      `);
      console.log('✅ verified_at column added');
    } else {
      console.log('⚠️  verified_at column already exists!');
    }
    console.log('');

    console.log('🔍 Checking if admin_notes column exists...');
    const [adminNotesColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'independent_drivers' 
      AND COLUMN_NAME = 'admin_notes'
    `, [process.env.DB_NAME]);

    if (adminNotesColumns.length === 0) {
      console.log('➕ Adding admin_notes column...');
      await connection.execute(`
        ALTER TABLE independent_drivers
        ADD COLUMN admin_notes TEXT NULL AFTER verified_at
      `);
      console.log('✅ admin_notes column added');
    } else {
      console.log('⚠️  admin_notes column already exists!');
    }
    console.log('');

    console.log('🔍 Checking if rejection_reason column exists...');
    const [rejectionColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'independent_drivers' 
      AND COLUMN_NAME = 'rejection_reason'
    `, [process.env.DB_NAME]);

    if (rejectionColumns.length === 0) {
      console.log('➕ Adding rejection_reason column...');
      await connection.execute(`
        ALTER TABLE independent_drivers
        ADD COLUMN rejection_reason TEXT NULL AFTER admin_notes
      `);
      console.log('✅ rejection_reason column added');
    } else {
      console.log('⚠️  rejection_reason column already exists!');
    }
    console.log('');

    // Show current table structure
    console.log('📋 Current table structure:');
    const [structure] = await connection.execute('DESCRIBE independent_drivers');
    console.table(structure);
    console.log('');

    // Show existing drivers
    console.log('👥 Current drivers:');
    const [drivers] = await connection.execute(`
      SELECT id, full_name, phone, verification_status, created_at 
      FROM independent_drivers
      ORDER BY created_at DESC
    `);
    console.table(drivers);
    console.log('');

    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('');
    console.error('Error details:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('');
      console.log('🔌 Database connection closed');
    }
  }
}

runMigration();
