'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createRefund } from '@/lib/actions/refunds';
import { centsToDisplay, displayToCents } from '@/lib/utils';
import { getFaturaMonth } from '@/lib/fatura-utils';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type RefundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: number;
  transactionDescription: string | null;
  totalAmount: number; // cents
  refundedAmount: number; // cents
  accountType: string;
  closingDay?: number | null;
  paymentDueDay?: number | null;
};

export function RefundDialog({
  open,
  onOpenChange,
  transactionId,
  transactionDescription,
  totalAmount,
  refundedAmount,
  accountType,
  closingDay,
  paymentDueDay,
}: RefundDialogProps) {
  const router = useRouter();
  const t = useTranslations('refunds');
  const [isPending, startTransition] = useTransition();

  const remainingAmount = totalAmount - (refundedAmount || 0);
  const today = new Date().toISOString().split('T')[0];

  const [amount, setAmount] = useState(centsToDisplay(remainingAmount));
  const [refundDate, setRefundDate] = useState(today);

  const amountInCents = displayToCents(amount);
  const isPartialRefund = amountInCents < remainingAmount;
  const isCreditCard = accountType === 'credit_card';
  const hasBillingConfig = isCreditCard && closingDay && paymentDueDay;

  // Calculate fatura month from refund date
  const faturaMonth = hasBillingConfig
    ? getFaturaMonth(new Date(refundDate + 'T00:00:00Z'), closingDay!)
    : refundDate.slice(0, 7); // YYYY-MM

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountInCents <= 0) {
      toast.error(t('amountRequired'));
      return;
    }

    if (amountInCents > remainingAmount) {
      toast.error(t('amountExceedsRemaining'));
      return;
    }

    startTransition(async () => {
      try {
        await createRefund({
          transactionId,
          amount: amountInCents,
          refundDate,
          faturaMonth,
          description: `Estorno - ${transactionDescription || 'Despesa'}`,
        });

        toast.success(t('refundCreated'));
        onOpenChange(false);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('createFailed'));
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('registerRefund')}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {transactionDescription}
          </p>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">{t('refundAmount')}</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {t('maxAmount')}: {centsToDisplay(remainingAmount)}
              </p>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="refundDate">{t('refundDate')}</Label>
              <Input
                id="refundDate"
                type="date"
                value={refundDate}
                onChange={(e) => setRefundDate(e.target.value)}
              />
              {hasBillingConfig && (
                <p className="text-xs text-muted-foreground">
                  {t('creditIn')}: {faturaMonth}
                </p>
              )}
            </div>

            {/* Partial refund warning */}
            {isPartialRefund && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">
                  {t('partialRefundWarning')}
                </p>
              </div>
            )}
          </div>

          <SheetFooter className="flex-col gap-2 sm:flex-col pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? t('creating') : t('create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
