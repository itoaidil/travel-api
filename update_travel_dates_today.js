const db = require('./config/database');

async function updateTravelDates() {
  try {
    console.log('🔄 Updating travel dates to today...\n');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Get travels yang di-assign ke driver_id 45 (driver yang login)
    const [travels] = await db.query(
      `SELECT id, origin, destination, departure_time, driver_id 
       FROM travels 
       WHERE driver_id = 45 
       LIMIT 5`
    );
    
    if (travels.length === 0) {
      console.log('❌ No travels found for driver_id 45');
      
      // Coba ambil travel apa saja dan assign ke driver 45
      const [anyTravels] = await db.query(
        `SELECT id, origin, destination, departure_time, driver_id 
         FROM travels 
         LIMIT 5`
      );
      
      if (anyTravels.length === 0) {
        console.log('❌ No travels found in database at all');
        process.exit(1);
      }
      
      console.log(`\n📝 Found ${anyTravels.length} travels. Assigning to driver 45...\n`);
      
      for (const travel of anyTravels) {
        const oldTime = new Date(travel.departure_time);
        const newTime = new Date(today);
        newTime.setHours(oldTime.getHours(), oldTime.getMinutes(), 0, 0);
        
        const arrivalTime = new Date(newTime);
        arrivalTime.setHours(arrivalTime.getHours() + 3); // +3 jam
        
        await db.query(
          `UPDATE travels 
           SET driver_id = 45, 
               departure_time = ?, 
               arrival_time = ?,
               status = 'scheduled'
           WHERE id = ?`,
          [newTime, arrivalTime, travel.id]
        );
        
        console.log(`✅ Updated travel ${travel.id}: ${travel.origin} → ${travel.destination}`);
        console.log(`   Departure: ${newTime.toISOString()}`);
        console.log(`   Arrival: ${arrivalTime.toISOString()}\n`);
      }
    } else {
      console.log(`\n📝 Found ${travels.length} travels for driver 45\n`);
      
      for (const travel of travels) {
        const oldTime = new Date(travel.departure_time);
        const newTime = new Date(today);
        newTime.setHours(oldTime.getHours(), oldTime.getMinutes(), 0, 0);
        
        const arrivalTime = new Date(newTime);
        arrivalTime.setHours(arrivalTime.getHours() + 3); // +3 jam
        
        await db.query(
          `UPDATE travels 
           SET departure_time = ?, 
               arrival_time = ?,
               status = 'scheduled'
           WHERE id = ?`,
          [newTime, arrivalTime, travel.id]
        );
        
        console.log(`✅ Updated travel ${travel.id}: ${travel.origin} → ${travel.destination}`);
        console.log(`   Departure: ${newTime.toISOString()}`);
        console.log(`   Arrival: ${arrivalTime.toISOString()}\n`);
      }
    }
    
    console.log('✅ All travel dates updated successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

updateTravelDates();
