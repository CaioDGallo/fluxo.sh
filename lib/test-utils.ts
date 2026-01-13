import { db } from '@/lib/db';
import * as schema from '@/lib/schema';
import { reset } from 'drizzle-seed';

export async function resetDatabase() {
  await reset(db, schema);
}
