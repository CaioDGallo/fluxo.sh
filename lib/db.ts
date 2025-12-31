import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

// Fallback to Supabase Local PostgreSQL if DATABASE_URL not set
const DATABASE_URL = process.env.DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/northstar';

export const db = drizzle(DATABASE_URL, { schema });
