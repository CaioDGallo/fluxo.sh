'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { payFatura } from '@/lib/actions/faturas';
import { toast } from 'sonner';
import type { Account } from '@/lib/schema';

type PayFaturaDialogProps = {
  faturaId: number;
  totalAmount: number;
  accountName: string;
  checkingAccounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PayFaturaDialog({
  faturaId,
  totalAmount,
  accountName,
  checkingAccounts,
  open,
  onOpenChange,
}: PayFaturaDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('faturas');
  const tCommon = useTranslations('common');

  const handlePay = async () => {
    if (!selectedAccountId) {
      toast.error(t('selectAccountError'));
      return;
    }

    startTransition(async () => {
      try {
        await payFatura(faturaId, parseInt(selectedAccountId));
        toast.success(t('faturaPaidSuccess'));
        onOpenChange(false);
        setSelectedAccountId('');
      } catch (error) {
        toast.error(t('errorPayingFatura'));
        console.error(error);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent closeOnBackdropClick>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('payFatura')}</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">{t('cardLabel')} {accountName}</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totalAmount)}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              {t('payWithAccount')}
            </label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectAccount')} />
              </SelectTrigger>
              <SelectContent>
                {checkingAccounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
          <Button onClick={handlePay} disabled={isPending || !selectedAccountId}>
            {isPending ? tCommon('paying') : t('confirmPayment')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
