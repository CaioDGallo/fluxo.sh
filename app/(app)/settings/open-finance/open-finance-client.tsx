'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getPluggyConnectToken, syncPluggyItemById } from '@/lib/actions/pluggy';
import { useFormat } from '@/lib/hooks/use-format';

type PluggyItemView = {
  id: number;
  pluggyItemId: string;
  connectorId: string | null;
  status: string | null;
  statusDetail: string | null;
  lastUpdatedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string | null;
};

type PluggyAccountView = {
  id: number;
  pluggyAccountId: string;
  name: string;
  type: string;
  subtype: string | null;
  currency: string | null;
  accountId: number | null;
  accountName: string | null;
  accountType: string | null;
  accountSource: 'manual' | 'pluggy' | null;
  createdAt: string | null;
};

type SyncSummary = {
  pluggyItemId: string;
  syncedAt: string;
  accountsSynced: number;
  accountsCreated: number;
  transactionsCreated: number;
  incomeCreated: number;
  transfersCreated: number;
  skipped: number;
};

type OpenFinanceClientProps = {
  items: PluggyItemView[];
  accounts: PluggyAccountView[];
};

export function OpenFinanceClient({ items, accounts }: OpenFinanceClientProps) {
  const t = useTranslations('openFinance');
  const tCommon = useTranslations('common');
  const { date: formatDate } = useFormat();
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);
  const [itemId, setItemId] = useState('');
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);

  function formatDateTime(value: string | null) {
    if (!value) return t('never');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('never');
    return formatDate(date);
  }

  async function handleConnectToken() {
    setIsTokenLoading(true);
    try {
      const result = await getPluggyConnectToken();
      if (result.success) {
        setToken(result.token);
        toast.success(t('tokenReady'));
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
    } finally {
      setIsTokenLoading(false);
    }
  }

  async function runSync(targetId: string) {
    setSyncingItemId(targetId);
    try {
      const result = await syncPluggyItemById(targetId);
      if (result.success) {
        setSyncResult(result.result);
        toast.success(t('syncSuccess'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
    } finally {
      setSyncingItemId(null);
    }
  }

  async function handleSync() {
    const trimmed = itemId.trim();
    if (!trimmed) {
      toast.error(t('itemIdRequired'));
      return;
    }

    await runSync(trimmed);
  }

  async function handleSyncItem(id: string) {
    setItemId(id);
    await runSync(id);
  }

  async function handleCopyToken() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.success(t('tokenCopied'));
    } catch {
      toast.error(t('tokenCopyFailed'));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('connectTitle')}</CardTitle>
          <CardDescription>{t('connectDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={handleConnectToken} disabled={isTokenLoading}>
              {isTokenLoading ? t('generatingToken') : t('connectButton')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('connectHelper')}</p>
          </div>
          {token && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pluggy-token">
                {t('tokenLabel')}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input id="pluggy-token" value={token} readOnly />
                <Button variant="outline" type="button" onClick={handleCopyToken}>
                  {t('copyToken')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t('tokenHelper')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('syncTitle')}</CardTitle>
          <CardDescription>{t('syncDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="pluggy-item-id">
                {t('itemIdLabel')}
              </label>
              <Input
                id="pluggy-item-id"
                value={itemId}
                onChange={(event) => setItemId(event.target.value)}
                placeholder={t('itemIdPlaceholder')}
              />
            </div>
            <Button onClick={handleSync} disabled={!!syncingItemId}>
              {syncingItemId ? t('syncing') : t('syncButton')}
            </Button>
          </div>
          {syncResult && (
            <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap gap-3">
                <span>{t('syncResultAccounts', { count: syncResult.accountsSynced })}</span>
                <span>{t('syncResultCreated', { count: syncResult.accountsCreated })}</span>
                <span>{t('syncResultTransactions', { count: syncResult.transactionsCreated })}</span>
                <span>{t('syncResultIncome', { count: syncResult.incomeCreated })}</span>
                <span>{t('syncResultTransfers', { count: syncResult.transfersCreated })}</span>
                <span>{t('syncResultSkipped', { count: syncResult.skipped })}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('itemsTitle')}</CardTitle>
          <CardDescription>{t('itemsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('itemsEmpty')}</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-3 border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.pluggyItemId}</span>
                    {item.status && (
                      <Badge variant="outline">{item.status}</Badge>
                    )}
                  </div>
                  {item.statusDetail && (
                    <p className="text-xs text-muted-foreground">{item.statusDetail}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:items-end">
                  <div>
                    <p>{t('lastSyncedAt', { date: formatDateTime(item.lastSyncedAt) })}</p>
                    <p>{t('lastUpdatedAt', { date: formatDateTime(item.lastUpdatedAt) })}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncItem(item.pluggyItemId)}
                    disabled={syncingItemId === item.pluggyItemId}
                  >
                    {syncingItemId === item.pluggyItemId ? t('syncing') : t('syncButton')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('accountsTitle')}</CardTitle>
          <CardDescription>{t('accountsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('accountsEmpty')}</p>
          ) : (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-2 border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{account.name}</span>
                    <Badge variant="outline">{account.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('pluggyAccountId', { id: account.pluggyAccountId })}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <p>{t('linkedAccount')}</p>
                  <p className="text-sm text-foreground">
                    {account.accountName ?? t('unlinkedAccount')}
                  </p>
                  {account.accountSource && (
                    <p className="text-[10px] text-muted-foreground">
                      {t('accountSource', { source: account.accountSource })}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
