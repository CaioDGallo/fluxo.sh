'use client';

import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { markEntryPaid, markEntryPending, deleteExpense } from '@/lib/actions/expenses';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon, Tick02Icon, Clock01Icon } from '@hugeicons/core-free-icons';

type ExpenseCardProps = {
  entry: {
    id: number;
    amount: number;
    dueDate: string;
    paidAt: string | null;
    installmentNumber: number;
    transactionId: number;
    description: string;
    totalInstallments: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  };
};

export function ExpenseCard({ entry }: ExpenseCardProps) {
  const isPaid = !!entry.paidAt;

  const handleMarkPaid = async () => {
    await markEntryPaid(entry.id);
  };

  const handleMarkPending = async () => {
    await markEntryPending(entry.id);
  };

  const handleDelete = async () => {
    await deleteExpense(entry.transactionId);
  };

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Category icon */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: entry.categoryColor }}
        >
          <CategoryIcon icon={entry.categoryIcon} />
        </div>

        {/* Description + installment badge + mobile date */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm truncate">{entry.description}</h3>
            {entry.totalInstallments > 1 && (
              <Badge variant="secondary" className="shrink-0">
                {entry.installmentNumber}/{entry.totalInstallments}
              </Badge>
            )}
          </div>
          {/* Mobile only: short date */}
          <div className="text-xs text-gray-500 md:hidden">
            {new Date(entry.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
        </div>

        {/* Desktop only: Category + Account */}
        <div className="hidden md:block text-sm text-gray-500 shrink-0">
          {entry.categoryName} • {entry.accountName}
        </div>

        {/* Desktop only: Full date */}
        <div className="hidden md:block text-sm text-gray-500 shrink-0">
          {new Date(entry.dueDate).toLocaleDateString('pt-BR')}
        </div>

        {/* Amount */}
        <div className="text-sm font-semibold shrink-0">
          {formatCurrency(entry.amount)}
        </div>

        {/* Status: icon always, text on desktop */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HugeiconsIcon
            icon={isPaid ? Tick02Icon : Clock01Icon}
            className={isPaid ? 'text-green-600' : 'text-gray-400'}
            size={18}
            strokeWidth={2}
          />
          <span className={`hidden md:inline text-sm ${isPaid ? 'text-green-600' : 'text-gray-500'}`}>
            {isPaid ? 'Paid' : 'Pending'}
          </span>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isPaid ? (
              <DropdownMenuItem onClick={handleMarkPending}>
                Mark as Pending
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleMarkPaid}>
                Mark as Paid
              </DropdownMenuItem>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Delete Transaction
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete all {entry.totalInstallments} installment
                    {entry.totalInstallments > 1 ? 's' : ''} for &quot;{entry.description}&quot;.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
