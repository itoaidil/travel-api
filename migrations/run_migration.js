const fs = require('fs');
const db = require('../config/database');

const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('Usage: node run_migration.js <sql-file>');
  process.exit(1);
}

const sql = fs.readFileSync(sqlFile, 'utf8');

// Split by semicolon and execute each statement
const statements = sql
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

let completed = 0;

statements.forEach((statement, index) => {
  db.query(statement, (err, result) => {
    if (err) {
      console.error(`Error executing statement ${index + 1}:`, err.message);
      console.error('Statement:', statement);
    } else {
      console.log(`✓ Statement ${index + 1} executed successfully`);
    }
    
    completed++;
    if (completed === statements.length) {
      console.log('\n✅ Migration completed');
      process.exit(0);
    }
  });
});
