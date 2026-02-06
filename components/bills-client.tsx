'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BillSheet } from '@/components/bill-sheet';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  ArrowDown01Icon,
  MoreVerticalIcon,
} from '@hugeicons/core-free-icons';
import { formatCentsAsBRL } from '@/lib/utils';
import { archiveBill, deleteBill } from '@/lib/actions/bills';
import type { Category, Account } from '@/lib/schema';

type BillRow = {
  bill: {
    id: number;
    name: string;
    description: string | null;
    expectedAmount: number | null;
    isVariableAmount: boolean;
    status: 'active' | 'paused' | 'archived';
    recurrenceType: string;
    dueDay: number;
  };
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string | null;
};

interface BillsClientProps {
  bills: BillRow[];
  categories: Category[];
  accounts: Account[];
}

export function BillsClient({ bills, categories, accounts }: BillsClientProps) {
  const t = useTranslations('bills');
  const tForm = useTranslations('billsForm');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteBillId, setDeleteBillId] = useState<number | null>(null);

  const activeBills = bills.filter(b => b.bill.status !== 'archived');
  const archivedBills = bills.filter(b => b.bill.status === 'archived');

  const handleArchive = async (id: number) => {
    await archiveBill(id);
    router.refresh();
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    const result = await deleteBill(id);
    setDeleting(null);
    if (result.success) {
      router.refresh();
    }
  };

  return (
    <div className="space-y-6">
      {/* Add button */}
      <div className="flex sm:justify-end">
        <BillSheet
          categories={categories}
          accounts={accounts}
          onSuccess={() => router.refresh()}
          trigger={
            <Button variant="popout" className="w-full sm:w-auto">
              <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" aria-hidden />
              {t('addBill')}
            </Button>
          }
        />
      </div>

      {/* Active bills */}
      {activeBills.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-12">{t('noBillsYet')}</p>
      ) : (
        <div className="space-y-3">
          {activeBills.map(({ bill, categoryName, categoryColor, accountName }) => {
            const statusVariant = bill.status === 'active' ? 'secondary' : bill.status === 'paused' ? 'outline' : 'ghost';

            return (
              <Card key={bill.id} className="py-0 relative overflow-hidden group focus-within:ring-2 focus-within:ring-primary/30 focus-within:ring-inset">
                <Link
                  href={`/bills/${bill.id}`}
                  className="absolute inset-0 z-10 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
                  aria-label={t('openBill', { name: bill.name })}
                />

                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap justify-between">
                        <h3 className="font-semibold text-foreground line-clamp-2 sm:line-clamp-1">{bill.name}</h3>
                        <div className='flex flex-row items-center space-x-2'>
                          <span className="text-xs text-muted-foreground">{tForm(bill.recurrenceType)}</span>
                          <Badge variant={statusVariant}>
                            {t(`status.${bill.status}`)}
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        {categoryName && (
                          <span className="flex items-center gap-1">
                            <span
                              className="inline-block size-2.5 rounded-full"
                              style={{ backgroundColor: categoryColor ?? '#6b7280' }}
                              aria-hidden
                            />
                            {categoryName}
                          </span>
                        )}
                        {accountName && (
                          <span className="flex items-center gap-1 min-w-0">
                            <span aria-hidden>·</span>
                            <span className="truncate">{accountName}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start justify-between gap-3 sm:items-center sm:justify-end">
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        {bill.expectedAmount != null && (
                          <span className="font-semibold text-foreground tabular-nums">
                            {bill.isVariableAmount ? '~' : ''}{formatCentsAsBRL(bill.expectedAmount)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">{t('dueDayLabel', { day: bill.dueDay })}</span>
                      </div>

                      {/* Action menu (z-20 to be above link) */}
                      <div className="z-20 relative">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-9 sm:size-8" aria-label={t('actions')}>
                              <HugeiconsIcon icon={MoreVerticalIcon} size={16} aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleArchive(bill.id);
                            }}>
                              {t('archive')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setDeleteBillId(bill.id);
                            }}>
                              {t('delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Archived bills (collapsible) */}
      {archivedBills.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            {t('archivedBills')} ({archivedBills.length})
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 transition-transform [[data-state=open]_&]:rotate-180" aria-hidden />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {archivedBills.map(({ bill, categoryName, categoryColor }) => (
              <Card key={bill.id} className="py-0 opacity-60">
                <CardContent className="p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground line-clamp-2 sm:line-clamp-1">{bill.name}</span>
                      {categoryName && (
                        <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <span
                            className="inline-block size-2 rounded-full"
                            style={{ backgroundColor: categoryColor ?? '#6b7280' }}
                            aria-hidden
                          />
                          {categoryName}
                        </span>
                      )}
                    </div>
                    {bill.expectedAmount != null && (
                      <span className="text-sm text-muted-foreground tabular-nums">{formatCentsAsBRL(bill.expectedAmount)}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Delete confirmation dialog (outside map loop) */}
      <AlertDialog open={deleteBillId !== null} onOpenChange={(open) => !open && setDeleteBillId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBillTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteBillDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteBillId !== null) {
                  handleDelete(deleteBillId);
                  setDeleteBillId(null);
                }
              }}
              disabled={deleting === deleteBillId}
            >
              {deleting === deleteBillId ? tCommon('deleting') : t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
