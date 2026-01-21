'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryIcon } from '@/components/icon-picker';
import { ReplenishmentPicker } from '@/components/replenishment-picker';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { RefundDialog } from '@/components/refund-dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import { getReplenishableCategories, setIncomeReplenishment } from '@/lib/actions/income';
import type { ExpenseEntry } from '@/lib/contexts/expense-context';
import type { IncomeEntry } from '@/lib/contexts/income-context';
import type { Account, Category } from '@/lib/schema';
import type { UnpaidFatura } from '@/lib/actions/faturas';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type TransactionDetailSheetProps = {
  expense?: ExpenseEntry;
  income?: IncomeEntry;
  accounts?: Account[];
  categories?: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unpaidFaturas?: UnpaidFatura[];
  onConvertToFatura?: () => void;
  canConvertToFatura?: boolean;
};

export function TransactionDetailSheet({ expense, income, accounts, categories, open, onOpenChange, canConvertToFatura, onConvertToFatura }: TransactionDetailSheetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [replenishPickerOpen, setReplenishPickerOpen] = useState(false);
  const [replenishCategories, setReplenishCategories] = useState<{ id: number; name: string; color: string; icon: string | null }[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isExpense = !!expense;
  const data = expense || income;
  const t = useTranslations('transactionDetail');
  const tIncome = useTranslations('income');

  if (!data) return null;

  const isPaidOrReceived = isExpense ? !!expense.paidAt : !!income?.receivedAt;
  const statusLabel = isExpense
    ? (isPaidOrReceived ? t('paid') : t('pending'))
    : (isPaidOrReceived ? t('received') : t('pending'));

  const dateLabel = isExpense ? t('dueDate') : t('receivedDate');
  const dateValue = isExpense ? expense.dueDate : income?.receivedDate;

  const handleOpenReplenishPicker = async () => {
    if (!income?.receivedDate) return;
    const cats = await getReplenishableCategories();
    setReplenishCategories(cats);
    setReplenishPickerOpen(true);
  };

  const handleReplenishmentChange = async (categoryId: number | null) => {
    if (!income) return;
    setReplenishPickerOpen(false);
    startTransition(async () => {
      await setIncomeReplenishment(income.id, categoryId);
      router.refresh();
      toast.success(tIncome('replenishmentUpdated'));
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[70vh] flex flex-col">
          <SheetHeader className="pb-4">
            {/* Large category icon + description */}
            <div className="flex items-center gap-4">
              <div
                className="size-16 rounded-full flex items-center justify-center text-white shrink-0 text-2xl"
                style={{ backgroundColor: data.categoryColor }}
              >
                <CategoryIcon icon={data.categoryIcon} />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-xl line-clamp-4">{data.description}</SheetTitle>
                <p className="text-sm text-muted-foreground">{data.categoryName}</p>
              </div>
            </div>
          </SheetHeader>

          {/* Detail rows - scrollable */}
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="space-y-3 p-4">
              {/* Amount */}
              <DetailRow
                label={t('amount')}
                value={
                  <span className={isExpense ? 'font-semibold' : 'font-semibold text-green-600'}>
                    {isExpense ? '' : '+'}
                    {formatCurrency(data.amount)}
                  </span>
                }
              />

              {/* Status */}
              <DetailRow
                label={t('status')}
                value={
                  <div className="flex items-center gap-2">
                    <HugeiconsIcon
                      icon={isPaidOrReceived ? Tick02Icon : Clock01Icon}
                      className={isPaidOrReceived ? 'text-green-600' : 'text-gray-400'}
                      size={18}
                      strokeWidth={2}
                    />
                    <span className={isPaidOrReceived ? 'text-green-600' : 'text-gray-500'}>
                      {statusLabel}
                    </span>
                  </div>
                }
              />

              {/* Category */}
              <DetailRow label={t('category')} value={data.categoryName} />

              {/* Account */}
              <DetailRow label={t('account')} value={data.accountName} />

              {/* Date */}
              <DetailRow
                label={dateLabel}
                value={formatDate(dateValue || '', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              />

              {/* Expense-specific fields */}
              {isExpense && expense && (
                <>
                  {/* Purchase Date (show only if different from due date) */}
                  {expense.purchaseDate !== expense.dueDate && (
                    <DetailRow
                      label={t('purchaseDate')}
                      value={formatDate(expense.purchaseDate, {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    />
                  )}

                  {/* Fatura Month */}
                  <DetailRow
                    label={t('fatura')}
                    value={formatDate(expense.faturaMonth + '-01', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  />

                  {/* Installment info */}
                  {expense.totalInstallments > 1 && (
                    <DetailRow
                      label={t('installment')}
                      value={
                        <Badge variant="secondary">
                          {expense.installmentNumber} {t('of')} {expense.totalInstallments}
                        </Badge>
                      }
                    />
                  )}

                  {/* Refund info */}
                  {(expense.refundedAmount ?? 0) > 0 && (
                    <DetailRow
                      label={t('refunded')}
                      value={
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-green-600 font-semibold">
                            {formatCurrency(expense.refundedAmount ?? 0)}
                          </span>
                          {expense.isFullyRefunded && (
                            <Badge variant="secondary" className="text-green-600">
                              {t('fullyRefunded')}
                            </Badge>
                          )}
                          {!expense.isFullyRefunded && (
                            <Badge variant="outline">
                              {t('partialRefund')}
                            </Badge>
                          )}
                        </div>
                      }
                    />
                  )}
                </>
              )}
            </div>
          </div>

          {/* Footer buttons */}
          <SheetFooter className="flex-col gap-2 sm:flex-col pt-4">
            {/* View All Installments - only for multi-installment expenses */}
            {isExpense && expense && expense.totalInstallments > 1 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  // TODO: Navigate to filtered expense list
                  console.log('View all installments for transaction:', expense.transactionId);
                }}
              >
                {t('viewAllInstallments', { count: expense.totalInstallments })}
              </Button>
            )}

            {/* Convert to Fatura button - only for eligible expenses */}
            {canConvertToFatura && onConvertToFatura && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  onConvertToFatura();
                }}
              >
                {t('convertToFatura')}
              </Button>
            )}

            {/* Register refund button - only for credit card expenses */}
            {isExpense && expense && expense.accountType === 'credit_card' && !expense.ignored && !expense.isFullyRefunded && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setRefundDialogOpen(true)}
              >
                {t('registerRefund')}
              </Button>
            )}

            {/* Replenish budget button - only for received income */}
            {!isExpense && income?.receivedAt && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenReplenishPicker}
                disabled={isPending}
              >
                {tIncome('replenishBudget')}
              </Button>
            )}

            {/* Edit button */}
            {accounts && categories && (
              <Button
                variant="default"
                className="w-full"
                onClick={() => {
                  onOpenChange(false);
                  setEditOpen(true);
                }}
              >
                {t('edit')}
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {accounts && categories && (
        <EditTransactionDialog
          mode={isExpense ? 'expense' : 'income'}
          transactionId={isExpense ? expense?.transactionId : undefined}
          income={!isExpense ? income : undefined}
          accounts={accounts}
          categories={categories}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      {isExpense && expense && accounts && (
        <RefundDialog
          open={refundDialogOpen}
          onOpenChange={setRefundDialogOpen}
          transactionId={expense.transactionId}
          transactionDescription={expense.description}
          totalAmount={expense.totalAmount ?? 0}
          refundedAmount={expense.refundedAmount ?? 0}
          accountType={expense.accountType}
          closingDay={accounts.find((a) => a.id === expense.accountId)?.closingDay}
          paymentDueDay={accounts.find((a) => a.id === expense.accountId)?.paymentDueDay}
        />
      )}

      {!isExpense && income && (
        <ReplenishmentPicker
          categories={replenishCategories}
          currentCategoryId={income.replenishCategoryId}
          open={replenishPickerOpen}
          onOpenChange={setReplenishPickerOpen}
          onSelect={handleReplenishmentChange}
          isUpdating={isPending}
        />
      )}
    </>
  );
}

// Helper component for detail rows
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
