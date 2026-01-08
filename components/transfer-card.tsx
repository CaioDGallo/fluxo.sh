'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeftRightIcon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';

export type TransferListItem = {
  id: number;
  amount: number;
  date: string;
  type: 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';
  description: string | null;
  fromAccountName: string | null;
  toAccountName: string | null;
};

type TransferCardProps = {
  transfer: TransferListItem;
};

export function TransferCard({ transfer }: TransferCardProps) {
  const t = useTranslations('transfers');
  const fromLabel = transfer.fromAccountName ?? t('external');
  const toLabel = transfer.toAccountName ?? t('external');
  const title = transfer.description || t(`types.${transfer.type}`);

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{title}</h3>
          <div className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
            <span className="truncate">{fromLabel}</span>
            <HugeiconsIcon icon={ArrowLeftRightIcon} className="size-3 text-gray-400" />
            <span className="truncate">{toLabel}</span>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="text-sm font-semibold">{formatCurrency(transfer.amount)}</div>
          <div className="text-xs text-gray-500">{formatDate(transfer.date)}</div>
        </div>
      </CardContent>
    </Card>
  );
}
