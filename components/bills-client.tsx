'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  ArrowDown01Icon,
  Archive01Icon,
  Delete02Icon,
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

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  archived: 'bg-gray-100 text-gray-600',
};

const RECURRENCE_LABELS: Record<string, string> = {
  once: 'Única',
  weekly: 'Semanal',
  biweekly: '2 sem.',
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  yearly: 'Anual',
};

export function BillsClient({ bills }: BillsClientProps) {
  const t = useTranslations('contas');
  const router = useRouter();
  const [deleting, setDeleting] = useState<number | null>(null);

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
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/contas/novo">
            <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
            {t('addBill')}
          </Link>
        </Button>
      </div>

      {/* Active bills */}
      {activeBills.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-12">{t('noBillsYet')}</p>
      ) : (
        <div className="space-y-3">
          {activeBills.map(({ bill, categoryName, categoryColor, accountName }) => (
            <div
              key={bill.id}
              className="group relative rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <Link href={`/contas/${bill.id}`} className="absolute inset-0 z-10" />

              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-gray-900 truncate">{bill.name}</h3>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[bill.status]}`}>
                      {t(`status.${bill.status}`)}
                    </span>
                    <span className="text-xs text-gray-400">{RECURRENCE_LABELS[bill.recurrenceType]}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                    {categoryName && (
                      <span className="flex items-center gap-1">
                        <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: categoryColor ?? '#6b7280' }} />
                        {categoryName}
                      </span>
                    )}
                    {accountName && <span>· {accountName}</span>}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  {bill.expectedAmount != null && (
                    <span className="font-semibold text-gray-900">
                      {bill.isVariableAmount ? '~' : ''}{formatCentsAsBRL(bill.expectedAmount)}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">Dia {bill.dueDay}</span>
                </div>
              </div>

              {/* Action buttons (visible on hover, z-20 to be above link) */}
              <div className="absolute right-3 top-3 z-20 hidden group-hover:flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleArchive(bill.id)}
                  title={t('archive')}
                >
                  <HugeiconsIcon icon={Archive01Icon} className="size-3.5 text-gray-400" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('delete')}>
                      <HugeiconsIcon icon={Delete02Icon} className="size-3.5 text-gray-400 hover:text-red-500" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('deleteBillTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('deleteBillDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel />
                      <AlertDialogAction
                        variant="destructive"
                        onClick={() => handleDelete(bill.id)}
                        disabled={deleting === bill.id}
                      >
                        {deleting === bill.id ? '...' : t('delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived bills (collapsible) */}
      {archivedBills.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700">
            {t('archivedBills')} ({archivedBills.length})
            <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2">
            {archivedBills.map(({ bill, categoryName, categoryColor }) => (
              <div key={bill.id} className="rounded-lg border bg-gray-50 p-3 opacity-60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-700">{bill.name}</span>
                    {categoryName && (
                      <span className="ml-2 text-xs text-gray-400">
                        <span className="inline-block size-2 rounded-full mr-1" style={{ backgroundColor: categoryColor ?? '#6b7280' }} />
                        {categoryName}
                      </span>
                    )}
                  </div>
                  {bill.expectedAmount != null && (
                    <span className="text-sm text-gray-500">{formatCentsAsBRL(bill.expectedAmount)}</span>
                  )}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
