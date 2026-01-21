'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import type { Account } from '@/lib/schema';
import type { RecentAccount } from '@/lib/actions/accounts';
import { accountTypeConfig } from '@/lib/account-type-config';
import { BankLogo } from '@/components/bank-logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 3;

type AccountPickerProps = {
  accounts: Account[];
  recentAccounts: RecentAccount[];
  value: number;
  onChange: (value: number) => void;
  triggerId?: string;
};

function resolveAccountOptions(accounts: Account[]) {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    bankLogo: account.bankLogo ?? null,
  }));
}

export function AccountPicker({
  accounts,
  recentAccounts,
  value,
  onChange,
  triggerId,
}: AccountPickerProps) {
  const t = useTranslations('form');
  const accountOptions = useMemo(() => resolveAccountOptions(accounts), [accounts]);
  const selectedAccount = accountOptions.find((account) => account.id === value) || null;

  const recentOptions = useMemo(() => {
    if (recentAccounts.length === 0) return [];
    const used = new Set<number>();

    return recentAccounts
      .filter((account) => accounts.some((item) => item.id === account.id))
      .filter((account) => {
        if (used.has(account.id)) return false;
        used.add(account.id);
        return true;
      })
      .slice(0, RECENT_LIMIT)
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        bankLogo: account.bankLogo ?? null,
      }));
  }, [accounts, recentAccounts]);

  const showSelectedLabel = !!selectedAccount && !recentOptions.some((account) => account.id === value);

  return (
    <div className="space-y-2 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 min-h-8 w-full">
        <Select
          value={value ? value.toString() : ''}
          onValueChange={(next) => onChange(parseInt(next, 10))}
        >
          <SelectTrigger id={triggerId} className="min-w-full">
            <SelectValue placeholder={t('searchAccountTrigger')} />
          </SelectTrigger>
          <SelectContent>
            {accountOptions.length > 0 ? (
              accountOptions.map((account) => (
                <SelectItem key={account.id} value={account.id.toString()}>
                  <div className="flex items-center gap-2">
                    <AccountIcon type={account.type} bankLogo={account.bankLogo} />
                    <span>{account.name}</span>
                  </div>
                </SelectItem>
              ))
            ) : (
              <SelectItem value="" disabled>
                {t('noAccountsFound')}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {recentOptions.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {recentOptions.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => onChange(account.id)}
              className={cn(
                'flex items-center gap-2 rounded-none border px-2.5 py-1 text-xs transition',
                'bg-background hover:bg-muted',
                value === account.id
                  ? 'border-primary text-primary shadow-[2px_2px_0px_rgba(0,0,0,0.5)]'
                  : 'border-border text-foreground'
              )}
              aria-pressed={value === account.id}
            >
              <AccountIcon type={account.type} bankLogo={account.bankLogo} />
              <span className="truncate max-w-40">{account.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {t('noRecentAccounts')}
        </div>
      )}

      {showSelectedLabel && (
        <div className="text-xs text-muted-foreground">
          {t('selectedAccount', { account: selectedAccount.name })}
        </div>
      )}

    </div>
  );
}

function AccountIcon({ type, bankLogo }: { type: Account['type']; bankLogo: string | null }) {
  if (bankLogo) {
    return (
      <div className="size-5 rounded-full flex items-center justify-center bg-white p-0.5">
        <BankLogo logo={bankLogo} size={16} />
      </div>
    );
  }

  const config = accountTypeConfig[type];

  return (
    <div
      className="size-5 rounded-full flex items-center justify-center"
      style={{ backgroundColor: config.color }}
    >
      <HugeiconsIcon icon={config.icon} size={12} className="text-white" strokeWidth={2} />
    </div>
  );
}
