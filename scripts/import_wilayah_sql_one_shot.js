const fs = require('fs');
const path = require('path');
const db = require('../config/database');

function normalizeName(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function parseSqlInsertRows(sql, tableName) {
  const blockRegex = new RegExp('INSERT INTO `' + tableName + '`[\\s\\S]*?;', 'g');
  const tupleRegex = /\('([^']*)',\s*'((?:[^'\\]|\\.)*)',\s*([-\d.]+),\s*([-\d.]+)\)/g;
  const rows = [];
  const blocks = sql.match(blockRegex) || [];

  for (const block of blocks) {
    let match;
    while ((match = tupleRegex.exec(block)) !== null) {
      rows.push({
        id: String(match[1] || '').trim(),
        nama: normalizeName(String(match[2] || '')),
        latitude: Number(match[3] || 0),
        longitude: Number(match[4] || 0),
      });
    }
  }

  return rows;
}

function loadFromSql(sqlPath) {
  const raw = fs.readFileSync(sqlPath, 'utf8').replace(/^\uFEFF/, '');

  const provincesRaw = parseSqlInsertRows(raw, 't_provinsi');
  const regenciesRaw = parseSqlInsertRows(raw, 't_kota');
  const districtsRaw = parseSqlInsertRows(raw, 't_kecamatan');
  const villagesRaw = parseSqlInsertRows(raw, 't_kelurahan');

  const provinces = provincesRaw
    .map((r) => ({
      code: r.id,
      name: r.nama,
      latitude: Number.isFinite(r.latitude) ? r.latitude : 0,
      longitude: Number.isFinite(r.longitude) ? r.longitude : 0,
      is_active: 1,
    }))
    .filter((r) => r.code && r.name);

  const regencies = regenciesRaw
    .map((r) => ({
      code: r.id,
      province_code: r.id.slice(0, 2),
      name: r.nama,
      latitude: Number.isFinite(r.latitude) ? r.latitude : 0,
      longitude: Number.isFinite(r.longitude) ? r.longitude : 0,
      is_active: 1,
    }))
    .filter((r) => r.code && r.province_code && r.name);

  const districts = districtsRaw
    .map((r) => ({
      code: r.id,
      regency_code: r.id.slice(0, 4),
      name: r.nama,
      latitude: Number.isFinite(r.latitude) ? r.latitude : 0,
      longitude: Number.isFinite(r.longitude) ? r.longitude : 0,
      is_active: 1,
    }))
    .filter((r) => r.code && r.regency_code && r.name);

  const villages = villagesRaw
    .map((r) => ({
      code: r.id,
      district_code: r.id.slice(0, 6),
      name: r.nama,
      latitude: Number.isFinite(r.latitude) ? r.latitude : 0,
      longitude: Number.isFinite(r.longitude) ? r.longitude : 0,
      is_active: 1,
    }))
    .filter((r) => r.code && r.district_code && r.name);

  return { provinces, regencies, districts, villages };
}

async function ensureFinalTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_master_provinces (
      code VARCHAR(10) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_prov_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_master_regencies (
      code VARCHAR(10) PRIMARY KEY,
      province_code VARCHAR(10) NOT NULL,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_reg_province (province_code),
      INDEX idx_reg_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_master_districts (
      code VARCHAR(20) PRIMARY KEY,
      regency_code VARCHAR(10) NOT NULL,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_dist_regency (regency_code),
      INDEX idx_dist_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_master_villages (
      code VARCHAR(20) PRIMARY KEY,
      district_code VARCHAR(20) NOT NULL,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_vill_district (district_code),
      INDEX idx_vill_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureStagingTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_stg_provinces (
      code VARCHAR(10) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_stg_regencies (
      code VARCHAR(10) PRIMARY KEY,
      province_code VARCHAR(10) NOT NULL,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      INDEX idx_stg_reg_province (province_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_stg_districts (
      code VARCHAR(20) PRIMARY KEY,
      regency_code VARCHAR(10) NOT NULL,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      INDEX idx_stg_dist_regency (regency_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS expedition_stg_villages (
      code VARCHAR(20) PRIMARY KEY,
      district_code VARCHAR(20) NOT NULL,
      name VARCHAR(120) NOT NULL,
      latitude DOUBLE NOT NULL DEFAULT 0,
      longitude DOUBLE NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      INDEX idx_stg_vill_district (district_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function truncateStaging() {
  await db.query('TRUNCATE TABLE expedition_stg_provinces');
  await db.query('TRUNCATE TABLE expedition_stg_regencies');
  await db.query('TRUNCATE TABLE expedition_stg_districts');
  await db.query('TRUNCATE TABLE expedition_stg_villages');
}

async function bulkUpsert(tableName, columns, rows, chunkSize = 700) {
  if (!rows.length) return;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${columns.map(() => '?').join(',')})`).join(',');
    const updateClause = columns
      .filter((c) => c !== 'code')
      .map((c) => `${c}=VALUES(${c})`)
      .join(', ');

    const sql = `
      INSERT INTO ${tableName} (${columns.join(',')})
      VALUES ${placeholders}
      ON DUPLICATE KEY UPDATE ${updateClause}
    `;

    const values = [];
    chunk.forEach((row) => {
      columns.forEach((c) => values.push(row[c]));
    });

    await db.query(sql, values);
  }
}

async function mergeStagingToFinal() {
  await db.query(`
    INSERT INTO expedition_master_provinces (code, name, latitude, longitude, is_active)
    SELECT code, name, latitude, longitude, is_active FROM expedition_stg_provinces
    ON DUPLICATE KEY UPDATE
      name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude), is_active = VALUES(is_active)
  `);

  await db.query(`
    INSERT INTO expedition_master_regencies (code, province_code, name, latitude, longitude, is_active)
    SELECT code, province_code, name, latitude, longitude, is_active FROM expedition_stg_regencies
    ON DUPLICATE KEY UPDATE
      province_code = VALUES(province_code), name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude), is_active = VALUES(is_active)
  `);

  await db.query(`
    INSERT INTO expedition_master_districts (code, regency_code, name, latitude, longitude, is_active)
    SELECT code, regency_code, name, latitude, longitude, is_active FROM expedition_stg_districts
    ON DUPLICATE KEY UPDATE
      regency_code = VALUES(regency_code), name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude), is_active = VALUES(is_active)
  `);

  await db.query(`
    INSERT INTO expedition_master_villages (code, district_code, name, latitude, longitude, is_active)
    SELECT code, district_code, name, latitude, longitude, is_active FROM expedition_stg_villages
    ON DUPLICATE KEY UPDATE
      district_code = VALUES(district_code), name = VALUES(name), latitude = VALUES(latitude), longitude = VALUES(longitude), is_active = VALUES(is_active)
  `);
}

async function run() {
  const inputSqlPath = process.argv[2]
    ? path.resolve(process.argv[2])
    : '/Users/fitroaidil/Downloads/data-indonesia-master/wilayah_indonesia.sql';

  const useStaging = !process.argv.includes('--no-staging');
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(inputSqlPath)) {
    throw new Error(`SQL file not found: ${inputSqlPath}`);
  }

  console.log(`[import-sql] reading ${inputSqlPath}`);
  const { provinces, regencies, districts, villages } = loadFromSql(inputSqlPath);
  console.log(`[import-sql] parsed provinces=${provinces.length}, regencies=${regencies.length}, districts=${districts.length}, villages=${villages.length}`);

  if (dryRun) {
    console.log('[import-sql] dry-run only');
    return;
  }

  await ensureFinalTables();

  if (useStaging) {
    console.log('[import-sql] mode=staging -> merge');
    await ensureStagingTables();
    await truncateStaging();

    await bulkUpsert('expedition_stg_provinces', ['code', 'name', 'latitude', 'longitude', 'is_active'], provinces);
    await bulkUpsert('expedition_stg_regencies', ['code', 'province_code', 'name', 'latitude', 'longitude', 'is_active'], regencies);
    await bulkUpsert('expedition_stg_districts', ['code', 'regency_code', 'name', 'latitude', 'longitude', 'is_active'], districts);
    await bulkUpsert('expedition_stg_villages', ['code', 'district_code', 'name', 'latitude', 'longitude', 'is_active'], villages);

    await mergeStagingToFinal();
  } else {
    console.log('[import-sql] mode=direct upsert');
    await bulkUpsert('expedition_master_provinces', ['code', 'name', 'latitude', 'longitude', 'is_active'], provinces);
    await bulkUpsert('expedition_master_regencies', ['code', 'province_code', 'name', 'latitude', 'longitude', 'is_active'], regencies);
    await bulkUpsert('expedition_master_districts', ['code', 'regency_code', 'name', 'latitude', 'longitude', 'is_active'], districts);
    await bulkUpsert('expedition_master_villages', ['code', 'district_code', 'name', 'latitude', 'longitude', 'is_active'], villages);
  }

  console.log('[import-sql] done');
}

run()
  .then(async () => {
    await db.end();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('[import-sql] failed:', err && err.message ? err.message : err);
    if (err && err.code) console.error('[import-sql] code:', err.code);
    if (err && err.errno) console.error('[import-sql] errno:', err.errno);
    if (err && err.sqlMessage) console.error('[import-sql] sqlMessage:', err.sqlMessage);
    if (err && err.stack) console.error('[import-sql] stack:', err.stack);
    await db.end();
    process.exit(1);
  });
