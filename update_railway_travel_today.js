const mysql = require('mysql2/promise');
require('dotenv').config();

async function updateTravelDates() {
  let connection;
  
  try {
    // Connect to Railway production database
    const DATABASE_URL = process.env.DATABASE_URL || 'mysql://root:pVVdfgdmYdEoUvzIlsOAmJQNyAVFjErF@autorack.proxy.rlwy.net:46562/railway';
    
    console.log('🔄 Connecting to Railway database...\n');
    connection = await mysql.createConnection(DATABASE_URL);
    console.log('✅ Connected!\n');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`📅 Today's date: ${todayStr}\n`);
    
    // Check current travels for driver 45
    console.log('📋 Checking existing travels for driver 45...\n');
    const [existingTravels] = await connection.query(
      `SELECT id, origin, destination, DATE(departure_time) as dep_date, departure_time
       FROM travels 
       WHERE driver_id = 45 
       ORDER BY departure_time DESC
       LIMIT 10`
    );
    
    console.log(`Found ${existingTravels.length} travels for driver 45:`);
    existingTravels.forEach(t => {
      console.log(`  - ID ${t.id}: ${t.origin} -> ${t.destination} on ${t.dep_date}`);
    });
    console.log('');
    
    // Update travels to today
    console.log(`🔄 Updating travels to ${todayStr}...\n`);
    
    for (const travel of existingTravels) {
      const oldTime = new Date(travel.departure_time);
      const newTime = new Date(today);
      newTime.setHours(oldTime.getHours(), oldTime.getMinutes(), 0, 0);
      
      const arrivalTime = new Date(newTime);
      arrivalTime.setHours(arrivalTime.getHours() + 2); // +2 hours
      
      await connection.query(
        `UPDATE travels 
         SET departure_time = ?, arrival_time = ?
         WHERE id = ?`,
        [newTime, arrivalTime, travel.id]
      );
      
      console.log(`✅ Updated travel ${travel.id}: ${travel.origin} -> ${travel.destination}`);
      console.log(`   New departure: ${newTime.toISOString()}`);
    }
    
    console.log('\n✅ All travels updated successfully!\n');
    
    // Verify update
    console.log('🔍 Verifying updated travels...\n');
    const [updatedTravels] = await connection.query(
      `SELECT id, origin, destination, DATE(departure_time) as dep_date, 
              TIME(departure_time) as dep_time
       FROM travels 
       WHERE driver_id = 45 
       ORDER BY departure_time`
    );
    
    console.log(`Travels for today (${todayStr}):`);
    updatedTravels.forEach(t => {
      console.log(`  - ID ${t.id}: ${t.origin} -> ${t.destination} at ${t.dep_time} (${t.dep_date})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n✅ Connection closed');
    }
  }
}

updateTravelDates();
