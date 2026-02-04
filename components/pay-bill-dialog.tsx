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
      <SheetContent side="bottom" className="max-h-[60vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-2 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="pay-amount">{t('amount')}</Label>
            <CurrencyInput
              id="pay-amount"
              value={amount}
              onChange={setAmount}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-account">{t('account')}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="pay-account">
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

        <div className="flex gap-3 pt-4 pb-2">
          <Button onClick={handleConfirm} disabled={saving || !accountId} className="flex-1">
            {saving ? '...' : t('confirm')}
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">{t('cancel')}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
