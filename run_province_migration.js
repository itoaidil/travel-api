// Run Province Migration on Railway
// Usage: railway run node run_province_migration.js

const fs = require('fs');
const db = require('./config/database');

async function runMigration() {
  console.log('🚀 Starting Province Migration...\n');
  
  try {
    // Read migration files
    const migration1 = fs.readFileSync('./migrations/001_add_province_support_mysql.sql', 'utf8');
    const migration2 = fs.readFileSync('./migrations/002_seed_province_data_mysql.sql', 'utf8');
    
    // Split SQL statements (each statement ends with ;)
    const statements1 = migration1
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    const statements2 = migration2
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log('📄 Migration 1: Add Province Support');
    console.log(`   Found ${statements1.length} SQL statements\n`);
    
    // Execute migration 1
    for (let i = 0; i < statements1.length; i++) {
      const stmt = statements1[i];
      try {
        await db.query(stmt);
        console.log(`   ✓ Statement ${i + 1}/${statements1.length} executed`);
      } catch (err) {
        if (err.message.includes('already exists') || err.message.includes('Duplicate')) {
          console.log(`   ⚠ Statement ${i + 1}/${statements1.length} skipped (already exists)`);
        } else {
          console.error(`   ✗ Statement ${i + 1} failed:`, err.message);
          throw err;
        }
      }
    }
    
    console.log('\n📄 Migration 2: Seed Province Data');
    console.log(`   Found ${statements2.length} SQL statements\n`);
    
    // Execute migration 2
    for (let i = 0; i < statements2.length; i++) {
      const stmt = statements2[i];
      try {
        await db.query(stmt);
        console.log(`   ✓ Statement ${i + 1}/${statements2.length} executed`);
      } catch (err) {
        if (err.message.includes('Duplicate entry')) {
          console.log(`   ⚠ Statement ${i + 1}/${statements2.length} skipped (duplicate entry)`);
        } else {
          console.error(`   ✗ Statement ${i + 1} failed:`, err.message);
          // Continue on error for seed data
        }
      }
    }
    
    // Verify migration
    console.log('\n🔍 Verifying Migration...\n');
    
    const [provinces] = await db.query('SELECT * FROM provinces');
    console.log(`   ✓ Provinces table: ${provinces.length} rows`);
    
    const [coords] = await db.query('SELECT * FROM province_coordinates');
    console.log(`   ✓ Province coordinates: ${coords.length} rows`);
    
    const [locations] = await db.query('SELECT COUNT(*) as count FROM location_references WHERE province_id IS NOT NULL');
    console.log(`   ✓ Locations with province: ${locations[0].count} rows`);
    
    console.log('\n✅ Migration completed successfully!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runMigration();
