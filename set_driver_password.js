const bcryptjs = require('bcryptjs');
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway',
  port: 31765
};

async function updateDriverPassword() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    const hashedPassword = await bcryptjs.hash('driver123', 10);
    
    const [result] = await conn.query(
      'UPDATE users SET password = ? WHERE id = 155',
      [hashedPassword]
    );
    
    console.log('✅ Driver (ID 155) password updated to: driver123');
    console.log('   Phone: 085213947740');
    console.log('   Driver ID: 45');
    console.log('   PO ID: 67');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await conn.end();
  }
}

updateDriverPassword();
