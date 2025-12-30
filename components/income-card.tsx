'use client';

import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
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
import { MoreVerticalIcon } from '@hugeicons/core-free-icons';

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
    <Card className="relative">
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-4">
          {/* Category icon */}
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: income.categoryColor }}
          >
            <CategoryIcon icon={income.categoryIcon} />
          </div>

          {/* Details */}
          <div>
            <h3 className="font-medium">{income.description}</h3>
            <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
              <span>{income.categoryName}</span>
              <span>•</span>
              <span>{income.accountName}</span>
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-lg font-semibold text-green-600">
              +{formatCurrency(income.amount)}
            </div>
            <div className="text-sm text-gray-500">
              {new Date(income.receivedDate).toLocaleDateString('pt-BR')}
            </div>
            <div className="mt-1">
              <Badge
                variant={isReceived ? 'default' : 'outline'}
                className={isReceived ? 'bg-green-100 text-green-800' : ''}
              >
                {isReceived ? 'Received' : 'Pending'}
              </Badge>
            </div>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
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
        </div>
      </CardContent>
    </Card>
  );
}
