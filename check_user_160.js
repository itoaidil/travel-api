const mysql = require('mysql2/promise');

async function checkUser160() {
  const connection = await mysql.createConnection({
    host: 'autorack.proxy.rlwy.net',
    port: 21758,
    user: 'root',
    password: 'SkEjQUUKaYzjyQRPyhsBLuuMRPuLZRHh',
    database: 'railway'
  });

  try {
    console.log('🔍 Checking user ID 160...\n');

    // Get user details
    const [users] = await connection.query(
      'SELECT id, phone, email, user_type, created_at FROM users WHERE id = ?',
      [160]
    );

    if (users.length === 0) {
      console.log('❌ User ID 160 not found');
      return;
    }

    const user = users[0];
    console.log('✅ User Found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Phone: ${user.phone || '(not set)'}`);
    console.log(`   Email: ${user.email || '(not set)'}`);
    console.log(`   Type: ${user.user_type}`);
    console.log(`   Created: ${user.created_at}\n`);

    // Check if driver exists
    const [drivers] = await connection.query(
      'SELECT id, user_id, full_name, license_number, vehicle_number FROM drivers WHERE user_id = ?',
      [160]
    );

    if (drivers.length > 0) {
      console.log('🚗 Driver Details:');
      drivers.forEach(driver => {
        console.log(`   Driver ID: ${driver.id}`);
        console.log(`   Name: ${driver.full_name}`);
        console.log(`   License: ${driver.license_number || '(not set)'}`);
        console.log(`   Vehicle: ${driver.vehicle_number || '(not set)'}\n`);
      });
    } else {
      console.log('⚠️  No driver record found for this user\n');
    }

    // Check device tokens
    const [tokens] = await connection.query(
      'SELECT id, device_token, app_type, device_type, created_at FROM device_tokens WHERE user_id = ?',
      [160]
    );

    if (tokens.length > 0) {
      console.log('📱 Device Tokens:');
      tokens.forEach(token => {
        console.log(`   Token ID: ${token.id}`);
        console.log(`   Device: ${token.device_type} (${token.app_type})`);
        console.log(`   Token: ${token.device_token.substring(0, 20)}...`);
        console.log(`   Registered: ${token.created_at}\n`);
      });
    } else {
      console.log('⚠️  No device tokens registered\n');
    }

    // Recent notifications
    const [notifications] = await connection.query(
      'SELECT id, title, body, type, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
      [160]
    );

    if (notifications.length > 0) {
      console.log('📬 Recent Notifications:');
      notifications.forEach(notif => {
        console.log(`   [${notif.created_at}] ${notif.title}`);
        console.log(`   Type: ${notif.type} | Read: ${notif.is_read ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('📭 No notifications found');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

checkUser160();
