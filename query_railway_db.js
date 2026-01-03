const mysql = require('mysql2/promise');

// Railway MySQL credentials
const dbConfig = {
  host: 'mysql.railway.internal',
  user: 'root',
  password: process.env.MYSQLPASSWORD || '', // Set via Railway env vars
  database: 'railway',
  port: 3306
};

async function queryDatabase() {
  console.log('🔄 Connecting to Railway MySQL Database...\n');
  console.log('Host:', dbConfig.host);
  console.log('Database:', dbConfig.database);
  console.log('User:', dbConfig.user);
  console.log('Port:', dbConfig.port);
  console.log('');
  
  let connection;
  
  try {
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway MySQL!\n');
    
    // Query 1: Show all tables
    console.log('📋 TABLES IN DATABASE:');
    console.log('='.repeat(60));
    const [tables] = await connection.query('SHOW TABLES');
    tables.forEach((row, index) => {
      const tableName = Object.values(row)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    console.log('');
    
    // Query 2: Count users
    console.log('👥 USERS COUNT:');
    console.log('='.repeat(60));
    const [usersCount] = await connection.query('SELECT COUNT(*) as total FROM users');
    console.log(`Total users: ${usersCount[0].total}`);
    console.log('');
    
    // Query 3: List students
    console.log('🎓 STUDENTS DATA:');
    console.log('='.repeat(60));
    const [students] = await connection.query(`
      SELECT s.id, s.full_name, s.nim, s.university, u.email 
      FROM students s 
      LEFT JOIN users u ON s.user_id = u.id 
      LIMIT 10
    `);
    console.table(students);
    
    // Query 4: List POs
    console.log('🚌 PO COMPANIES:');
    console.log('='.repeat(60));
    const [pos] = await connection.query('SELECT id, name, phone, email FROM pos LIMIT 10');
    console.table(pos);
    
    // Query 5: List vehicles
    console.log('🚗 VEHICLES:');
    console.log('='.repeat(60));
    const [vehicles] = await connection.query(`
      SELECT v.id, v.vehicle_number, v.vehicle_type, v.capacity, p.name as po_name 
      FROM vehicles v 
      LEFT JOIN pos p ON v.po_id = p.id 
      LIMIT 10
    `);
    console.table(vehicles);
    
    // Query 6: Recent bookings
    console.log('📝 RECENT BOOKINGS:');
    console.log('='.repeat(60));
    const [bookings] = await connection.query(`
      SELECT b.id, b.passenger_name, b.total_price, b.payment_status, b.created_at 
      FROM bookings b 
      ORDER BY b.created_at DESC 
      LIMIT 5
    `);
    console.table(bookings);
    
    console.log('\n✅ Query completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\n💡 Troubleshooting:');
    console.error('1. Check if MYSQLPASSWORD env var is set');
    console.error('2. Run this on Railway deployment (not locally)');
    console.error('3. Use Railway CLI: railway run node query_railway_db.js');
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run the query
queryDatabase();
