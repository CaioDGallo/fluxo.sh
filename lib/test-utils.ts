import { db } from '@/lib/db';
import * as schema from '@/lib/schema';
import { reset } from 'drizzle-seed';
import bcrypt from 'bcryptjs';

const E2E_USER_ID = process.env.E2E_AUTH_USER_ID ?? '00000000-0000-4000-8000-000000000001';
const E2E_EMAIL = process.env.E2E_AUTH_EMAIL ?? 'e2e@example.com';
const E2E_PASSWORD = process.env.E2E_AUTH_PASSWORD ?? 'Password123';
const E2E_PASSWORD_HASH = bcrypt.hashSync(E2E_PASSWORD, 10);

export async function resetDatabase() {
  await reset(db, schema);
  await db
    .insert(schema.users)
    .values({
      id: E2E_USER_ID,
      email: E2E_EMAIL,
      name: 'E2E Test User',
      passwordHash: E2E_PASSWORD_HASH,
      emailVerified: new Date(),
      createdAt: new Date(),
      image: null,
    })
    .onConflictDoNothing();
}
