const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Resolve Railway env vars
function resolveRef(val) {
  if (typeof val === 'string' && /^\$\{[A-Z0-9_]+\}$/.test(val)) {
    const name = val.slice(2, -1);
    return process.env[name];
  }
  return val;
}

const config = {
  host: resolveRef(process.env.MYSQLHOST) || resolveRef(process.env.DB_HOST) || 'localhost',
  user: resolveRef(process.env.MYSQLUSER) || resolveRef(process.env.DB_USER) || 'root',
  password: resolveRef(process.env.MYSQLPASSWORD) || resolveRef(process.env.DB_PASSWORD) || '',
  database: resolveRef(process.env.MYSQLDATABASE) || resolveRef(process.env.DB_NAME) || 'railway',
  port: Number(resolveRef(process.env.MYSQLPORT) || resolveRef(process.env.DB_PORT) || 3306),
};

console.log('🔗 Connecting to Railway MySQL...');
console.log(`   Host: ${config.host}`);
console.log(`   Database: ${config.database}\n`);

async function seedRailway() {
  let connection;
  
  try {
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to Railway MySQL\n');

    // 1. Create Users
    console.log('Creating users...');
    const users = [
      { username: 'po_admin1', email: 'admin1@po.com', password: await bcrypt.hash('admin123', 10), phone: '081234567801', user_type: 'po_admin' },
      { username: 'po_admin2', email: 'admin2@po.com', password: await bcrypt.hash('admin123', 10), phone: '081234567802', user_type: 'po_admin' },
      { username: 'po_admin3', email: 'admin3@po.com', password: await bcrypt.hash('admin123', 10), phone: '081234567803', user_type: 'po_admin' },
      { username: 'driver1', email: 'driver1@mail.com', password: await bcrypt.hash('driver123', 10), phone: '081234567811', user_type: 'driver' },
      { username: 'driver2', email: 'driver2@mail.com', password: await bcrypt.hash('driver123', 10), phone: '081234567812', user_type: 'driver' },
      { username: 'student1', email: 'student1@mail.com', password: await bcrypt.hash('student123', 10), phone: '081234567821', user_type: 'student' },
      { username: 'student2', email: 'student2@mail.com', password: await bcrypt.hash('student123', 10), phone: '081234567822', user_type: 'student' },
    ];

    for (const user of users) {
      await connection.execute(
        'INSERT IGNORE INTO users (username, email, password, phone, user_type) VALUES (?, ?, ?, ?, ?)',
        [user.username, user.email, user.password, user.phone, user.user_type]
      );
    }
    console.log('✅ Users created\n');

    // 2. Create POs
    console.log('Creating POs...');
    const pos = [
      { po_name: 'Prima Jaya Travel', company_code: 'PJT001', email: 'info@primajaya.com', phone: '081234567001', address: 'Jl. Sudirman No. 123, Jakarta' },
      { po_name: 'Sinar Dunia Transport', company_code: 'SDT002', email: 'info@sinardunia.com', phone: '081234567002', address: 'Jl. Asia Afrika No. 45, Bandung' },
      { po_name: 'Harapan Jaya Express', company_code: 'HJE003', email: 'info@harapanjaya.com', phone: '081234567003', address: 'Jl. Gatot Subroto No. 78, Surabaya' },
    ];

    for (const po of pos) {
      await connection.execute(
        'INSERT IGNORE INTO pos (po_name, company_code, email, phone, address) VALUES (?, ?, ?, ?, ?)',
        [po.po_name, po.company_code, po.email, po.phone, po.address]
      );
    }
    console.log('✅ POs created\n');

    // 3. Link PO Admins
    console.log('Linking PO admins...');
    const adminLinks = [
      { user_id: 1, po_id: 1 },
      { user_id: 2, po_id: 2 },
      { user_id: 3, po_id: 3 },
    ];

    for (const link of adminLinks) {
      await connection.execute(
        'INSERT IGNORE INTO po_admins (user_id, po_id) VALUES (?, ?)',
        [link.user_id, link.po_id]
      );
    }
    console.log('✅ PO admins linked\n');

    // 4. Create Drivers
    console.log('Creating drivers...');
    const drivers = [
      { user_id: 4, full_name: 'Agus Setiawan', license_number: 'DL001', rating: 4.5 },
      { user_id: 5, full_name: 'Budi Hartono', license_number: 'DL002', rating: 4.7 },
    ];

    for (const driver of drivers) {
      await connection.execute(
        'INSERT IGNORE INTO drivers (user_id, full_name, license_number, rating) VALUES (?, ?, ?, ?)',
        [driver.user_id, driver.full_name, driver.license_number, driver.rating]
      );
    }
    console.log('✅ Drivers created\n');

    // 5. Create Students
    console.log('Creating students...');
    const students = [
      { user_id: 6, full_name: 'Ahmad Rizki', student_id: 'STD001', university: 'Universitas Indonesia', address: 'Depok', emergency_contact: '081999888777' },
      { user_id: 7, full_name: 'Siti Nurhaliza', student_id: 'STD002', university: 'ITB', address: 'Bandung', emergency_contact: '081999888666' },
    ];

    for (const student of students) {
      await connection.execute(
        'INSERT IGNORE INTO students (user_id, full_name, student_id, university, address, emergency_contact) VALUES (?, ?, ?, ?, ?, ?)',
        [student.user_id, student.full_name, student.student_id, student.university, student.address, student.emergency_contact]
      );
    }
    console.log('✅ Students created\n');

    // 6. Create Vehicles
    console.log('Creating vehicles...');
    const vehicles = [
      { po_id: 1, vehicle_number: 'V001', plate_number: 'B1234XYZ', vehicle_type: 'Bus', brand: 'Mercedes', model: 'OH 1526', year: 2020, capacity: 50 },
      { po_id: 1, vehicle_number: 'V002', plate_number: 'B5678ABC', vehicle_type: 'Mini Bus', brand: 'Isuzu', model: 'Elf NLR', year: 2021, capacity: 20 },
      { po_id: 2, vehicle_number: 'V003', plate_number: 'D9012DEF', vehicle_type: 'Bus', brand: 'Hino', model: 'RK8', year: 2019, capacity: 45 },
      { po_id: 3, vehicle_number: 'V004', plate_number: 'L3456GHI', vehicle_type: 'Van', brand: 'Toyota', model: 'Hiace', year: 2022, capacity: 15 },
    ];

    for (const vehicle of vehicles) {
      await connection.execute(
        'INSERT IGNORE INTO vehicles (po_id, vehicle_number, plate_number, vehicle_type, brand, model, year, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [vehicle.po_id, vehicle.vehicle_number, vehicle.plate_number, vehicle.vehicle_type, vehicle.brand, vehicle.model, vehicle.year, vehicle.capacity]
      );
    }
    console.log('✅ Vehicles created\n');

    // 7. Create Vehicle Schedules
    console.log('Creating vehicle schedules...');
    const schedules = [
      { vehicle_id: 1, destination: 'Bandung', departure_times: '["06:00", "09:00", "14:00", "17:00"]' },
      { vehicle_id: 1, destination: 'Surabaya', departure_times: '["07:00", "15:00"]' },
      { vehicle_id: 2, destination: 'Bandung', departure_times: '["08:00", "13:00", "18:00"]' },
      { vehicle_id: 3, destination: 'Jakarta', departure_times: '["06:30", "10:00", "16:00"]' },
      { vehicle_id: 4, destination: 'Yogyakarta', departure_times: '["07:00", "14:00"]' },
    ];

    for (const schedule of schedules) {
      await connection.execute(
        'INSERT IGNORE INTO vehicle_schedules (vehicle_id, destination, departure_times) VALUES (?, ?, ?)',
        [schedule.vehicle_id, schedule.destination, schedule.departure_times]
      );
    }
    console.log('✅ Vehicle schedules created\n');

    // 8. Create Sample Travels
    console.log('Creating sample travels...');
    const travels = [
      { 
        po_id: 1, 
        vehicle_id: 1, 
        driver_id: 1, 
        route_name: 'Jakarta - Bandung', 
        origin: 'Jakarta', 
        destination: 'Bandung', 
        departure_time: '2025-11-20 06:00:00',
        arrival_time: '2025-11-20 09:00:00',
        price: 150000 
      },
      { 
        po_id: 1, 
        vehicle_id: 2, 
        driver_id: 2, 
        route_name: 'Jakarta - Surabaya', 
        origin: 'Jakarta', 
        destination: 'Surabaya', 
        departure_time: '2025-11-21 07:00:00',
        arrival_time: '2025-11-21 19:00:00',
        price: 300000 
      },
      { 
        po_id: 2, 
        vehicle_id: 3, 
        driver_id: 1, 
        route_name: 'Bandung - Jakarta', 
        origin: 'Bandung', 
        destination: 'Jakarta', 
        departure_time: '2025-11-20 08:00:00',
        arrival_time: '2025-11-20 11:00:00',
        price: 150000 
      },
    ];

    for (const travel of travels) {
      await connection.execute(
        'INSERT IGNORE INTO travels (po_id, vehicle_id, driver_id, route_name, origin, destination, departure_time, arrival_time, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [travel.po_id, travel.vehicle_id, travel.driver_id, travel.route_name, travel.origin, travel.destination, travel.departure_time, travel.arrival_time, travel.price]
      );
    }
    console.log('✅ Sample travels created\n');

    console.log('🎉 Railway database seeded successfully!\n');
    console.log('📝 Login credentials:');
    console.log('   PO Admin: admin1@po.com / admin123');
    console.log('   Driver: driver1@mail.com / driver123');
    console.log('   Student: student1@mail.com / student123');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Connection closed');
    }
    process.exit(0);
  }
}

seedRailway();
