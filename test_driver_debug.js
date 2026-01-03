const mysql = require('mysql2/promise');
require('dotenv').config();

async function test() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log('Testing driver data...\n');
  
  const [users] = await conn.execute("SELECT id, phone, user_type FROM users WHERE user_type = 'driver'");
  console.log(`Users (driver type): ${users.length} found`);
  users.forEach(u => console.log(`  - ${u.phone}`));
  
  const [drivers] = await conn.execute("SELECT * FROM drivers LIMIT 5");
  console.log(`\nDrivers table: ${drivers.length} records`);
  drivers.forEach(d => console.log(`  - User ID: ${d.user_id}, Name: ${d.full_name}`));
  
  await conn.end();
}

test().catch(console.error);
