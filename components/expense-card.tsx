'use client';

import { useState, useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { triggerHaptic, HapticPatterns } from '@/lib/utils/haptics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { useIsMobile } from '@/hooks/use-mobile';
import { markEntryPaid, markEntryPending, deleteExpense, updateTransactionCategory } from '@/lib/actions/expenses';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { TransactionDetailSheet } from '@/components/transaction-detail-sheet';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { ConvertToFaturaDialog } from '@/components/convert-to-fatura-dialog';
import { useExpenseContextOptional } from '@/lib/contexts/expense-context';
import type { Category, Account } from '@/lib/schema';
import type { UnpaidFatura } from '@/lib/actions/faturas';
import type { RecentAccount } from '@/lib/actions/accounts';
import type { RecentCategory } from '@/lib/actions/categories';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon, Tick02Icon, Clock01Icon, ArrowReloadHorizontalIcon } from '@hugeicons/core-free-icons';
import { accountTypeConfig } from '@/lib/account-type-config';
import { BankLogo } from '@/components/bank-logo';

type ExpenseCardBaseProps = {
  entry: {
    id: number;
    amount: number;
    purchaseDate: string;
    faturaMonth: string;
    dueDate: string;
    paidAt: string | null;
    installmentNumber: number;
    transactionId: number;
    description: string | null;
    totalInstallments: number;
    totalAmount: number;
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountId: number;
    accountName: string;
    accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
    accountSource: 'manual' | 'pluggy';
    bankLogo: string | null;
    ignored: boolean;
    refundedAmount?: number | null;
    isFullyRefunded?: boolean;
  };
  categories: Category[];
  accounts: Account[];
  recentAccounts?: RecentAccount[];
  recentCategories?: RecentCategory[];
  unpaidFaturas?: UnpaidFatura[];
  isOptimistic?: boolean;
};

type ExpenseCardProps =
  | (ExpenseCardBaseProps & {
    selectionMode: false;
    isSelected?: never;
    onLongPress?: () => void;
    onToggleSelection?: never;
  })
  | (ExpenseCardBaseProps & {
    selectionMode: true;
    isSelected: boolean;
    onLongPress: () => void;
    onToggleSelection: () => void;
  });

