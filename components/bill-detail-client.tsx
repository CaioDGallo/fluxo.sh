'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Edit01Icon,
  Tick02Icon,
  Forward01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons';
import { formatCentsAsBRL, formatDate } from '@/lib/utils';
import { skipOccurrence } from '@/lib/actions/bill-occurrences';
import { PayBillDialog } from '@/components/pay-bill-dialog';
import { LinkTransactionDialog } from '@/components/link-transaction-dialog';
import { EditOccurrenceSheet } from '@/components/edit-occurrence-sheet';
import { BillSheet } from '@/components/bill-sheet';
import type { Account, Category } from '@/lib/schema';

type OccurrenceRow = {
  id: number;
  billId: number;
  dueDate: Date | string;
  expectedAmount: number | null;
  actualAmount: number | null;
  status: 'upcoming' | 'pending' | 'paid' | 'overdue' | 'skipped';
  paidAt: Date | string | null;
  paidFromAccountId: number | null;
  matchedTransactionId: number | null;
  matchedEntryId: number | null;
  notes: string | null;
  yearMonth: string;
};

type BillDataRow = {
  bill: {
    id: number;
    name: string;
    description: string | null;
    expectedAmount: number | null;
    isVariableAmount: boolean;
    status: 'active' | 'paused' | 'archived';
    recurrenceType: string;
    dueDay: number;
    categoryId: number | null;
  };
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  accountName: string | null;
  occurrences: OccurrenceRow[];
};

interface BillDetailClientProps {
  billData: BillDataRow;
  categories: Category[];
  accounts: Account[];
}

