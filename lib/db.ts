import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:5432/fluxosh';

// Connection pool configuration
const pool = new Pool({
  connectionString: DATABASE_URL,
  max: 3, // Supabase free tier limit: 3-5 connections
  min: 1, // Keep one warm connection
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast if can't get connection
  allowExitOnIdle: false, // Keep process alive
});

// Log pool errors
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client', err);
});

export const db = drizzle(pool, { schema });
export { pool }; // For graceful shutdown if needed
