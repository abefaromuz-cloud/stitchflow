const { Pool } = require('pg');
require('dotenv').config();

// Railway даёт DATABASE_URL, локально используем отдельные переменные
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }  // Railway требует SSL
    })
  : new Pool({
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      user:     process.env.DB_USER     || 'stitchflow',
      password: process.env.DB_PASSWORD || 'stitchflow',
      database: process.env.DB_NAME     || 'stitchflow',
    });

pool.on('error', (err) => {
  console.error('Unexpected PG client error', err);
});

module.exports = pool;
