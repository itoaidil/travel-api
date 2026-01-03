const db = require('./config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Starting migration: add_seats_to_travels.sql');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'migrations', 'add_seats_to_travels.sql'),
      'utf8'
    );

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`\nExecuting statement ${i + 1}:`);
        console.log(statement.substring(0, 100) + '...');
        
        await db.query(statement);
        console.log('✓ Success');
      }
    }

    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();
