import { exec } from 'child_process';
import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { promisify } from 'util';
import { db } from '../lib/db';
import * as schema from '../lib/schema';
import { reset as resetDatabase } from 'drizzle-seed';

const execAsync = promisify(exec);

// Production safety check
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run reset in production!');
  process.exit(1);
}

async function resetDb() {
  const dbUrl = process.env.DATABASE_URL!;
  console.log('🔄 Resetting database...');
  console.log(`📍 Target: ${dbUrl}\n`);

  try {
    // Step 1: Truncate all tables (reverse FK order)
    console.log('  🗑️  Truncating all tables...');
    await resetDatabase(db, schema);
    console.log('  ✓ Tables truncated\n');

    // Step 2: Run migrations
    console.log('  📝 Running migrations...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('  ✓ Migrations applied\n');

    // Step 3: Run seed
    console.log('  🌱 Seeding database...');
    try {
      const { stdout, stderr } = await execAsync(
        `DATABASE_URL=${dbUrl} npx tsx drizzle/seed.ts`,
        { encoding: 'utf8' }
      );

      if (stderr) {
        console.error('Seed stderr:', stderr);
      }

      console.log(stdout);
    } catch (seedError) {
      console.error('❌ Seed failed:', seedError);
      throw seedError;
    }

    console.log('✅ Reset complete!\n');
  } catch (error) {
    console.error('❌ Reset failed:', error);
    process.exit(1);
  }
}

(async () => {
  await resetDb();
})();