export function ExpenseCard(props: ExpenseCardProps) {
  const { entry, categories, accounts, recentAccounts, recentCategories, unpaidFaturas = [], isOptimistic = false } = props;
  const isPaid = !!entry.paidAt;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const context = useExpenseContextOptional();
  const router = useRouter();
  const isMobile = useIsMobile();

  // Check if expense can be converted to fatura payment
  const canConvertToFatura = entry.accountType !== 'credit_card' && entry.totalInstallments === 1 && unpaidFaturas.length > 0;

  const isSynced = entry.accountSource === 'pluggy';

  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tSynced = useTranslations('synced');

  const [optimisticCategory, setOptimisticCategory] = useOptimistic(
    { id: entry.categoryId, color: entry.categoryColor, icon: entry.categoryIcon, name: entry.categoryName },
    (_, newCategory: Category) => ({
      id: newCategory.id,
      color: newCategory.color,
      icon: newCategory.icon,
      name: newCategory.name,
    })
  );

  const handleMarkPaid = async () => {
    if (context) {
      await context.togglePaid(entry.id, entry.paidAt);
    } else {
      await markEntryPaid(entry.id);
      router.refresh();
    }
  };

  const handleMarkPending = async () => {
    if (context) {
      await context.togglePaid(entry.id, entry.paidAt);
    } else {
      await markEntryPending(entry.id);
      router.refresh();
    }
  };

  const handleToggleIgnore = async () => {
    if (context) {
      await context.toggleIgnore(entry.transactionId);
    } else {
      // Fallback: call server action directly if no context
      const { toggleIgnoreTransaction } = await import('@/lib/actions/expenses');
      await toggleIgnoreTransaction(entry.transactionId);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    triggerHaptic(HapticPatterns.medium);

    // Store the transaction data for potential undo
    const transactionId = entry.transactionId;

    // Optimistically remove from UI
    if (context) {
      await context.removeExpense(transactionId);
    } else {
      await deleteExpense(transactionId);
      router.refresh();
    }

    // Show undo toast
    toast.success(t('expenseDeleted'), {
      duration: 5000,
    });
  };

  const handleCategoryChange = async (categoryId: number) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    setPickerOpen(false);
    startTransition(() => {
      setOptimisticCategory(category);
    });

    try {
      await updateTransactionCategory(entry.transactionId, categoryId);
    } catch {
      toast.error(tErrors('failedToUpdateCategory'));
    }
  };

  const longPressHandlers = useLongPress({
    onLongPress: props.selectionMode ? props.onLongPress : (props.onLongPress || (() => { })),
    onTap: props.selectionMode ? props.onToggleSelection : () => setDetailOpen(true),
    disabled: isOptimistic,
  });

  const stopCardGesture = (event: Event | React.SyntheticEvent) => {
    event.stopPropagation();
  };

  // Support Shift+Click to enter selection mode (keyboard accessible)
  const handleCardClick = (e: React.MouseEvent) => {
    if (!props.selectionMode && e.shiftKey && props.onLongPress) {
      e.preventDefault();
      props.onLongPress();
    }
  };

  const handleTogglePaid = async () => {
    if (isPaid) {
      await handleMarkPending();
    } else {
      await handleMarkPaid();
    }
  };

  return (
    <>
      <Card className={cn(
        "py-0 relative overflow-hidden",
        isOptimistic && "opacity-70 animate-pulse",
        entry.ignored && "opacity-50",
        props.selectionMode && "cursor-pointer",
        props.selectionMode && props.isSelected && "ring-2 ring-primary ring-offset-2"
      )}>
        <CardContent
          {...longPressHandlers}
          onClick={handleCardClick}
          className="flex items-stretch gap-4 p-3 relative bg-card select-none touch-pan-y"
        >
          <div className='flex flex-col'>
            {/* Category icon - clickable */}
            <div
              aria-label={props.selectionMode ? t('selected') : t('changeCategory')}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (props.selectionMode) {
                  props.onToggleSelection();
                } else {
                  setPickerOpen(true);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (props.selectionMode) {
                    props.onToggleSelection();
                  } else {
                    setPickerOpen(true);
                  }
                }
              }}
              className="relative w-12 h-full shrink-0 rounded-none flex items-center justify-center text-white cursor-pointer transition-all hover:ring-2 hover:ring-offset-2 hover:ring-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary touch-manipulation"
              style={{ backgroundColor: optimisticCategory.color }}
            >
              <span className='size-20 absolute z-10'></span>
              <CategoryIcon icon={optimisticCategory.icon} />
              {/* Checkbox indicator - only shown in selection mode */}
              {props.selectionMode && (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className={cn(
                    "size-12 rounded-none border-2 flex items-center justify-center transition-all",
                    props.isSelected
                      ? "bg-primary/85 border-green-600"
                      : "bg-gray-100/70 border-gray-500"
                  )}>
                    {props.isSelected && (
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="size-4 text-green-600"
                        strokeWidth={4}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {entry.totalInstallments > 1 && (
              <div className='flex w-12 bottom-3 justify-center absolute'>
                <Badge variant="secondary" className="w-full">
                  {entry.installmentNumber}/{entry.totalInstallments}
                </Badge>
              </div>
            )}
          </div>

          {/* Description + installment badge */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className={cn(
                "font-medium text-base leading-tight truncate",
                entry.isFullyRefunded && "line-through text-muted-foreground"
              )}>
                {entry.description}
              </h3>
              {entry.isFullyRefunded && (
                <Badge variant="secondary" className="shrink-0 text-green-600">
                  {t('refunded')}
                </Badge>
              )}
              {!entry.isFullyRefunded && (entry.refundedAmount ?? 0) > 0 && (
                <Badge variant="outline" className="shrink-0 text-xs">
                  {t('partialRefund')}
                </Badge>
              )}
            </div>
            <div className="flex flex-col text-xs text-gray-500 md:text-sm min-w-0">
              <span className="truncate">{optimisticCategory.name}</span>
              <span className="truncate">{entry.accountName}</span>
            </div>
          </div>

          {/* Amount + Icons column */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="text-sm md:text-base font-semibold">{formatCurrency(entry.amount)}</div>
            <div className="text-xs text-gray-500 md:hidden">
              {formatDate(entry.dueDate, { day: '2-digit', month: 'short' })}
            </div>
            <div className="hidden md:block text-sm text-gray-500">
              {formatDate(entry.dueDate)}
            </div>
            <div className="flex items-center w-full justify-end space-x-2">
              {/* Status icon */}
              <HugeiconsIcon
                icon={isPaid ? Tick02Icon : Clock01Icon}
                className={isPaid ? 'text-green-600' : 'text-gray-400'}
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
              {isSynced && (
                <span
                  className="flex items-center justify-center text-blue-600 opacity-80"
                  title={tSynced('readOnlyBadge')}
                  aria-label={tSynced('readOnlyBadge')}
                  role="img"
                >
                  <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={12} strokeWidth={2} />
                </span>
              )}
              {/* Account icon (bank logo or type icon) */}
              {entry.bankLogo ? (
                <div className="size-4 rounded-full flex items-center justify-center border border-gray-300 bg-white p-0.5" aria-hidden="true">
                  <BankLogo logo={entry.bankLogo} size={16} />
                </div>
              ) : (
                <div
                  className="size-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: accountTypeConfig[entry.accountType].color }}
                  aria-hidden="true"
                >
                  <HugeiconsIcon
                    icon={accountTypeConfig[entry.accountType].icon}
                    size={10}
                    className="text-white"
                    strokeWidth={2}
                  />
                </div>
              )}
            </div>
          </div>

          {!isMobile && (
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8 touch-manipulation"
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="Abrir menu de ações"
                  >
                    <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onPointerDown={stopCardGesture}>
                  <DropdownMenuItem
                    onClick={() => setDetailOpen(true)}
                    onSelect={stopCardGesture}
                    onPointerDown={stopCardGesture}
                  >
                    {t('viewDetails')}
                  </DropdownMenuItem>
                  {!isSynced && (
                    <DropdownMenuItem
                      onClick={() => setEditOpen(true)}
                      onSelect={stopCardGesture}
                      onPointerDown={stopCardGesture}
                    >
                      {tCommon('edit')}
                    </DropdownMenuItem>
                  )}
                  {isPaid ? (
                    <DropdownMenuItem
                      onClick={handleMarkPending}
                      onSelect={stopCardGesture}
                      onPointerDown={stopCardGesture}
                    >
                      {t('markAsPending')}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      onClick={handleMarkPaid}
                      onSelect={stopCardGesture}
                      onPointerDown={stopCardGesture}
                    >
                      {t('markAsPaid')}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleToggleIgnore} onSelect={stopCardGesture} onPointerDown={stopCardGesture}>
                    {entry.ignored ? t('showInTotals') : t('hideFromTotals')}
                  </DropdownMenuItem>
                  {canConvertToFatura && !isSynced && (
                    <DropdownMenuItem
                      onClick={() => setConvertDialogOpen(true)}
                      onSelect={stopCardGesture}
                      onPointerDown={stopCardGesture}
                    >
                      {t('convertToFaturaPayment')}
                    </DropdownMenuItem>
                  )}
                  {!isSynced && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteConfirm(true)}
                      onSelect={stopCardGesture}
                      onPointerDown={stopCardGesture}
                    >
                      {t('deleteTransaction')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

        </CardContent>
      </Card>

      <CategoryQuickPicker
        categories={categories}
        currentCategoryId={optimisticCategory.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleCategoryChange}
        isUpdating={isPending}
      />

      <TransactionDetailSheet
        expense={entry}
        accounts={accounts}
        categories={categories}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        unpaidFaturas={unpaidFaturas}
        canConvertToFatura={canConvertToFatura}
        onConvertToFatura={() => setConvertDialogOpen(true)}
        onTogglePaid={handleTogglePaid}
        onToggleIgnore={handleToggleIgnore}
        onRequestDelete={() => setShowDeleteConfirm(true)}
      />

      <EditTransactionDialog
        mode="expense"
        transactionId={entry.transactionId}
        accounts={accounts}
        recentAccounts={recentAccounts}
        categories={categories}
        recentCategories={recentCategories}
        open={editOpen}
        onOpenChange={setEditOpen}
      />


      {canConvertToFatura && (
        <ConvertToFaturaDialog
          entry={{
            id: entry.id,
            amount: entry.amount,
            description: entry.description,
            purchaseDate: entry.purchaseDate,
          }}
          unpaidFaturas={unpaidFaturas}
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          onSuccess={() => {
            if (context) {
              context.removeExpense(entry.transactionId);
            }
          }}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmationTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmation', { count: entry.totalInstallments, description: entry.description || entry.categoryName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tCommon('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
