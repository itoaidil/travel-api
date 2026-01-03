// Check provinces table
const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkProvinces() {
  const connection = await mysql.createConnection({
    host: process.env.RAILWAY_DB_HOST,
    port: process.env.RAILWAY_DB_PORT,
    user: process.env.RAILWAY_DB_USER,
    password: process.env.RAILWAY_DB_PASSWORD,
    database: process.env.RAILWAY_DB_NAME
  });

  try {
    console.log('\n📋 ALL PROVINCES:\n');
    const [provinces] = await connection.execute(`
      SELECT id, name FROM provinces ORDER BY id
    `);
    
    provinces.forEach(p => {
      console.log(`ID: ${p.id}\t| ${p.name}`);
    });

    console.log('\n\n🔍 Checking current location_references with province_id:\n');
    const [locations] = await connection.execute(`
      SELECT lr.id, lr.name, lr.type, lr.province_id, p.name as province_name
      FROM location_references lr
      LEFT JOIN provinces p ON lr.province_id = p.id
      WHERE lr.province_id IS NOT NULL
      LIMIT 10
    `);
    
    locations.forEach(l => {
      console.log(`Location: ${l.name} | province_id: ${l.province_id} | Province: ${l.province_name || 'NOT FOUND IN PROVINCES TABLE!'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkProvinces();
