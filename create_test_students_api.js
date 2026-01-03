const axios = require('axios');

const API_URL = 'https://travel-api-production-23ae.up.railway.app/api';

async function createTestStudents() {
  console.log('🎓 Creating 5 test students via API...\n');

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

  try {
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      console.log(`${i + 1}. Creating ${student.full_name}...`);

      try {
        // Register student via API
        const response = await axios.post(`${API_URL}/auth/register/student`, {
          phone: student.phone,
          password: student.password,
          email: student.email,
          full_name: student.full_name,
          university: student.university
        });

        if (response.data.success) {
          console.log(`   ✅ Created successfully`);
          console.log(`   📍 Pickup: ${student.pickup.name}`);
          student.studentId = response.data.user?.studentId || response.data.studentId;
          student.userId = response.data.user?.id || response.data.userId;
        }
      } catch (error) {
        if (error.response?.data?.message?.includes('already exists')) {
          console.log(`   ⚠️  Already exists - skipping`);
          // Try to get existing student ID by logging in
          try {
            const loginResponse = await axios.post(`${API_URL}/auth/login/student`, {
              phone: student.phone,
              password: student.password
            });
            student.studentId = loginResponse.data.user?.studentId;
            student.userId = loginResponse.data.user?.id;
          } catch (loginError) {
            console.log(`   ⚠️  Could not retrieve IDs`);
          }
        } else {
          console.log(`   ❌ Error: ${error.response?.data?.message || error.message}`);
        }
      }
      console.log('');
    }

    console.log('\n✅ Student creation process completed!\n');
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

    // Save student data
    const fs = require('fs');
    fs.writeFileSync(
      './test_students_data.json',
      JSON.stringify(students, null, 2)
    );
    console.log('💾 Student data saved to test_students_data.json\n');
    console.log('🎉 Next step: node create_test_bookings_api.js\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

createTestStudents();
