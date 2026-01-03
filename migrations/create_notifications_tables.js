const mysql = require('mysql2/promise');
require('dotenv').config();

// Create database connection - support both Railway and local
const dbConfig = process.env.MYSQLHOST ? {
  // Railway production config
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER || 'root',
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE || 'railway',
  port: process.env.MYSQLPORT || 3306,
} : {
  // Local development config
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'travel_booking',
  port: process.env.DB_PORT || 3306,
};

const db = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
});

async function createNotificationsTables() {
  try {
    console.log('🚀 Creating notifications tables...\n');
    console.log('Database config:', {
      host: dbConfig.host,
      database: dbConfig.database,
      user: dbConfig.user,
    });
    console.log('');

    // 1. Create device_tokens table
    console.log('Creating device_tokens table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        device_token VARCHAR(255) NOT NULL UNIQUE,
        device_type ENUM('android', 'ios', 'web') DEFAULT 'android',
        app_type ENUM('customer', 'driver', 'po_admin') NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_app (user_id, app_type),
        INDEX idx_token_active (device_token, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ device_tokens table created\n');

    // 2. Create notifications table
    console.log('Creating notifications table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        type ENUM('booking_created', 'booking_confirmed', 'booking_cancelled', 
                  'payment_success', 'payment_failed', 'driver_assigned', 
                  'trip_started', 'trip_completed', 'general') DEFAULT 'general',
        reference_type ENUM('booking', 'travel', 'payment', 'driver', 'vehicle') NULL,
        reference_id INT NULL,
        data JSON NULL COMMENT 'Additional data as JSON object',
        is_read BOOLEAN DEFAULT FALSE,
        is_sent BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP NULL,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_unread (user_id, is_read, created_at),
        INDEX idx_reference (reference_type, reference_id),
        INDEX idx_type_created (type, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ notifications table created\n');

    // 3. Create notification_settings table (optional - for user preferences)
    console.log('Creating notification_settings table...');
    await db.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL UNIQUE,
        booking_notifications BOOLEAN DEFAULT TRUE,
        payment_notifications BOOLEAN DEFAULT TRUE,
        trip_notifications BOOLEAN DEFAULT TRUE,
        marketing_notifications BOOLEAN DEFAULT FALSE,
        email_notifications BOOLEAN DEFAULT TRUE,
        push_notifications BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ notification_settings table created\n');

    console.log('✅ All notification tables created successfully!\n');
    
    // Show table structures
    console.log('📋 Table structures:');
    const [deviceTokens] = await db.query('DESCRIBE device_tokens');
    console.log('\ndevice_tokens:');
    console.table(deviceTokens.map(col => ({ Field: col.Field, Type: col.Type, Null: col.Null, Key: col.Key })));
    
    const [notifications] = await db.query('DESCRIBE notifications');
    console.log('\nnotifications:');
    console.table(notifications.map(col => ({ Field: col.Field, Type: col.Type, Null: col.Null, Key: col.Key })));
    
    const [settings] = await db.query('DESCRIBE notification_settings');
    console.log('\nnotification_settings:');
    console.table(settings.map(col => ({ Field: col.Field, Type: col.Type, Null: col.Null, Key: col.Key })));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating notifications tables:', error.message);
    console.error(error);
    process.exit(1);
  }
}

createNotificationsTables();
