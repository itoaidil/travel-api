const mysql = require('mysql2/promise');

// Railway MySQL PUBLIC credentials
const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway',
  port: 31765
};

async function checkTableStructure() {
  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected!\n');
    
    // Check students table structure
    console.log('📋 STUDENTS TABLE STRUCTURE:');
    const [studentsStruct] = await connection.query('DESCRIBE students');
    console.table(studentsStruct);
    
    // Check pos table structure  
    console.log('\n📋 POS TABLE STRUCTURE:');
    const [posStruct] = await connection.query('DESCRIBE pos');
    console.table(posStruct);
    
    // Check users table structure
    console.log('\n📋 USERS TABLE STRUCTURE:');
    const [usersStruct] = await connection.query('DESCRIBE users');
    console.table(usersStruct);
    
    // Check vehicles table structure
    console.log('\n📋 VEHICLES TABLE STRUCTURE:');
    const [vehiclesStruct] = await connection.query('DESCRIBE vehicles');
    console.table(vehiclesStruct);
    
    // Check bookings table structure
    console.log('\n📋 BOOKINGS TABLE STRUCTURE:');
    const [bookingsStruct] = await connection.query('DESCRIBE bookings');
    console.table(bookingsStruct);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkTableStructure();
