const mysql = require('mysql2/promise');
require('dotenv').config();

// Resolve values like "${VAR}" to the actual env var value if present
function resolveRef(val) {
  if (typeof val === 'string' && /^\$\{[A-Z0-9_]+\}$/.test(val)) {
    const name = val.slice(2, -1);
    return process.env[name];
  }
  return val;
}

// Prefer Railway's MYSQL* vars, then fallback to DB_* and local defaults
const host = resolveRef(process.env.MYSQLHOST) || resolveRef(process.env.DB_HOST) || 'localhost';
const user = resolveRef(process.env.MYSQLUSER) || resolveRef(process.env.DB_USER) || 'root';
const password = resolveRef(process.env.MYSQLPASSWORD) || resolveRef(process.env.DB_PASSWORD) || '';
const database = resolveRef(process.env.MYSQLDATABASE) || resolveRef(process.env.DB_NAME) || 'travel_booking';
const port = Number(resolveRef(process.env.MYSQLPORT) || resolveRef(process.env.DB_PORT) || 3306);

// Create connection pool for better performance and auto-reconnect
const pool = mysql.createPool({
  host,
  user,
  password,
  database,
  port,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// Minimal, safe startup logging (no secrets)
const shouldLog = process.env.NODE_ENV !== 'production' || process.env.LOG_DB_CONFIG === '1';
if (shouldLog) {
  console.log('MySQL config (safe):', { host, port, database, user });
}

// Test connection
pool.getConnection()
  .then(connection => {
    console.log('Connected to MySQL database');
    connection.release();
  })
  .catch(err => {
    console.error('Error connecting to database:', err);
  });

module.exports = pool;
