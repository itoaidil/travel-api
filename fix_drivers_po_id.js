const db = require('./config/database');

async function fixDrivers() {
  try {
    console.log('🔍 Checking drivers without po_id...');
    const [drivers] = await db.query(
      'SELECT id, full_name, phone FROM drivers WHERE po_id IS NULL'
    );
    
    console.log(`Found ${drivers.length} drivers without po_id:`);
    drivers.forEach(d => {
      console.log(`  - ${d.full_name} (ID: ${d.id}, Phone: ${d.phone})`);
    });
    
    if (drivers.length > 0) {
      console.log('\n📝 Updating to po_id=67 (PO Hantar Travel)...');
      await db.query(
        'UPDATE drivers SET po_id = 67 WHERE po_id IS NULL'
      );
      console.log('✅ Updated successfully!');
    }
    
    // Verify
    console.log('\n🔍 All drivers for PO 67:');
    const [updated] = await db.query(
      'SELECT id, full_name, phone, po_id FROM drivers WHERE po_id = 67 ORDER BY id DESC'
    );
    console.log(`Total: ${updated.length} drivers`);
    updated.forEach(d => {
      console.log(`  - ${d.full_name} (ID: ${d.id}, Phone: ${d.phone})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDrivers();
