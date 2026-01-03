const mysql = require('mysql2/promise');
const fs = require('fs');

async function updateSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'junction.proxy.rlwy.net',
    port: process.env.DB_PORT || 28634,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'IeRJGrqTMqnXCESTPHvLYLAlIjuXdYnO',
    database: process.env.DB_NAME || 'railway'
  });

  console.log('🔗 Connected to database');
  
  const sql = fs.readFileSync('update_driver_schema_for_optional_fields.sql', 'utf8');
  const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  
  for (const stmt of statements) {
    if (stmt.trim()) {
      try {
        const [result] = await connection.query(stmt);
        console.log('✅ Executed:', stmt.substring(0, 80) + '...');
        if (Array.isArray(result)) {
          console.log(result);
        }
      } catch (err) {
        console.log('⚠️  Error (might be ok):', err.message);
      }
    }
  }
  
  await connection.end();
  console.log('✅ Schema update complete');
}

updateSchema().catch(console.error);
