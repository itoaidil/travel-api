const db = require('../config/database');
const fs = require('fs');
const path = require('path');

// Read SQL file
const sqlFile = path.join(__dirname, 'create_student_users.sql');
const sql = fs.readFileSync(sqlFile, 'utf8');

// Split by semicolon and filter empty statements
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--'));

console.log('🔄 Running student user migration...');

// Execute each statement
let completed = 0;
statements.forEach((statement, index) => {
  db.query(statement, (err, result) => {
    if (err) {
      console.error(`❌ Error executing statement ${index + 1}:`, err.message);
    } else {
      completed++;
      console.log(`✅ Statement ${index + 1} executed successfully`);
    }
    
    // Close connection when all done
    if (completed + (statements.length - completed) === statements.length) {
      console.log(`\n✅ Migration completed! ${completed}/${statements.length} statements executed.`);
      process.exit(0);
    }
  });
});
