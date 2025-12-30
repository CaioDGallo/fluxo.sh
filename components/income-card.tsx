'use client';

import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { markIncomeReceived, markIncomePending, deleteIncome } from '@/lib/actions/income';
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

type IncomeCardProps = {
  income: {
    id: number;
    description: string;
    amount: number;
    receivedDate: string;
    receivedAt: string | null;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  };
};

export function IncomeCard({ income }: IncomeCardProps) {
  const isReceived = !!income.receivedAt;

  const handleMarkReceived = async () => {
    await markIncomeReceived(income.id);
  };

  const handleMarkPending = async () => {
    await markIncomePending(income.id);
  };

  const handleDelete = async () => {
    await deleteIncome(income.id);
  };

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Category icon */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: income.categoryColor }}
        >
          <CategoryIcon icon={income.categoryIcon} />
        </div>

        {/* Description + mobile date */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{income.description}</h3>
          {/* Mobile only: short date */}
          <div className="text-xs text-gray-500 md:hidden">
            {new Date(income.receivedDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
          </div>
        </div>

        {/* Desktop only: Category + Account */}
        <div className="hidden md:block text-sm text-gray-500 shrink-0">
          {income.categoryName} • {income.accountName}
        </div>

        {/* Desktop only: Full date */}
        <div className="hidden md:block text-sm text-gray-500 shrink-0">
          {new Date(income.receivedDate).toLocaleDateString('pt-BR')}
        </div>

        {/* Amount */}
        <div className="text-sm font-semibold text-green-600 shrink-0">
          +{formatCurrency(income.amount)}
        </div>

        {/* Status: icon always, text on desktop */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HugeiconsIcon
            icon={isReceived ? Tick02Icon : Clock01Icon}
            className={isReceived ? 'text-green-600' : 'text-gray-400'}
            size={18}
            strokeWidth={2}
          />
          <span className={`hidden md:inline text-sm ${isReceived ? 'text-green-600' : 'text-gray-500'}`}>
            {isReceived ? 'Received' : 'Pending'}
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
            {isReceived ? (
              <DropdownMenuItem onClick={handleMarkPending}>
                Mark as Pending
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleMarkReceived}>
                Mark as Received
              </DropdownMenuItem>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Delete Income
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete income?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete &quot;{income.description}&quot;. This action cannot be undone.
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
