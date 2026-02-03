import { mapToPluggyError, PluggyError } from './errors';

type PluggyConfig = {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
};

type PluggyRequestOptions = {
  method?: string;
  apiKey?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
};

type ConnectTokenResponse = {
  connectToken?: string;
  accessToken?: string;
  token?: string;
  [key: string]: unknown;
};

export type PluggyAccount = {
  id: string;
  type: string;
  subtype?: string | null;
  number?: string | null;
  name?: string | null;
  marketingName?: string | null;
  balance?: number | null;
  itemId?: string | null;
  currencyCode?: string | null;
  creditData?: Record<string, unknown> | null;
  bankData?: Record<string, unknown> | null;
};

export type PluggyItem = {
  id: string;
  connectorId?: string | null;
  status?: string | null;
  statusDetail?: string | null;
  lastUpdatedAt?: string | null;
  consentExpiresAt?: string | null;
};

export type PluggyTransaction = {
  id: string;
  description?: string | null;
  descriptionRaw?: string | null;
  currencyCode?: string | null;
  amount: number;
  amountInAccountCurrency?: number | null;
  date: string;
  balance?: number | null;
  category?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  providerCode?: string | null;
  type: string;
  status?: string | null;
  paymentData?: { paymentMethod?: string | null } | null;
  operationType?: string | null;
  creditCardMetadata?: {
    installmentNumber?: number | null;
    totalInstallments?: number | null;
    totalAmount?: number | null;
    purchaseDate?: string | null;
    billId?: string | null;
  } | null;
  merchant?: Record<string, unknown> | null;
  providerId?: string | null;
};

export type PluggyTransactionsPage = {
  total: number;
  totalPages: number;
  page: number;
  results: PluggyTransaction[];
};

export type PluggyWebhook = {
  id?: string;
  event?: string;
  url?: string;
  headers?: Record<string, string> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

const DEFAULT_BASE_URL = 'https://api.pluggy.ai';
const DEFAULT_TIMEOUT_MS = 30000;
const API_KEY_TTL_MS = 25 * 60 * 1000; // 25 min (tokens last 30 min)

const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  retryableCodes: new Set([429, 500, 502, 503, 504]),
};

// API key cache
let cachedApiKey: { key: string; expiresAt: number } | null = null;

function getPluggyConfig(): PluggyConfig {
  const clientId = process.env.PLUGGY_CLIENT_ID;
  const clientSecret = process.env.PLUGGY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET not configured');
  }

  return {
    baseUrl: process.env.PLUGGY_BASE_URL ?? DEFAULT_BASE_URL,
    clientId,
    clientSecret,
  };
}

function normalizePath(path: string) {
  if (path.startsWith('/')) {
    return path;
  }
  return `/${path}`;
}

async function pluggyRequest<T>(path: string, options: PluggyRequestOptions = {}): Promise<T> {
  const { baseUrl } = getPluggyConfig();
  const method = options.method ?? 'GET';
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout ?? DEFAULT_TIMEOUT_MS
  );

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.apiKey ? { 'X-API-KEY': options.apiKey } : {}),
      ...options.headers,
    };

    const response = await fetch(`${baseUrl}${normalizePath(path)}`, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'string'
        ? payload
        : (payload as { message?: string }).message ?? 'Pluggy request failed';
      throw mapToPluggyError(new Error(message), response.status);
    }

    return payload as T;
  } catch (error) {
    // Re-throw PluggyError as-is
    if (error instanceof PluggyError) {
      throw error;
    }
    // Map other errors
    throw mapToPluggyError(error);
  } finally {
    clearTimeout(timeoutId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRetry(error: unknown, attempt: number): boolean {
  if (attempt >= RETRY_CONFIG.maxRetries) {
    return false;
  }

  if (error instanceof PluggyError) {
    // Retry on rate limit and server errors
    return (
      error.code === 'PLUGGY_RATE_LIMITED' ||
      (error.statusCode !== undefined && RETRY_CONFIG.retryableCodes.has(error.statusCode))
    );
  }

  return false;
}

async function pluggyRequestWithRetry<T>(
  path: string,
  options: PluggyRequestOptions = {}
): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await pluggyRequest<T>(path, options);
    } catch (error) {
      if (!shouldRetry(error, attempt)) {
        throw error;
      }
      const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  // Unreachable, but TypeScript needs this
  throw new Error('Max retries exceeded');
}

function extractApiKey(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const apiKey = record.apiKey ?? record.api_key ?? record.key;
    if (typeof apiKey === 'string' && apiKey.length > 0) {
      return apiKey;
    }
  }
  throw new Error('Pluggy API key missing in response');
}

