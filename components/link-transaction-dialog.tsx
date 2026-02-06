'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { formatCentsAsBRL } from '@/lib/utils';
import { getSuggestedTransactions, linkOccurrenceToTransaction } from '@/lib/actions/bill-occurrences';

interface SuggestedEntry {
  entry: {
    id: number;
    amount: number;
    purchaseDate: Date | string;
    transactionId: number;
  };
  description: string | null;
  categoryId: number;
}

interface LinkTransactionDialogProps {
  occurrence: { id: number; expectedAmount: number | null };
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
}

export function LinkTransactionDialog({ occurrence, open, onClose, onLinked }: LinkTransactionDialogProps) {
  const t = useTranslations('linkTransactionDialog');
  const [suggestions, setSuggestions] = useState<SuggestedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const results = await getSuggestedTransactions(occurrence.id);
        if (!cancelled) setSuggestions(results as SuggestedEntry[]);
      } catch {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [open, occurrence.id]);

  const handleLink = async (entryId: number) => {
    setLinking(entryId);
    const result = await linkOccurrenceToTransaction(occurrence.id, entryId);
    setLinking(null);
    if (result.success) {
      onLinked();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[65vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription>{t('description')}</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">...</div>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t('noSuggestions')}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('suggested')}</p>
              {suggestions.map((item) => (
                <div key={item.entry.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.description ?? 'Sem descrição'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.entry.purchaseDate).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-sm font-semibold text-foreground">{formatCentsAsBRL(item.entry.amount)}</span>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-3"
                      onClick={() => handleLink(item.entry.id)}
                      disabled={linking === item.entry.id}
                    >
                      {linking === item.entry.id ? '...' : t('select')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4">
          <Button variant="outline" onClick={onClose} className="w-full">{t('cancel')}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
