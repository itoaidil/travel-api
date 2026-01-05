require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkTable() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306
  });

  console.log('🔍 Checking independent_drivers table structure...\n');
  
  const [columns] = await connection.query(`
    SHOW COLUMNS FROM independent_drivers
  `);
  
  console.log('📋 Table Columns:');
  columns.forEach(col => {
    console.log(`  - ${col.Field} (${col.Type}) ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? '[' + col.Key + ']' : ''}`);
  });
  
  await connection.end();
}

checkTable().catch(console.error);
