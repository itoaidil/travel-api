const db = require('../config/database');
const fs = require('fs');
const path = require('path');

console.log('🔄 Running base table migrations...\n');

// Read and execute the base tables SQL
const baseSQLPath = path.join(__dirname, '00_create_base_tables.sql');
const baseSQL = fs.readFileSync(baseSQLPath, 'utf8');

// Split by individual CREATE TABLE statements
const statements = baseSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0);

let completed = 0;
let failed = 0;

statements.forEach((statement, index) => {
  db.query(statement, (err) => {
    if (err) {
      console.error(`❌ Statement ${index + 1} failed:`, err.message);
      failed++;
    } else {
      const match = statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/);
      if (match) {
        console.log(`✅ Table ${match[1]} created/verified`);
      }
      completed++;
    }
    
    // Check if all done
    if (completed + failed === statements.length) {
      console.log(`\n📊 Migration complete: ${completed} successful, ${failed} failed`);
      process.exit(failed > 0 ? 1 : 0);
    }
  });
});
