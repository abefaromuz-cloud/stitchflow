const fs = require('fs');
const path = require('path');
const pool = require('./pool');

async function migrate() {
  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
    console.log('Applying schema.sql ...');
    await client.query(fs.readFileSync(schemaPath, 'utf-8'));

    const schema2Path = path.join(__dirname, '..', '..', 'db', 'schema_stage2.sql');
    if (fs.existsSync(schema2Path)) {
      console.log('Applying schema_stage2.sql ...');
      await client.query(fs.readFileSync(schema2Path, 'utf-8'));
    }

    const schema3Path = path.join(__dirname, '..', '..', 'db', 'schema_stage3.sql');
    if (fs.existsSync(schema3Path)) {
      console.log('Applying schema_stage3.sql ...');
      await client.query(fs.readFileSync(schema3Path, 'utf-8'));
    }

    const schema4Path = path.join(__dirname, '..', '..', 'db', 'schema_stage4.sql');
    if (fs.existsSync(schema4Path)) {
      console.log('Applying schema_stage4.sql ...');
      await client.query(fs.readFileSync(schema4Path, 'utf-8'));
    }

    const schema5Path = path.join(__dirname, '..', '..', 'db', 'schema_stage5.sql');
    if (fs.existsSync(schema5Path)) {
      console.log('Applying schema_stage5.sql ...');
      await client.query(fs.readFileSync(schema5Path, 'utf-8'));
    }

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
