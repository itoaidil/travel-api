const db = require('../config/database');

(async () => {
  try {
    console.log('Starting update: set all departure dates to 2025-11-18 (keep time)');

    const [result] = await db.promise().query(
      `UPDATE travels 
       SET departure_time = CONCAT('2025-11-18 ', TIME(departure_time))
       WHERE DATE(departure_time) <> '2025-11-18' AND status = 'scheduled'`
    );

    console.log(`Rows updated: ${result.affectedRows}`);

    // Quick check by grouping times per origin-destination for 2025-11-18
    const [rows] = await db.promise().query(
      `SELECT origin, destination, COUNT(*) as cnt
       FROM travels
       WHERE DATE(departure_time) = '2025-11-18'
       GROUP BY origin, destination`
    );

    console.table(rows);
  } catch (err) {
    console.error('Update failed:', err.message);
  } finally {
    db.end();
  }
})();
