import { PluggyClient } from 'pluggy-sdk';

export function getPluggyClient() {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET not configured');
  }

  return new PluggyClient({
    clientId,
    clientSecret,
    baseUrl: process.env.PLUGGY_BASE_URL,
  });
}
