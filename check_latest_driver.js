require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkLatestDriver() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306
  });

  try {
    console.log('🔍 Checking latest driver registration...\n');

    // Get latest driver
    const [drivers] = await connection.execute(`
      SELECT 
        id.driver_id,
        id.user_id,
        id.full_name,
        id.phone,
        id.email,
        id.nik,
        id.date_of_birth,
        id.place_of_birth,
        id.gender,
        id.religion,
        id.blood_type,
        id.marital_status,
        id.address_full,
        id.rt_rw,
        id.kelurahan,
        id.kecamatan,
        id.kota,
        id.province_id,
        id.vehicle_type,
        id.vehicle_plate,
        id.vehicle_color,
        id.vehicle_year,
        id.license_number,
        id.license_expiry,
        id.stnk_number,
        id.stnk_expiry,
        id.service_type_allowed,
        id.ktp_photo_url,
        id.selfie_photo_url,
        id.license_photo_url,
        id.stnk_photo_url,
        id.bank_name,
        id.bank_account_number,
        id.bank_account_holder,
        id.verification_status,
        id.is_active,
        id.created_at,
        u.username,
        u.user_type,
        u.is_active as user_is_active
      FROM independent_drivers id
      LEFT JOIN users u ON id.user_id = u.id
      ORDER BY id.created_at DESC
      LIMIT 1
    `);

    if (drivers.length === 0) {
      console.log('❌ No driver found');
      return;
    }

    const driver = drivers[0];
    
    console.log('✅ LATEST DRIVER REGISTRATION:\n');
    console.log('═══════════════════════════════════════');
    console.log('📋 BASIC INFO:');
    console.log(`  Driver ID     : ${driver.driver_id}`);
    console.log(`  User ID       : ${driver.user_id}`);
    console.log(`  Full Name     : ${driver.full_name}`);
    console.log(`  Phone         : ${driver.phone}`);
    console.log(`  Email         : ${driver.email}`);
    console.log(`  NIK           : ${driver.nik}`);
    console.log('\n📅 PERSONAL DATA:');
    console.log(`  Date of Birth : ${driver.date_of_birth}`);
    console.log(`  Place of Birth: ${driver.place_of_birth}`);
    console.log(`  Gender        : ${driver.gender}`);
    console.log(`  Religion      : ${driver.religion}`);
    console.log(`  Blood Type    : ${driver.blood_type}`);
    console.log(`  Marital Status: ${driver.marital_status}`);
    console.log('\n📍 ADDRESS:');
    console.log(`  Full Address  : ${driver.address_full}`);
    console.log(`  RT/RW         : ${driver.rt_rw}`);
    console.log(`  Kelurahan     : ${driver.kelurahan}`);
    console.log(`  Kecamatan     : ${driver.kecamatan}`);
    console.log(`  Kota          : ${driver.kota}`);
    console.log(`  Province ID   : ${driver.province_id}`);
    console.log('\n🚗 VEHICLE INFO:');
    console.log(`  Type          : ${driver.vehicle_type}`);
    console.log(`  Plate         : ${driver.vehicle_plate || 'NULL'}`);
    console.log(`  Color         : ${driver.vehicle_color}`);
    console.log(`  Year          : ${driver.vehicle_year}`);
    console.log(`  License Number: ${driver.license_number || 'NULL'}`);
    console.log(`  License Expiry: ${driver.license_expiry || 'NULL'}`);
    console.log(`  STNK Number   : ${driver.stnk_number || 'NULL'}`);
    console.log(`  STNK Expiry   : ${driver.stnk_expiry || 'NULL'}`);
    console.log(`  Service Types : ${driver.service_type_allowed}`);
    console.log('\n📸 PHOTO URLs (CLOUDINARY):');
    console.log(`  KTP Photo     : ${driver.ktp_photo_url}`);
    console.log(`  Selfie Photo  : ${driver.selfie_photo_url || 'NULL'}`);
    console.log(`  License Photo : ${driver.license_photo_url || 'NULL'}`);
    console.log(`  STNK Photo    : ${driver.stnk_photo_url || 'NULL'}`);
    console.log('\n💳 BANK INFO:');
    console.log(`  Bank Name     : ${driver.bank_name || 'NULL'}`);
    console.log(`  Account Number: ${driver.bank_account_number || 'NULL'}`);
    console.log(`  Account Holder: ${driver.bank_account_holder || 'NULL'}`);
    console.log('\n✔️ STATUS:');
    console.log(`  Verification  : ${driver.verification_status}`);
    console.log(`  Driver Active : ${driver.is_active ? 'Yes' : 'No'}`);
    console.log(`  Created At    : ${driver.created_at}`);
    console.log('\n👤 USER ACCOUNT:');
    console.log(`  Username      : ${driver.username}`);
    console.log(`  User Type     : ${driver.user_type}`);
    console.log(`  User Active   : ${driver.user_is_active ? 'Yes' : 'No'}`);
    console.log('═══════════════════════════════════════\n');

    // Check if Cloudinary URLs are valid
    console.log('🌐 CLOUDINARY URL VALIDATION:');
    if (driver.ktp_photo_url && driver.ktp_photo_url.includes('cloudinary.com')) {
      console.log('  ✅ KTP photo uploaded to Cloudinary');
    } else {
      console.log('  ❌ KTP photo NOT on Cloudinary');
    }
    
    if (driver.selfie_photo_url && driver.selfie_photo_url.includes('cloudinary.com')) {
      console.log('  ✅ Selfie photo uploaded to Cloudinary');
    } else if (driver.selfie_photo_url) {
      console.log('  ❌ Selfie photo NOT on Cloudinary');
    }
    
    if (driver.license_photo_url && driver.license_photo_url.includes('cloudinary.com')) {
      console.log('  ✅ License photo uploaded to Cloudinary');
    } else if (driver.license_photo_url) {
      console.log('  ❌ License photo NOT on Cloudinary');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkLatestDriver();
