'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CurrencyInput } from '@/components/ui/currency-input';
import { markOccurrencePaidWithExpense } from '@/lib/actions/bill-occurrences';
import type { Account } from '@/lib/schema';

interface PayBillDialogProps {
  occurrence: {
    id: number;
    expectedAmount: number | null;
    paidFromAccountId: number | null;
  };
  bill: {
    name: string;
    categoryId: number | null;
  };
  accounts: Account[];
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}

export function PayBillDialog({ occurrence, bill, accounts, open, onClose, onPaid }: PayBillDialogProps) {
  const t = useTranslations('payBillDialog');
  const tCommon = useTranslations('common');
  const [amount, setAmount] = useState(occurrence.expectedAmount ?? 0);
  const [accountId, setAccountId] = useState<string>(
    occurrence.paidFromAccountId?.toString() ?? (accounts[0]?.id?.toString() ?? '')
  );
  const [createExpense, setCreateExpense] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    const result = await markOccurrencePaidWithExpense(occurrence.id, {
      actualAmount: amount,
      paidFromAccountId: accountId ? Number(accountId) : undefined,
      billName: bill.name,
      billCategoryId: bill.categoryId,
      createExpense,
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

          {bill.categoryId ? (
            <div className="flex items-start gap-2 rounded-none bg-muted p-3">
              <Checkbox
                id="create-expense"
                checked={createExpense}
                onCheckedChange={(checked) => setCreateExpense(checked === true)}
              />
              <div className="flex flex-col gap-0.5">
                <Label
                  htmlFor="create-expense"
                  className="text-sm font-medium cursor-pointer"
                >
                  {t('createExpense')}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {t('createExpenseDescription')}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-none bg-yellow-50 dark:bg-yellow-950/20 p-3 border border-yellow-200 dark:border-yellow-800">
              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                {t('noCategoryWarning')}
              </p>
            </div>
          )}
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
