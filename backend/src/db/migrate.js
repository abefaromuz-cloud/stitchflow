const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'db', 'schema.sql'), 'utf-8');
    console.log('Applying schema.sql ...');
    await client.query(sql);
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
