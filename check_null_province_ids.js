// Check which locations have NULL province_id
const mysql = require('mysql2/promise');

async function checkNullProvinceIds() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'proxy.proxy.rlwy.net',
    port: process.env.DB_PORT || 34237,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'PytEzbaqaOqnYidKaFkJuUdHAmCGBRbB',
    database: process.env.DB_NAME || 'railway'
  });

  try {
    console.log('\n🔍 Checking locations with NULL province_id...\n');

    const [results] = await connection.execute(`
      SELECT id, name, type, parent_name, province_id 
      FROM location_references 
      WHERE province_id IS NULL 
      ORDER BY type, name
      LIMIT 50
    `);

    console.log(`Found ${results.length} locations with NULL province_id:\n`);
    
    results.forEach(row => {
      console.log(`ID: ${row.id} | ${row.type.padEnd(10)} | ${row.name.padEnd(20)} | Parent: ${row.parent_name || 'N/A'}`);
    });

    // Check Padang specifically
    console.log('\n\n🎯 Checking Padang specifically:\n');
    const [padang] = await connection.execute(`
      SELECT * FROM location_references WHERE name LIKE '%Padang%' LIMIT 5
    `);
    
    padang.forEach(row => {
      console.log(JSON.stringify(row, null, 2));
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkNullProvinceIds();
