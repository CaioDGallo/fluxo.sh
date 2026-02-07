#!/usr/bin/env tsx

import 'dotenv/config';
import { getPluggyClient } from '@/lib/pluggy/sdk';

function printHelp() {
  console.log(`
Usage: tsx scripts/test-pluggy-transactions.ts [options]

Options:
  --account-id <uuid>  Pluggy account ID (required)
  --from <date>        Filter from date (YYYY-MM-DD)
  --to <date>          Filter to date (YYYY-MM-DD)
  --page <n>           Page number (default: 1)
  -h, --help           Show this help message

Environment:
  PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (required)
  PLUGGY_BASE_URL (optional)

Examples:
  tsx scripts/test-pluggy-transactions.ts --account-id <uuid>
  tsx scripts/test-pluggy-transactions.ts --account-id <uuid> --from 2025-01-01 --to 2025-01-31
  tsx scripts/test-pluggy-transactions.ts --account-id <uuid> --page 2
`);
}

type Args = {
  accountId: string;
  page: number;
  from?: string;
  to?: string;
};

function parseArgs(): Args | null {
  const raw = process.argv.slice(2);
  if (raw.includes('--help') || raw.includes('-h')) {
    printHelp();
    return null;
  }

  let accountId: string | undefined;
  let page = 1;
  let from: string | undefined;
  let to: string | undefined;

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    switch (arg) {
      case '--account-id':
        accountId = raw[++i];
        break;
      case '--page':
        page = parseInt(raw[++i], 10);
        break;
      case '--from':
        from = raw[++i];
        break;
      case '--to':
        to = raw[++i];
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

  return { accountId, page, from, to };
}

async function run() {
  const args = parseArgs();
  if (!args) return;

  const client = getPluggyClient();

  console.log(`Fetching transactions for account: ${args.accountId}`);
  if (args.from || args.to) {
    console.log(`Date range: ${args.from ?? '...'} → ${args.to ?? '...'}`);
  }
  console.log(`Page: ${args.page}\n`);

  const response = await client.fetchTransactions(args.accountId, {
    page: args.page,
    from: args.from,
    to: args.to,
  });

  console.log(`Total: ${response.total} | Page ${response.page} of ${response.totalPages}\n`);

  if (response.results.length === 0) {
    console.log('No transactions found.');
    return;
  }

  for (const tx of response.results) {
    const sign = tx.amount >= 0 ? '+' : '';
    console.log(`--- ${tx.id} ---`);
    console.log(`  Date:        ${tx.date}`);
    console.log(`  Description: ${tx.description}`);
    console.log(`  Amount:      ${sign}${tx.amount} ${tx.currencyCode}`);
    console.log(`  Type:        ${tx.type}`);
    console.log(`  Status:      ${tx.status ?? 'POSTED'}`);
    console.log(`  Category:    ${tx.category ?? '-'}`);
    if (tx.creditCardMetadata) {
      console.log(`  Card Meta:   ${JSON.stringify(tx.creditCardMetadata)}`);
    }
    if (tx.paymentData) {
      console.log(`  Payment:     ${JSON.stringify(tx.paymentData)}`);
    }
    console.log();
  }
}

run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
