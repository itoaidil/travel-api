const mysql = require('mysql2/promise');
require('dotenv').config();

function parseMysqlUrl(url) {
  try {
    const u = new URL(url);
    // e.g. mysql://user:pass@host:port/db
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'railway',
    };
  } catch (_) {
    return null;
  }
}

function resolveDbConfigFromEnv() {
  // 1) Prefer a single public URL if provided
  const url =
    process.env.MYSQL_PUBLIC_URL ||
    process.env.MYSQLPUBLICURL ||
    process.env.MYSQL_URL ||
    process.env.DATABASE_URL;
  const parsed = url ? parseMysqlUrl(url) : null;
  if (parsed) return parsed;

  // 2) Prefer Railway MYSQL* variables
  const host = process.env.MYSQLHOST || process.env.DB_HOST || 'localhost';
  const user = process.env.MYSQLUSER || process.env.DB_USER || 'root';
  const password = process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '';
  const database = process.env.MYSQLDATABASE || process.env.DB_NAME || 'travel_booking';
  const port = Number(process.env.MYSQLPORT || process.env.DB_PORT || 3306);
  return { host, user, password, database, port };
}

async function runMigration() {
  const cfg = resolveDbConfigFromEnv();
  const connection = await mysql.createConnection(cfg);

  try {
    console.log('🚀 Running migration: add_pickup_dropoff_coordinates.sql');
    console.log('📡 DB Target (safe):', { host: cfg.host, port: cfg.port, database: cfg.database, user: cfg.user });

    // Helper to ensure a column exists
    async function ensureColumn(table, column, definition) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      if (rows[0].cnt === 0) {
        await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
        console.log(`✅ Added column ${table}.${column}`);
      } else {
        console.log(`ℹ️  Column ${table}.${column} already exists`);
      }
    }

    // Add columns for pickup and dropoff coordinates (idempotent)
    await ensureColumn('bookings', 'pickup_lat', 'DECIMAL(10,8) NULL');
    await ensureColumn('bookings', 'pickup_lng', 'DECIMAL(11,8) NULL');
    await ensureColumn('bookings', 'pickup_address', 'TEXT NULL');
    await ensureColumn('bookings', 'dropoff_lat', 'DECIMAL(10,8) NULL');
    await ensureColumn('bookings', 'dropoff_lng', 'DECIMAL(11,8) NULL');
    await ensureColumn('bookings', 'dropoff_address', 'TEXT NULL');

    console.log('✅ Columns ensured for bookings table');

    // Add indexes (akan skip jika sudah ada)
    async function ensureIndex(table, indexName, columnsExpr) {
      const [rows] = await connection.query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
      );
      if (rows[0].cnt === 0) {
        await connection.query(`CREATE INDEX ${indexName} ON ${table}(${columnsExpr})`);
        console.log(`✅ Created index ${indexName}`);
      } else {
        console.log(`ℹ️  Index ${indexName} already exists`);
      }
    }

    await ensureIndex('bookings', 'idx_bookings_pickup', 'pickup_lat, pickup_lng');
    await ensureIndex('bookings', 'idx_bookings_dropoff', 'dropoff_lat, dropoff_lng');

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration();
