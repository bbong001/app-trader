import { Pool } from 'pg';
import { DATABASE_URL } from '@config.env';

let connectionString = DATABASE_URL;

if (!connectionString) {
  // Avoid hardcoding secrets in source. Set DATABASE_URL in env config.
  throw new Error('Missing DATABASE_URL env var');
}

// pg-connection-string is warning that sslmode=require is treated like verify-full.
// For hosted Postgres providers (Aiven), we usually want libpq-compatible "require"
// semantics during development to avoid self-signed chain issues.
if (connectionString.includes('sslmode=require') && !connectionString.includes('uselibpqcompat=true')) {
  connectionString += (connectionString.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
}

export const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
});

export async function query<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return { rows: res.rows };
  } finally {
    client.release();
  }
}


