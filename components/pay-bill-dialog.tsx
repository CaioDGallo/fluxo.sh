'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CurrencyInput } from '@/components/ui/currency-input';
import { markOccurrencePaid } from '@/lib/actions/bill-occurrences';
import type { Account } from '@/lib/schema';

interface PayBillDialogProps {
  occurrence: {
    id: number;
    expectedAmount: number | null;
    paidFromAccountId: number | null;
  };
  accounts: Account[];
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}

export function PayBillDialog({ occurrence, accounts, open, onClose, onPaid }: PayBillDialogProps) {
  const t = useTranslations('payBillDialog');
  const tCommon = useTranslations('common');
  const [amount, setAmount] = useState(occurrence.expectedAmount ?? 0);
  const [accountId, setAccountId] = useState<string>(
    occurrence.paidFromAccountId?.toString() ?? (accounts[0]?.id?.toString() ?? '')
  );
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    const result = await markOccurrencePaid(occurrence.id, {
      actualAmount: amount,
      paidFromAccountId: accountId ? Number(accountId) : undefined,
    });
    setSaving(false);
    if (result.success) {
      onPaid();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[70vh] sm:max-h-[60vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-balance">{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-2 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">{t('amount')}</Label>
            <CurrencyInput
              id="pay-amount"
              value={amount}
              onChange={setAmount}
              name="amount"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-account">{t('account')}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="pay-account" className="w-full">
                <SelectValue placeholder={t('selectAccount')} />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acct) => (
                  <SelectItem key={acct.id} value={acct.id.toString()}>
                    {acct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
          <Button
            onClick={handleConfirm}
            disabled={saving || !accountId}
            className="w-full sm:flex-1 h-10 sm:h-8"
          >
            {saving ? tCommon('paying') : t('confirm')}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full sm:flex-1 h-10 sm:h-8">
            {t('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
