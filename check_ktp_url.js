const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkKTPUrl() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    const [drivers] = await connection.execute(`
      SELECT id, full_name, ktp_photo_url, selfie_photo_url 
      FROM independent_drivers 
      WHERE id = 5
    `);
    
    console.log('Driver KTP Data:');
    console.log(JSON.stringify(drivers[0], null, 2));
    console.log('\n');
    console.log('KTP URL length:', drivers[0].ktp_photo_url.length);
    console.log('KTP URL:', drivers[0].ktp_photo_url);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkKTPUrl();