export function BillDetailClient({ billData, categories, accounts }: BillDetailClientProps) {
  const t = useTranslations('bills');
  const tForm = useTranslations('billsForm');
  const router = useRouter();
  const [payDialogOccurrence, setPayDialogOccurrence] = useState<OccurrenceRow | null>(null);
  const [linkDialogOccurrence, setLinkDialogOccurrence] = useState<OccurrenceRow | null>(null);
  const [editOccurrence, setEditOccurrence] = useState<OccurrenceRow | null>(null);
  const [skipping, setSkipping] = useState<number | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);

  const { bill, categoryName, categoryColor, occurrences } = billData;

  const handleSkip = async (id: number) => {
    setSkipping(id);
    await skipOccurrence(id);
    setSkipping(null);
    router.refresh();
  };

  // Sort: overdue first, then pending, then upcoming, then paid/skipped
  const sortOrder = { overdue: 0, pending: 1, upcoming: 2, paid: 3, skipped: 4 };
  const sorted = [...occurrences].sort((a, b) => {
    const statusDiff = (sortOrder[a.status] ?? 5) - (sortOrder[b.status] ?? 5);
    if (statusDiff !== 0) return statusDiff;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 sm:size-8"
            asChild
            aria-label={t('backToBills')}
          >
            <Link href="/bills" className="touch-manipulation">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" aria-hidden />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground text-balance break-words">{bill.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              {categoryName && (
                <>
                  <span className="flex items-center gap-1 min-w-0">
                    <span
                      className="inline-block size-2.5 rounded-full"
                      style={{ backgroundColor: categoryColor ?? '#6b7280' }}
                      aria-hidden
                    />
                    <span className="truncate">{categoryName}</span>
                  </span>
                  <span aria-hidden>·</span>
                </>
              )}
              <span>{tForm(bill.recurrenceType)}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{t('dueDayLabel', { day: bill.dueDay })}</span>
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-9 px-3 sm:w-auto sm:h-7 sm:px-2.5"
          onClick={() => setEditSheetOpen(true)}
        >
          <HugeiconsIcon icon={Edit01Icon} className="mr-1.5 size-3.5" aria-hidden />
          {t('edit')}
        </Button>
      </div>

      {/* Bill summary card */}
      <Card className="py-0">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              {bill.description && (
                <p className="text-sm text-muted-foreground break-words text-pretty">{bill.description}</p>
              )}
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                <span>
                  {t('statusLabel')}: <span className="font-medium text-foreground">{t(`status.${bill.status}`)}</span>
                </span>
              </div>
            </div>
            {bill.expectedAmount != null && (
              <div className="text-left sm:text-right">
                <div className="text-xs text-muted-foreground">{t('expectedAmount')}</div>
                <div className="text-lg font-bold text-foreground tabular-nums">
                  {bill.isVariableAmount ? '~' : ''}{formatCentsAsBRL(bill.expectedAmount)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Occurrences list */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 text-balance">{t('occurrences')}</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('noOccurrences')}</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((occ) => {
              const canPay = occ.status === 'upcoming' || occ.status === 'pending' || occ.status === 'overdue';
              const dueDate = new Date(occ.dueDate);

              // Map status to Badge variant
              let statusVariant: 'secondary' | 'outline' | 'default' | 'destructive' | 'ghost' = 'secondary';
              let statusClassName = '';

              if (occ.status === 'upcoming') {
                statusVariant = 'secondary';
              } else if (occ.status === 'pending') {
                statusVariant = 'outline';
              } else if (occ.status === 'paid') {
                statusVariant = 'default';
                statusClassName = 'bg-green-600 text-white';
              } else if (occ.status === 'overdue') {
                statusVariant = 'destructive';
              } else if (occ.status === 'skipped') {
                statusVariant = 'ghost';
              }

              return (
                <Card key={occ.id} className="py-0">
                  <CardContent className="p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={statusVariant} className={statusClassName ? `${statusClassName} shrink-0` : 'shrink-0'}>
                          {t(`occurrence.${occ.status}`)}
                        </Badge>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground tabular-nums">
                            {formatDate(String(dueDate.toISOString().split('T')[0]))}
                          </div>
                          {occ.matchedTransactionId && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">{t('linkedTransaction')}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                        <div className="text-left sm:text-right tabular-nums">
                          {occ.status === 'paid' && occ.actualAmount != null ? (
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400">{formatCentsAsBRL(occ.actualAmount)}</span>
                          ) : occ.expectedAmount != null ? (
                            <span className="text-sm text-muted-foreground">{formatCentsAsBRL(occ.expectedAmount)}</span>
                          ) : null}
                        </div>
                        {canPay && (
                          <div className="flex flex-wrap gap-2 sm:gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 px-3 sm:h-7 sm:px-2.5"
                              onClick={() => setPayDialogOccurrence(occ)}
                            >
                              <HugeiconsIcon icon={Tick02Icon} className="size-3.5 mr-1" aria-hidden />
                              {t('pay')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 sm:size-7"
                              onClick={() => setEditOccurrence(occ)}
                              aria-label={t('editOccurrence')}
                            >
                              <HugeiconsIcon icon={Edit01Icon} className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 sm:size-7"
                              onClick={() => setLinkDialogOccurrence(occ)}
                              aria-label={t('linkTransaction')}
                            >
                              <HugeiconsIcon icon={Link01Icon} className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 sm:size-7"
                              onClick={() => handleSkip(occ.id)}
                              disabled={skipping === occ.id}
                              aria-label={t('skip')}
                            >
                              <HugeiconsIcon icon={Forward01Icon} className="size-3.5" aria-hidden />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Pay Dialog */}
      {payDialogOccurrence && (
        <PayBillDialog
          occurrence={payDialogOccurrence}
          bill={{ name: bill.name, categoryId: bill.categoryId }}
          accounts={accounts}
          open={true}
          onClose={() => setPayDialogOccurrence(null)}
          onPaid={() => {
            setPayDialogOccurrence(null);
            router.refresh();
          }}
        />
      )}

      {/* Link Transaction Dialog */}
      {linkDialogOccurrence && (
        <LinkTransactionDialog
          occurrence={linkDialogOccurrence}
          open={true}
          onClose={() => setLinkDialogOccurrence(null)}
          onLinked={() => {
            setLinkDialogOccurrence(null);
            router.refresh();
          }}
        />
      )}

      {/* Edit Occurrence Sheet */}
      {editOccurrence && (
        <EditOccurrenceSheet
          occurrence={editOccurrence}
          open={true}
          onClose={() => setEditOccurrence(null)}
          onSaved={() => {
            setEditOccurrence(null);
            router.refresh();
          }}
        />
      )}

      {/* Edit Bill Sheet */}
      <BillSheet
        billId={bill.id}
        categories={categories}
        accounts={accounts}
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        onSuccess={() => {
          setEditSheetOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
