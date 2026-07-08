const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrateWorkshop() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '..', '..', 'db', 'schema_workshop.sql'), 'utf-8'
    );
    console.log('Applying schema_workshop.sql ...');
    await client.query(sql);
    console.log('Workshop migration completed successfully.');
  } catch (err) {
    console.error('Workshop migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrateWorkshop();
