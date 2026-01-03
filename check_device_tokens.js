const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDeviceTokens() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'travel_booking',
    port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  });

  console.log('📱 Checking device_tokens table...\n');

  // Check all tokens
  const [allTokens] = await connection.query('SELECT * FROM device_tokens');
  console.log(`Total tokens in database: ${allTokens.length}`);
  console.log(JSON.stringify(allTokens, null, 2));
  console.log('');

  // Check active tokens for user 1
  const [activeTokens] = await connection.query(
    'SELECT * FROM device_tokens WHERE user_id = ? AND is_active = TRUE',
    [1]
  );
  console.log(`Active tokens for user_id 1: ${activeTokens.length}`);
  console.log(JSON.stringify(activeTokens, null, 2));

  await connection.end();
}

checkDeviceTokens().catch(console.error);
