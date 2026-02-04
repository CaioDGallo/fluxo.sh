'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  Edit01Icon,
  Tick02Icon,
  Forward01Icon,
  Link01Icon,
} from '@hugeicons/core-free-icons';
import { formatCentsAsBRL } from '@/lib/utils';
import { skipOccurrence } from '@/lib/actions/bill-occurrences';
import { PayBillDialog } from '@/components/pay-bill-dialog';
import { LinkTransactionDialog } from '@/components/link-transaction-dialog';
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

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  upcoming: { bg: 'bg-blue-100', text: 'text-blue-700' },
  pending: { bg: 'bg-amber-100', text: 'text-amber-700' },
  paid: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  overdue: { bg: 'bg-red-100', text: 'text-red-700' },
  skipped: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function BillDetailClient({ billData, categories, accounts }: BillDetailClientProps) {
  const t = useTranslations('bills');
  const tForm = useTranslations('billsForm');
  const router = useRouter();
  const [payDialogOccurrence, setPayDialogOccurrence] = useState<OccurrenceRow | null>(null);
  const [linkDialogOccurrence, setLinkDialogOccurrence] = useState<OccurrenceRow | null>(null);
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
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/bills">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{bill.name}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
            {categoryName && (
              <>
                <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: categoryColor ?? '#6b7280' }} />
                <span>{categoryName}</span>
                <span>·</span>
              </>
            )}
            <span>{tForm(bill.recurrenceType)}</span>
            <span>·</span>
            <span>{t('dueDayLabel', { day: bill.dueDay })}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditSheetOpen(true)}>
          <HugeiconsIcon icon={Edit01Icon} className="mr-1.5 size-3.5" />
          {t('edit')}
        </Button>
      </div>

      {/* Bill summary card */}
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            {bill.description && <p className="text-sm text-gray-600">{bill.description}</p>}
            <div className="flex gap-4 text-sm text-gray-500">
              <span>Status: <span className="font-medium text-gray-700">{t(`status.${bill.status}`)}</span></span>
            </div>
          </div>
          {bill.expectedAmount != null && (
            <div className="text-right">
              <div className="text-xs text-gray-400">{t('expectedAmount')}</div>
              <div className="text-lg font-bold text-gray-900">
                {bill.isVariableAmount ? '~' : ''}{formatCentsAsBRL(bill.expectedAmount)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Occurrences list */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 mb-3">{t('occurrences')}</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">{t('noOccurrences')}</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((occ) => {
              const { bg, text } = STATUS_COLORS[occ.status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
              const canPay = occ.status === 'upcoming' || occ.status === 'pending' || occ.status === 'overdue';
              const dueDate = new Date(occ.dueDate);

              return (
                <div key={occ.id} className="flex items-center justify-between rounded-lg border bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${bg} ${text}`}>
                      {t(`occurrence.${occ.status}`)}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-gray-800">
                        {dueDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                      {occ.matchedTransactionId && (
                        <div className="text-xs text-blue-600">{t('linkedTransaction')}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      {occ.status === 'paid' && occ.actualAmount != null ? (
                        <span className="text-sm font-semibold text-emerald-700">{formatCentsAsBRL(occ.actualAmount)}</span>
                      ) : occ.expectedAmount != null ? (
                        <span className="text-sm text-gray-600">{formatCentsAsBRL(occ.expectedAmount)}</span>
                      ) : null}
                    </div>
                    {canPay && (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setPayDialogOccurrence(occ)}
                        >
                          <HugeiconsIcon icon={Tick02Icon} className="size-3.5 mr-1" />
                          {t('pay')}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => setLinkDialogOccurrence(occ)}
                          title={t('linkTransaction')}
                        >
                          <HugeiconsIcon icon={Link01Icon} className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => handleSkip(occ.id)}
                          disabled={skipping === occ.id}
                          title={t('skip')}
                        >
                          <HugeiconsIcon icon={Forward01Icon} className="size-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pay Dialog */}
      {payDialogOccurrence && (
        <PayBillDialog
          occurrence={payDialogOccurrence}
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
