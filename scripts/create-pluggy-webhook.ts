#!/usr/bin/env tsx

import 'dotenv/config';
import { getPluggyClient } from '@/lib/pluggy/sdk';

const DEFAULT_APP_URL = 'https://northstar-personal-finance.vercel.app';
const WEBHOOK_PATH = '/api/webhooks/pluggy';
const DEFAULT_EVENTS = [
  'item/created',
  'item/updated',
  'item/login_succeeded',
  'item/error',
  'item/waiting_user_input',
  'item/login_required',
  'item/consent_expired',
  'item/deleted',
  'transactions/created',
  'transactions/updated',
  'transactions/deleted',
];

type Args = {
  url?: string;
  events: string[];
};

function printHelp() {
  console.log(`
Usage: tsx scripts/create-pluggy-webhook.ts [options]

Options:
  --url <url>          Full webhook URL (default: APP_URL + ${WEBHOOK_PATH})
  --event <event>      Event to create (repeatable)
  -h, --help           Show this help message

Environment:
  PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET (required)
  PLUGGY_BASE_URL (optional)
  PLUGGY_WEBHOOK_SECRET (optional; sent as x-webhook-secret header)
  NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL (optional)

Examples:
  tsx scripts/create-pluggy-webhook.ts
  tsx scripts/create-pluggy-webhook.ts --url https://example.com/api/webhooks/pluggy
  tsx scripts/create-pluggy-webhook.ts --event item/updated --event transactions/created
`);
}

function parseArgs(): Args | null {
  const raw = process.argv.slice(2);
  if (raw.includes('--help') || raw.includes('-h')) {
    printHelp();
    return null;
  }

  const events: string[] = [];
  let url: string | undefined;

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    switch (arg) {
      case '--url':
        url = raw[++i];
        break;
      case '--event':
        events.push(raw[++i]);
        break;
      default:
        console.error(`Unknown arg: ${arg}`);
        printHelp();
        return null;
    }
  }

  return {
    url,
    events: events.length > 0 ? events : DEFAULT_EVENTS,
  };
}

function resolveWebhookUrl(urlOverride?: string) {
  if (urlOverride && urlOverride.trim()) {
    return urlOverride.trim();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? process.env.NEXT_PUBLIC_SITE_URL
    ?? DEFAULT_APP_URL;
  const trimmed = appUrl.replace(/\/$/, '');
  return `${trimmed}${WEBHOOK_PATH}`;
}

async function run() {
  const args = parseArgs();
  if (!args) return;

  const webhookUrl = resolveWebhookUrl(args.url);
  const secret = process.env.PLUGGY_WEBHOOK_SECRET;
  const headers = secret ? { 'x-webhook-secret': secret } : undefined;
  const client = getPluggyClient();

  console.log('Creating Pluggy webhooks');
  console.log('URL:', webhookUrl);
  console.log('Events:', args.events.join(', '));
  if (headers) {
    console.log('Headers: x-webhook-secret (redacted)');
  }

  let failures = 0;

  for (const event of args.events) {
    try {
      const webhook = await client.createWebhook(
        event as Parameters<typeof client.createWebhook>[0],
        webhookUrl,
        headers
      );
      console.log(`Created webhook for ${event}:`, webhook.id ?? 'ok');
    } catch (error) {
      failures += 1;
      console.error(`Failed to create webhook for ${event}:`, error);
    }
  }

  if (failures > 0) {
    console.error(`Completed with ${failures} failure(s).`);
    process.exit(1);
  }
}

run().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
