const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
  const db = await mysql.createConnection({
    host: process.env.MYSQLHOST,
    port: Number(process.env.MYSQLPORT) || 3306,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true,
  });

  const sqlFile = path.join(__dirname, 'migrations', '025_create_service_tiers_and_pooling.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const statements = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const stmt of statements) {
    try {
      await db.query(stmt);
      console.log('OK:', stmt.substring(0, 80).replace(/\n/g, ' '));
    } catch (e) {
      // Ignore duplicate FK add when migration re-run
      if (e && (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_FK_DUP_NAME')) {
        console.log('SKIP:', e.code, '|', stmt.substring(0, 80).replace(/\n/g, ' '));
        continue;
      }
      console.error('ERR:', e.message, '|', stmt.substring(0, 80).replace(/\n/g, ' '));
    }
  }

  await db.end();
  console.log('\nMigration 025 done.');
}

run().catch(console.error);
