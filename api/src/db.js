const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://ops:ops_dev_password@localhost:5432/newtonite_ops' });
async function query(text, params) { return pool.query(text, params); }
async function tx(fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}
module.exports = { pool, query, tx };
