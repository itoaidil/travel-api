const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Railway Public Database
const dbConfig = {
  host: 'turntable.proxy.rlwy.net',
  port: 31765,
  user: 'root',
  password: 'zJRybpszurLxJoXAqLBvaBijPvYpMKNA',
  database: 'railway'
};

async function createStudents() {
  let connection;
  console.log('🎓 Creating 5 test students on Railway database...\n');
  
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected!\n');
    
    const password = await bcrypt.hash('student123', 10);
    
    const students = [
      {
        full_name: 'Budi Santoso',
        email: 'budi@unand.ac.id',
        phone: '081234567801',
        university: 'Universitas Andalas',
        pickup: { name: 'Universitas Andalas', lat: -0.9147078, lng: 100.4626383 }
      },
      {
        full_name: 'Siti Aminah',
        email: 'siti@upi.ac.id',
        phone: '081234567802',
        university: 'UPI YPTK Padang',
        pickup: { name: 'UPI YPTK Padang', lat: -0.9492644, lng: 100.3525558 }
      },
      {
        full_name: 'Andi Wijaya',
        email: 'andi@unp.ac.id',
        phone: '081234567803',
        university: 'Universitas Negeri Padang',
        pickup: { name: 'UNP Air Tawar', lat: -0.9063684, lng: 100.3549538 }
      },
      {
        full_name: 'Dewi Lestari',
        email: 'dewi@pcr.ac.id',
        phone: '081234567804',
        university: 'Politeknik Negeri Padang',
        pickup: { name: 'Politeknik Negeri Padang', lat: -0.9168954, lng: 100.4619903 }
      },
      {
        full_name: 'Rizki Pratama',
        email: 'rizki@bunghatta.ac.id',
        phone: '081234567805',
        university: 'Universitas Bung Hatta',
        pickup: { name: 'Universitas Bung Hatta', lat: -0.9434753, lng: 100.3519468 }
      }
    ];
    
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      console.log(`${i + 1}. ${s.full_name}...`);
      
      // Check existing
      const [existing] = await connection.query(
        'SELECT id FROM users WHERE phone = ?',
        [s.phone]
      );
      
      if (existing.length > 0) {
        console.log(`   ⚠️  Phone already exists, skipping`);
        continue;
      }
      
      // Create user (username = phone number)
      const [userResult] = await connection.query(
        'INSERT INTO users (username, phone, password, email, user_type, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
        [s.phone, s.phone, password, s.email, 'student']
      );
      
      // Create student
      await connection.query(
        'INSERT INTO students (user_id, full_name, university, created_at) VALUES (?, ?, ?, NOW())',
        [userResult.insertId, s.full_name, s.university]
      );
      
      console.log(`   ✅ Created (User ID: ${userResult.insertId})`);
      console.log(`   📍 ${s.pickup.name}`);
      
      s.userId = userResult.insertId;
    }
    
    console.log('\n✅ Done!\n');
    console.log('📋 CREDENTIALS:');
    console.log('='.repeat(50));
    students.forEach((s, i) => {
      console.log(`${i + 1}. ${s.full_name}`);
      console.log(`   Phone: ${s.phone}`);
      console.log(`   Password: student123`);
      console.log(`   University: ${s.university}\n`);
    });
    
    // Save for bookings
    const fs = require('fs');
    fs.writeFileSync('./test_students_data.json', JSON.stringify(students, null, 2));
    console.log('💾 Saved to test_students_data.json\n');
    
    await connection.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (connection) await connection.end();
    process.exit(1);
  }
}

createStudents();
