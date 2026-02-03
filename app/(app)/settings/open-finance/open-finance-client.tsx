'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PluggyDisconnectDialog } from '@/components/pluggy-disconnect-dialog';
import { toast } from 'sonner';
import {
  getPluggyConnectToken,
  initializePluggyItemAccounts,
  syncPluggyItemById,
} from '@/lib/actions/pluggy';
import { useFormat } from '@/lib/hooks/use-format';
import { usePluggyConnect } from '@/lib/hooks/use-pluggy-connect';

type PluggyItemView = {
  id: number;
  pluggyItemId: string;
  connectorId: string | null;
  status: string | null;
  statusDetail: string | null;
  lastUpdatedAt: string | null;
  lastSyncedAt: string | null;
  nextSyncAt: string | null;
  lastError: string | null;
  errorCount: number | null;
  createdAt: string | null;
};

type PluggyAccountView = {
  id: number;
  itemId: number | null;
  pluggyItemId: string | null;
  pluggyAccountId: string;
  name: string;
  type: string;
  subtype: string | null;
  currency: string | null;
  mask: string | null;
  institutionName: string | null;
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
  pluggyAccounts: PluggyAccountView[];
};

export function OpenFinanceClient({ items, pluggyAccounts }: OpenFinanceClientProps) {
  const t = useTranslations('openFinance');
  const tCommon = useTranslations('common');
  const { date: formatDate } = useFormat();
  const router = useRouter();

  const [isConnecting, setIsConnecting] = useState(false);
  const [reconnectingItemId, setReconnectingItemId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncSummary | null>(null);
  const [syncingItemId, setSyncingItemId] = useState<string | null>(null);
  const [initializingItemId, setInitializingItemId] = useState<string | null>(null);
  const [disconnectItem, setDisconnectItem] = useState<PluggyItemView | null>(null);
  const connectCompletedRef = useRef(false);

  const { open, isLoading: isConnectLoading, sdkReady } = usePluggyConnect({
    onSuccess: async (pluggyItemId) => {
      connectCompletedRef.current = true;
      setIsConnecting(false);
      setReconnectingItemId(null);
      toast.success(t('connectSuccess'));
      await initializeItemAccounts(pluggyItemId);
    },
    onError: (error) => {
      connectCompletedRef.current = false;
      setIsConnecting(false);
      setReconnectingItemId(null);
      console.error('[pluggy:connect] Failed:', error);
      toast.error(t('connectFailed'));
    },
    onClose: () => {
      setIsConnecting(false);
      setReconnectingItemId(null);
      if (!connectCompletedRef.current) {
        toast(t('connectCancelled'));
      }
      connectCompletedRef.current = false;
    },
  });

  function formatDateTime(value: string | null) {
    if (!value) return t('never');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('never');
    return formatDate(date);
  }

  function getItemStatus(item: PluggyItemView) {
    const status = item.status?.toLowerCase() ?? '';
    const hasError = Boolean(item.lastError) || status.includes('error');
    const needsAttention = status.includes('waiting') || status.includes('login') || status.includes('outdated');

    if (hasError) {
      return { label: t('statusError'), variant: 'destructive' as const };
    }
    if (needsAttention) {
      return { label: t('statusNeedsAttention'), variant: 'outline' as const };
    }
    return { label: t('statusHealthy'), variant: 'secondary' as const };
  }

  async function initializeItemAccounts(itemId: string) {
    setInitializingItemId(itemId);
    try {
      const result = await initializePluggyItemAccounts(itemId);
      if (result.success) {
        toast.success(t('accountsInitialized', { count: result.result.accountsCreated }));
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
    } finally {
      setInitializingItemId(null);
      router.refresh();
    }
  }

  async function handleConnect() {
    setIsConnecting(true);
    connectCompletedRef.current = false;
    try {
      const result = await getPluggyConnectToken();
      if (result.success) {
        await open(result.token);
      } else {
        toast.error(result.error);
        setIsConnecting(false);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
      setIsConnecting(false);
    }
  }

  async function handleReconnect(pluggyItemId: string) {
    setReconnectingItemId(pluggyItemId);
    connectCompletedRef.current = false;
    try {
      const result = await getPluggyConnectToken(pluggyItemId);
      if (result.success) {
        await open(result.token);
      } else {
        toast.error(result.error);
        setReconnectingItemId(null);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
      setReconnectingItemId(null);
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


  const isConnectBusy = isConnecting || isConnectLoading;
  const isConnectDisabled = isConnectBusy || !sdkReady;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('connectTitle')}</CardTitle>
          <CardDescription>{t('connectDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button onClick={handleConnect} disabled={isConnectDisabled}>
              {isConnectBusy ? t('connectingBank') : t('connectWithPluggy')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('connectHelper')}</p>
          </div>
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
            items.map((item) => {
              const status = getItemStatus(item);
              const canReconnect = status.variant !== 'secondary';

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 border border-border/70 p-3 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{item.pluggyItemId}</span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    {item.statusDetail && (
                      <p className="text-xs text-muted-foreground">{item.statusDetail}</p>
                    )}
                    {item.lastError && (
                      <p className="text-xs text-destructive">{t('lastError', { error: item.lastError })}</p>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{t('lastSyncedAt', { date: formatDateTime(item.lastSyncedAt) })}</span>
                      <span>{t('nextSyncAt', { date: formatDateTime(item.nextSyncAt) })}</span>
                      <span>{t('lastUpdatedAt', { date: formatDateTime(item.lastUpdatedAt) })}</span>
                      {item.errorCount && item.errorCount > 0 ? (
                        <span>{t('errorCount', { count: item.errorCount })}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-row flex-wrap gap-2 sm:flex-col sm:items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => runSync(item.pluggyItemId)}
                      disabled={syncingItemId === item.pluggyItemId}
                    >
                      {syncingItemId === item.pluggyItemId ? t('syncing') : t('syncButton')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => initializeItemAccounts(item.pluggyItemId)}
                      disabled={initializingItemId === item.pluggyItemId}
                    >
                      {initializingItemId === item.pluggyItemId ? t('refreshingAccounts') : t('refreshAccounts')}
                    </Button>
                    {canReconnect && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReconnect(item.pluggyItemId)}
                        disabled={reconnectingItemId === item.pluggyItemId}
                      >
                        {reconnectingItemId === item.pluggyItemId ? t('connectingBank') : t('reconnect')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDisconnectItem(item)}
                    >
                      {t('disconnect')}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
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
          <CardTitle>{t('accountsTitle')}</CardTitle>
          <CardDescription>{t('accountsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pluggyAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('accountsEmpty')}</p>
          ) : (
            pluggyAccounts.map((account) => {
              const currentLabel = account.accountId
                ? (account.accountName ?? account.name)
                : t('unlinkedAccount');
              const currentType = account.accountType ?? null;

              return (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{account.name}</span>
                      <Badge variant="outline">{account.type}</Badge>
                      {account.subtype ? <Badge variant="outline">{account.subtype}</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('pluggyAccountId', { id: account.pluggyAccountId })}
                      {account.mask ? ` · ${account.mask}` : ''}
                      {account.institutionName ? ` · ${account.institutionName}` : ''}
                    </p>
                  </div>
                  <div className="text-[10px] text-muted-foreground sm:text-right">
                    <p>{t('linkedAccount')}</p>
                    <p className="text-xs text-foreground">{currentLabel}</p>
                    {currentType ? (
                      <p className="text-[10px] text-muted-foreground">{currentType}</p>
                    ) : null}
                    {account.accountSource && (
                      <p className="text-[10px] text-muted-foreground">
                        {t('accountSource', { source: account.accountSource })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {disconnectItem ? (
        <PluggyDisconnectDialog
          itemId={disconnectItem.id}
          open={!!disconnectItem}
          onOpenChange={(open) => {
            if (!open) setDisconnectItem(null);
          }}
          onSuccess={() => {
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
