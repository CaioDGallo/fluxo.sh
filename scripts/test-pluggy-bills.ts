#!/usr/bin/env tsx

import 'dotenv/config';
import { getPluggyClient } from '@/lib/pluggy/sdk';

function printHelp() {
  console.log(`
Usage: tsx scripts/test-pluggy-bills.ts [options]

Options:
  --account-id <uuid>  Pluggy account ID (required)
  --page <n>           Page number (default: 1)
  -h, --help           Show this help message

Environment:
  PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (required)
  PLUGGY_BASE_URL (optional)

Examples:
  tsx scripts/test-pluggy-bills.ts --account-id 123e4567-e89b-12d3-a456-426614174000
  tsx scripts/test-pluggy-bills.ts --account-id <uuid> --page 2
`);
}

type Args = { accountId: string; page: number };

function parseArgs(): Args | null {
  const raw = process.argv.slice(2);
  if (raw.includes('--help') || raw.includes('-h')) {
    printHelp();
    return null;
  }

  let accountId: string | undefined;
  let page = 1;

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    switch (arg) {
      case '--account-id':
        accountId = raw[++i];
        break;
      case '--page':
        page = parseInt(raw[++i], 10);
        break;
      default:
        console.error(`Unknown arg: ${arg}`);
        printHelp();
        return null;
    }
  }

  if (!accountId) {
    console.error('Error: --account-id is required');
    printHelp();
    return null;
  }

  return { accountId, page };
}

async function run() {
  const args = parseArgs();
  if (!args) return;

  const client = getPluggyClient();

  console.log(`Fetching credit card bills for account: ${args.accountId}`);
  console.log(`Page: ${args.page}\n`);

  const response = await client.fetchCreditCardBills(args.accountId, {
    page: args.page,
  });

  console.log(`Total: ${response.total} | Page ${response.page} of ${response.totalPages}\n`);

  if (response.results.length === 0) {
    console.log('No bills found.');
    return;
  }

  for (const bill of response.results) {
    console.log(`--- Bill ${bill.id} ---`);
    console.log(`  Due Date:        ${bill.dueDate}`);
    console.log(`  Total Amount:    ${bill.totalAmount} ${bill.totalAmountCurrencyCode}`);
    console.log(`  Min Payment:     ${bill.minimumPaymentAmount}`);
    console.log(`  Installments:    ${bill.allowsInstallments ? 'yes' : 'no'}`);
    console.log(`  Finance Charges: ${JSON.stringify(bill.financeCharges)}`);
    console.log(`  Created:         ${bill.createdAt}`);
    console.log(`  Updated:         ${bill.updatedAt}`);
    console.log();
  }
}

run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
