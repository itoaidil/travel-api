const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Railway Production Database
const dbConfig = {
  host: 'autorack.proxy.rlwy.net',
  port: 24077,
  user: 'root',
  password: 'wFCCnzcZdmKHJcQPkwzAQGjybIXpWpBC',
  database: 'railway',
  connectTimeout: 60000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

async function createTestStudents() {
  console.log('🎓 Creating 5 test students for live tracking demo...\n');
  console.log('🔗 Connecting to Railway database...\n');

  const students = [
    {
      full_name: 'Budi Santoso',
      email: 'budi@unand.ac.id',
      phone: '081234567801',
      password: 'student123',
      university: 'Universitas Andalas',
      pickup: {
        name: 'Universitas Andalas',
        address: 'Kampus Unand Limau Manis, Padang',
        lat: -0.9147078,
        lng: 100.4626383
      }
    },
    {
      full_name: 'Siti Aminah',
      email: 'siti@upi.ac.id',
      phone: '081234567802',
      password: 'student123',
      university: 'UPI YPTK Padang',
      pickup: {
        name: 'UPI YPTK Padang',
        address: 'Jl. Jhoni Anwar, Padang',
        lat: -0.9492644,
        lng: 100.3525558
      }
    },
    {
      full_name: 'Andi Wijaya',
      email: 'andi@unp.ac.id',
      phone: '081234567803',
      password: 'student123',
      university: 'Universitas Negeri Padang',
      pickup: {
        name: 'UNP Air Tawar',
        address: 'Kampus UNP Air Tawar, Padang',
        lat: -0.9063684,
        lng: 100.3549538
      }
    },
    {
      full_name: 'Dewi Lestari',
      email: 'dewi@pcr.ac.id',
      phone: '081234567804',
      password: 'student123',
      university: 'Politeknik Negeri Padang',
      pickup: {
        name: 'Politeknik Negeri Padang',
        address: 'Kampus PNP Limau Manis, Padang',
        lat: -0.9168954,
        lng: 100.4619903
      }
    },
    {
      full_name: 'Rizki Pratama',
      email: 'rizki@bunghatta.ac.id',
      phone: '081234567805',
      password: 'student123',
      university: 'Universitas Bung Hatta',
      pickup: {
        name: 'Universitas Bung Hatta',
        address: 'Kampus Bung Hatta, Ulak Karang, Padang',
        lat: -0.9434753,
        lng: 100.3519468
      }
    }
  ];

  let connection;
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to Railway database\n');
    
    // Hash password once
    const hashedPassword = await bcrypt.hash('student123', 10);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      console.log(`${i + 1}. Creating ${student.full_name}...`);

      // Check if user already exists
      const [existingUsers] = await connection.query(
        'SELECT id FROM users WHERE phone = ? OR email = ?',
        [student.phone, student.email]
      );

      let userId;
      
      if (existingUsers.length > 0) {
        userId = existingUsers[0].id;
        console.log(`   ⚠️  User already exists (ID: ${userId})`);
      } else {
        // Create user
        const [userResult] = await connection.query(
          `INSERT INTO users (phone, password, email, user_type, created_at) 
           VALUES (?, ?, ?, 'student', NOW())`,
          [student.phone, hashedPassword, student.email]
        );
        
        userId = userResult.insertId;
        console.log(`   ✅ User created (ID: ${userId})`);
      }

      // Check if student profile already exists
      const [existingStudents] = await connection.query(
        'SELECT id FROM students WHERE user_id = ?',
        [userId]
      );

      let studentId;

      if (existingStudents.length > 0) {
        studentId = existingStudents[0].id;
        console.log(`   ⚠️  Student profile already exists (ID: ${studentId})`);
      } else {
        // Create student profile
        const [studentResult] = await connection.query(
          `INSERT INTO students (user_id, full_name, university, created_at) 
           VALUES (?, ?, ?, NOW())`,
          [userId, student.full_name, student.university]
        );
        
        studentId = studentResult.insertId;
        console.log(`   ✅ Student profile created (ID: ${studentId})`);
      }

      // Store for later use
      student.userId = userId;
      student.studentId = studentId;
      
      console.log(`   📍 Pickup: ${student.pickup.name}`);
      console.log('');
    }

    console.log('\n✅ All 5 students created successfully!\n');
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('=' .repeat(60));
    students.forEach((s, i) => {
      console.log(`${i + 1}. ${s.full_name}`);
      console.log(`   Phone: ${s.phone}`);
      console.log(`   Password: student123`);
      console.log(`   University: ${s.university}`);
      console.log(`   Pickup: ${s.pickup.name}`);
      console.log('');
    });

    // Save student data for booking script
    const fs = require('fs');
    fs.writeFileSync(
      './test_students_data.json',
      JSON.stringify(students, null, 2)
    );
    console.log('💾 Student data saved to test_students_data.json\n');

    await connection.end();
    console.log('🎉 Done! Now run: node create_test_bookings_railway.js\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

createTestStudents();
