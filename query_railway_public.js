const mysql = require('mysql2/promise');

// Railway MySQL PUBLIC credentials
const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway',
  port: 31765
};

async function queryDatabase() {
  console.log('🔄 Connecting to Railway MySQL Database (Public)...\n');
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
    
    // Query 2: Count all records
    console.log('📊 RECORD COUNTS:');
    console.log('='.repeat(60));
    const [usersCount] = await connection.query('SELECT COUNT(*) as total FROM users');
    const [studentsCount] = await connection.query('SELECT COUNT(*) as total FROM students');
    const [posCount] = await connection.query('SELECT COUNT(*) as total FROM pos');
    const [vehiclesCount] = await connection.query('SELECT COUNT(*) as total FROM vehicles');
    const [bookingsCount] = await connection.query('SELECT COUNT(*) as total FROM bookings');
    
    console.log(`Users: ${usersCount[0].total}`);
    console.log(`Students: ${studentsCount[0].total}`);
    console.log(`PO Companies: ${posCount[0].total}`);
    console.log(`Vehicles: ${vehiclesCount[0].total}`);
    console.log(`Bookings: ${bookingsCount[0].total}`);
    console.log('');
    
    // Query 3: List students with login credentials
    console.log('🎓 STUDENTS DATA (with login email):');
    console.log('='.repeat(60));
    const [students] = await connection.query(`
      SELECT 
        s.id, 
        s.full_name, 
        s.student_id, 
        s.university, 
        u.email,
        'student123' as password_hint
      FROM students s 
      LEFT JOIN users u ON s.user_id = u.id 
      ORDER BY s.id
      LIMIT 10
    `);
    console.table(students);
    
    // Query 4: List POs
    console.log('🚌 PO COMPANIES:');
    console.log('='.repeat(60));
    const [pos] = await connection.query(`
      SELECT 
        p.id, 
        p.po_name, 
        p.phone, 
        p.email,
        COUNT(DISTINCT v.id) as total_vehicles
      FROM pos p
      LEFT JOIN vehicles v ON p.id = v.po_id
      GROUP BY p.id
      ORDER BY p.id
    `);
    console.table(pos);
    
    // Query 5: List vehicles with PO
    console.log('🚗 VEHICLES (Top 10):');
    console.log('='.repeat(60));
    const [vehicles] = await connection.query(`
      SELECT 
        v.id, 
        v.plate_number, 
        v.vehicle_type, 
        v.capacity, 
        p.po_name 
      FROM vehicles v 
      LEFT JOIN pos p ON v.po_id = p.id 
      ORDER BY v.id
      LIMIT 10
    `);
    console.table(vehicles);
    
    // Query 6: Recent bookings
    console.log('📝 RECENT BOOKINGS (Latest 10):');
    console.log('='.repeat(60));
    const [bookings] = await connection.query(`
      SELECT 
        b.id, 
        b.booking_code,
        b.seats_booked,
        b.total_price, 
        b.payment_status,
        b.booking_status,
        DATE_FORMAT(b.created_at, '%Y-%m-%d %H:%i') as created_at 
      FROM bookings b 
      ORDER BY b.created_at DESC 
      LIMIT 10
    `);
    console.table(bookings);
    
    // Query 7: Travels schedule
    console.log('🗓️  TRAVEL SCHEDULES (Sample):');
    console.log('='.repeat(60));
    const [travels] = await connection.query(`
      SELECT 
        t.id,
        t.origin,
        t.destination,
        TIME_FORMAT(t.departure_time, '%H:%i') as departure,
        DATE_FORMAT(t.departure_date, '%Y-%m-%d') as date,
        t.price,
        t.available_seats,
        t.status
      FROM travels t
      ORDER BY t.departure_date DESC, t.departure_time ASC
      LIMIT 10
    `);
    console.table(travels);
    
    console.log('\n✅ Query completed successfully!');
    console.log('\n📌 Login Credentials untuk Testing:');
    console.log('='.repeat(60));
    console.log('Student: student1@email.com / student123');
    console.log('Student: student2@email.com / student123');
    console.log('Customer: customer1@example.com / password123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Database connection refused. Railway MySQL might be sleeping.');
      console.error('   Try accessing the API first to wake it up.');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Access denied. Check credentials.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Database connection closed.');
    }
  }
}

// Run the query
queryDatabase();
