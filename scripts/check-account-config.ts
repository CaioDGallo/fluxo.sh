/**
 * Check account configuration for closing day
 */

import { db } from '@/lib/db';
import { accounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

async function check() {
  const allAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      type: accounts.type,
      closingDay: accounts.closingDay,
      paymentDueDay: accounts.paymentDueDay,
    })
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'));

  console.log('Credit Card Accounts:');
  console.table(allAccounts);
}

check()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