function extractConnectToken(payload: ConnectTokenResponse): string {
  const token = payload.connectToken ?? payload.accessToken ?? payload.token;
  if (typeof token === 'string' && token.length > 0) {
    return token;
  }
  throw new Error('Pluggy connect token missing in response');
}

export async function createPluggyApiKey(): Promise<string> {
  const { clientId, clientSecret } = getPluggyConfig();
  const payload = await pluggyRequest<unknown>('/auth', {
    method: 'POST',
    body: {
      clientId,
      clientSecret,
    },
  });
  return extractApiKey(payload);
}

async function getApiKey(): Promise<string> {
  if (cachedApiKey && Date.now() < cachedApiKey.expiresAt) {
    return cachedApiKey.key;
  }
  const key = await createPluggyApiKey();
  cachedApiKey = { key, expiresAt: Date.now() + API_KEY_TTL_MS };
  return key;
}

export async function createPluggyConnectToken(
  clientUserId: string,
  options?: { itemId?: string; webhookUrl?: string }
) {
  if (!clientUserId) {
    throw new Error('clientUserId is required');
  }

  const apiKey = await getApiKey();
  const payload = await pluggyRequestWithRetry<ConnectTokenResponse>('/connect_token', {
    method: 'POST',
    apiKey,
    body: {
      clientUserId,
      ...(options?.itemId ? { itemId: options.itemId } : {}),
      ...(options?.webhookUrl ? { webhookUrl: options.webhookUrl } : {}),
    },
  });

  return {
    token: extractConnectToken(payload),
    raw: payload,
  };
}

export async function getPluggyItem(itemId: string) {
  if (!itemId) {
    throw new Error('itemId is required');
  }

  const apiKey = await getApiKey();
  return pluggyRequestWithRetry<PluggyItem>(`/items/${itemId}`, { apiKey });
}

function buildQuery(params: Record<string, string | string[] | number | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => search.append(key, entry));
    } else {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export async function listPluggyAccounts(options?: { itemId?: string }) {
  const apiKey = await getApiKey();
  const query = buildQuery({ itemId: options?.itemId });
  const payload = await pluggyRequestWithRetry<PluggyAccount[] | { results?: PluggyAccount[] }>(
    `/accounts${query}`,
    { apiKey }
  );
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object' && Array.isArray(payload.results)) {
    return payload.results;
  }
  throw new Error('Pluggy accounts response invalid');
}

export async function listPluggyTransactions(options: {
  accountId: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
  createdAtFrom?: string;
  ids?: string[];
}) {
  const apiKey = await getApiKey();
  const query = buildQuery({
    accountId: options.accountId,
    from: options.from,
    to: options.to,
    page: options.page,
    pageSize: options.pageSize,
    createdAtFrom: options.createdAtFrom,
    ids: options.ids,
  });

  return pluggyRequestWithRetry<PluggyTransactionsPage>(`/transactions${query}`, { apiKey });
}

export async function createPluggyWebhook(options: {
  event: string;
  url: string;
  headers?: Record<string, string>;
}): Promise<PluggyWebhook> {
  if (!options.event) {
    throw new Error('event is required');
  }
  if (!options.url) {
    throw new Error('url is required');
  }

  const apiKey = await getApiKey();
  return pluggyRequestWithRetry<PluggyWebhook>('/webhooks', {
    method: 'POST',
    apiKey,
    body: {
      event: options.event,
      url: options.url,
      ...(options.headers ? { headers: options.headers } : {}),
    },
  });
}

export async function updatePluggyItem(itemId: string, webhookUrl?: string): Promise<PluggyItem> {
  if (!itemId) {
    throw new Error('itemId is required');
  }

  const apiKey = await getApiKey();
  return pluggyRequestWithRetry<PluggyItem>(`/items/${itemId}`, {
    method: 'PATCH',
    apiKey,
    body: webhookUrl ? { webhookUrl } : {},
  });
}
