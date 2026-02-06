'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CategoryIcon } from '@/components/icon-picker';
import { ReplenishmentPicker } from '@/components/replenishment-picker';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { RefundDialog } from '@/components/refund-dialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Clock01Icon, Link01Icon, ArrowReloadHorizontalIcon } from '@hugeicons/core-free-icons';
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
  onTogglePaid?: () => void;
  onToggleIgnore?: () => void;
  onRequestDelete?: () => void;
};

// --- Private helper components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1 shadow-[4px_4px_0px_0px_rgba(100,100,100,1)] border border-gray-600 p-1">{children}</div>
    </div>
  );
}

function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm font-medium break-words">{children}</div>
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1.5 gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 14) return raw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

// --- Main component ---

export function TransactionDetailSheet({
  expense,
  income,
  accounts,
  categories,
  open,
  onOpenChange,
  canConvertToFatura,
  onConvertToFatura,
  onTogglePaid,
  onToggleIgnore,
  onRequestDelete,
}: TransactionDetailSheetProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [replenishPickerOpen, setReplenishPickerOpen] = useState(false);
  const [replenishCategories, setReplenishCategories] = useState<{ id: number; name: string; color: string; icon: string | null }[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const isExpense = !!expense;
  const data = expense || income;
  const t = useTranslations('transactionDetail');
  const tExpenses = useTranslations('expenses');
  const tIncome = useTranslations('income');
  const tSynced = useTranslations('synced');

  const isSynced = isExpense
    ? expense?.accountSource === 'pluggy'
    : income?.accountSource === 'pluggy';

  if (!data) return null;

  const isPaidOrReceived = isExpense ? !!expense.paidAt : !!income?.receivedAt;
  const isIgnored = !!data?.ignored;
  const canMutate = !isSynced;
  const statusLabel = isExpense
    ? (isPaidOrReceived ? t('paid') : t('pending'))
    : (isPaidOrReceived ? t('received') : t('pending'));

  const dateLabel = isExpense ? t('dueDate') : t('receivedDate');
  const dateValue = isExpense ? expense.dueDate : income?.receivedDate;

  const togglePaidLabel = isExpense
    ? (isPaidOrReceived ? tExpenses('markAsPending') : tExpenses('markAsPaid'))
    : (isPaidOrReceived ? tIncome('markAsPending') : tIncome('markAsReceived'));

  const toggleIgnoreLabel = isExpense
    ? (isIgnored ? tExpenses('showInTotals') : tExpenses('hideFromTotals'))
    : (isIgnored ? tIncome('showInTotals') : tIncome('hideFromTotals'));

  const deleteLabel = isExpense ? tExpenses('deleteTransaction') : tIncome('deleteIncome');

  // Counterparty section visibility
  const hasCounterparty = isExpense
    ? !!(expense?.merchantName || expense?.beneficiaryName)
    : !!(income as IncomeEntry & { beneficiaryName?: string | null })?.beneficiaryName;

  // Indicators section visibility
  const hasIndicators = isExpense
    ? !!(expense?.linkedBillName || expense?.isFaturaPayment || (expense?.refundedAmount ?? 0) > 0 || isIgnored)
    : isIgnored;

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
        <SheetContent side="bottom" className="max-h-[85vh] flex flex-col">
          <SheetHeader className="pb-2 border-b border-b-gray-600">
            {/* Icon + Description + Category */}
            <div className="flex items-center gap-4">
              <div
                className="size-14 rounded-full flex items-center justify-center text-white shrink-0 text-xl"
                style={{ backgroundColor: data.categoryColor }}
              >
                <CategoryIcon icon={data.categoryIcon} />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-lg line-clamp-3">{data.description}</SheetTitle>
                <p className="text-sm text-muted-foreground">{data.categoryName}</p>
              </div>
            </div>

            {/* Hero amount + status badges */}
            <div className="flex items-center justify-between pt-2">
              <span className={`text-xl font-semibold tabular-nums ${isExpense ? '' : 'text-green-600'}`}>
                {isExpense ? '' : '+'}
                {formatCurrency(data.amount)}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant={isPaidOrReceived ? 'default' : 'secondary'} className={isPaidOrReceived ? 'bg-green-600' : ''}>
                  <HugeiconsIcon
                    icon={isPaidOrReceived ? Tick02Icon : Clock01Icon}
                    size={14}
                    strokeWidth={2}
                    className="mr-1"
                  />
                  {statusLabel}
                </Badge>
                {isSynced && (
                  <Badge variant="outline" className="text-white bg-blue-600 border-blue-300">
                    <HugeiconsIcon
                      icon={ArrowReloadHorizontalIcon}
                      size={14}
                      strokeWidth={2}
                    />
                  </Badge>
                )}
              </div>
            </div>
          </SheetHeader>

          {/* Scrollable content with sections */}
          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            <div className="space-y-5 p-4">
              {/* Section 1: Details (always shown) */}
              <Section title={t('sectionDetails')}>
                <InfoRow label={dateLabel}>
                  {formatDate(dateValue || '', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </InfoRow>

                {/* Purchase date — only if different from due date */}
                {isExpense && expense && expense.purchaseDate !== expense.dueDate && (
                  <InfoRow label={t('purchaseDate')}>
                    {formatDate(expense.purchaseDate, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </InfoRow>
                )}

                {/* Fatura month */}
                {isExpense && expense && (
                  <InfoRow label={t('fatura')}>
                    {formatDate(expense.faturaMonth + '-01', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </InfoRow>
                )}

                {/* Account — stacked for long names */}
                <InfoItem label={t('account')}>
                  {data.accountName}
                </InfoItem>

                {/* Installment badge */}
                {isExpense && expense && expense.totalInstallments > 1 && (
                  <InfoRow label={t('installment')}>
                    <Badge variant="secondary">
                      {expense.installmentNumber} {t('of')} {expense.totalInstallments}
                    </Badge>
                  </InfoRow>
                )}
              </Section>

              {/* Section 2: Counterparty (conditional) */}
              {hasCounterparty && (
                <Section title={t('sectionCounterparty')}>
                  {isExpense && expense?.merchantName && (
                    <InfoItem label={t('merchant')}>
                      {expense.merchantName}
                    </InfoItem>
                  )}

                  {isExpense && expense?.merchantBusinessName && (
                    <InfoItem label={t('businessName')}>
                      {expense.merchantBusinessName}
                    </InfoItem>
                  )}

                  {isExpense && expense?.merchantCnpj && (
                    <InfoItem label={t('cnpj')}>
                      {formatCnpj(expense.merchantCnpj)}
                    </InfoItem>
                  )}

                  {/* Beneficiary for expense transfers (only when no merchant) */}
                  {isExpense && expense?.beneficiaryName && !expense?.merchantName && (
                    <InfoItem label={t('beneficiary')}>
                      {expense.beneficiaryName}
                    </InfoItem>
                  )}

                  {/* Income payer */}
                  {!isExpense && income && (income as IncomeEntry & { beneficiaryName?: string | null }).beneficiaryName && (
                    <InfoItem label={t('payer')}>
                      {(income as IncomeEntry & { beneficiaryName?: string | null }).beneficiaryName!}
                    </InfoItem>
                  )}
                </Section>
              )}

              {/* Section 3: Indicators (conditional) */}
              {hasIndicators && (
                <Section title={t('sectionIndicators')}>
                  {/* Linked bill */}
                  {isExpense && expense?.linkedBillName && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Link01Icon} className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-blue-600 dark:text-blue-400">{t('linkedBill')}</p>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 break-words">{expense.linkedBillName}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fatura payment */}
                  {isExpense && expense?.isFaturaPayment && (
                    <div className="py-1.5">
                      <Badge variant="secondary" className="text-blue-600 dark:text-blue-400">
                        {t('faturaPayment')} — {t('faturaPaymentDescription')}
                      </Badge>
                    </div>
                  )}

                  {/* Refund info */}
                  {isExpense && (expense?.refundedAmount ?? 0) > 0 && (
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-xs text-muted-foreground">{t('refunded')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(expense!.refundedAmount ?? 0)}
                        </span>
                        {expense!.isFullyRefunded ? (
                          <Badge variant="secondary" className="text-green-600">
                            {t('fullyRefunded')}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t('partialRefund')}</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Ignored */}
                  {isIgnored && (
                    <div className="py-1.5">
                      <Badge variant="secondary" className="text-amber-600 dark:text-amber-400">
                        {isExpense ? tExpenses('hideFromTotals') : tIncome('hideFromTotals')}
                      </Badge>
                    </div>
                  )}
                </Section>
              )}
            </div>
          </div>

          {/* Footer buttons — tiered: primary → secondary → separator → destructive */}
          <SheetFooter className="flex-col gap-2 sm:flex-col pt-4 border-t border-t-gray-600">
            {/* Primary: Edit */}
            {canMutate && accounts && categories && (
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

            {/* Secondary actions */}
            {canMutate && onTogglePaid && (
              <Button variant="outline" className="w-full" onClick={onTogglePaid}>
                {togglePaidLabel}
              </Button>
            )}

            {onToggleIgnore && (
              <Button variant="outline" className="w-full" onClick={onToggleIgnore}>
                {toggleIgnoreLabel}
              </Button>
            )}

            {isExpense && expense && expense.totalInstallments > 1 && canMutate && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  console.log('View all installments for transaction:', expense.transactionId);
                }}
              >
                {t('viewAllInstallments', { count: expense.totalInstallments })}
              </Button>
            )}

            {canConvertToFatura && onConvertToFatura && canMutate && (
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

            {isExpense && expense && expense.accountType === 'credit_card' && !expense.ignored && !expense.isFullyRefunded && canMutate && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setRefundDialogOpen(true)}
              >
                {t('registerRefund')}
              </Button>
            )}

            {!isExpense && income?.receivedAt && canMutate && (
              <Button
                variant="outline"
                className="w-full"
                onClick={handleOpenReplenishPicker}
                disabled={isPending}
              >
                {tIncome('replenishBudget')}
              </Button>
            )}

            {/* Separator before destructive */}
            {canMutate && onRequestDelete && (
              <>
                <Separator />
                <Button variant="destructive" className="w-full" onClick={onRequestDelete}>
                  {deleteLabel}
                </Button>
              </>
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
