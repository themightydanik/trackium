import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function migrate(pool) {
  const sql = await readFile(
    new URL('../../migrations/001_telemetry.sql', import.meta.url),
    'utf8'
  );
  const checksum = createHash('sha256').update(sql).digest('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(731824901)');
    await client.query(`CREATE TABLE IF NOT EXISTS gateway_schema_migrations (
      version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const previous = await client.query(
      'SELECT checksum FROM gateway_schema_migrations WHERE version=1'
    );
    if (previous.rowCount) {
      if (previous.rows[0].checksum !== checksum)
        throw new Error('telemetry migration checksum mismatch');
    } else {
      await client.query(sql);
      await client.query('INSERT INTO gateway_schema_migrations(version,checksum) VALUES(1,$1)', [
        checksum
      ]);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
