const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDriversTable() {
  console.log('🔧 Creating drivers table in Railway...\n');
  
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  
  try {
    // Create drivers table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS drivers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        license_number VARCHAR(50),
        rating DECIMAL(3,2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Table drivers created');
    
    // Insert sample drivers
    const [users] = await connection.execute(
      "SELECT id FROM users WHERE user_type = 'driver' LIMIT 2"
    );
    
    if (users.length > 0) {
      await connection.execute(`
        INSERT IGNORE INTO drivers (user_id, full_name, license_number, rating) VALUES
        (?, 'Agus Setiawan', 'DL001', 4.5),
        (?, 'Budi Hartono', 'DL002', 4.7)
      `, [users[0].id, users[1]?.id || users[0].id]);
      console.log('✅ Sample drivers inserted\n');
    } else {
      console.log('⚠️  No driver users found. Please seed users first.\n');
    }
    
    // Verify
    const [drivers] = await connection.execute('SELECT * FROM drivers');
    console.log(`📊 Total drivers: ${drivers.length}`);
    drivers.forEach(d => console.log(`   - ${d.full_name} (User ID: ${d.user_id})`));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

createDriversTable();
