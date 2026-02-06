'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Textarea } from '@/components/ui/textarea';
import {
  updateOccurrence,
  updateFutureOccurrences,
  updateAllUnpaidOccurrences,
} from '@/lib/actions/bill-occurrences';

type EditScope = 'this' | 'future' | 'allUnpaid';

interface EditOccurrenceSheetProps {
  occurrence: {
    id: number;
    billId: number;
    expectedAmount: number | null;
    notes: string | null;
  };
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function EditOccurrenceSheet({ occurrence, open, onClose, onSaved }: EditOccurrenceSheetProps) {
  const t = useTranslations('editOccurrenceSheet');
  const tCommon = useTranslations('common');
  const [scope, setScope] = useState<EditScope>('this');
  const [amount, setAmount] = useState(occurrence.expectedAmount ?? 0);
  const [notes, setNotes] = useState(occurrence.notes ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    let result;

    if (scope === 'this') {
      result = await updateOccurrence(occurrence.id, {
        expectedAmount: amount,
        notes,
      });
    } else if (scope === 'future') {
      result = await updateFutureOccurrences(occurrence.id, {
        expectedAmount: amount,
      });
    } else {
      result = await updateAllUnpaidOccurrences(occurrence.billId, {
        expectedAmount: amount,
      });
    }

    setSaving(false);
    if (result.success) {
      onSaved();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[70vh] sm:max-h-[60vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-balance">{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 space-y-4 p-4 overflow-y-auto">
          <div className="space-y-2">
            <Label>{t('scopeLabel')}</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as EditScope)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this">{t('scopeThis')}</SelectItem>
                <SelectItem value="future">{t('scopeFuture')}</SelectItem>
                <SelectItem value="allUnpaid">{t('scopeAllUnpaid')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-occ-amount">{t('amount')}</Label>
            <CurrencyInput
              id="edit-occ-amount"
              value={amount}
              onChange={setAmount}
              name="amount"
              autoComplete="off"
            />
          </div>

          {scope === 'this' && (
            <div className="space-y-1.5">
              <Label htmlFor="edit-occ-notes">{t('notes')}</Label>
              <Textarea
                id="edit-occ-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:flex-row sm:items-center">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:flex-1 h-10 sm:h-8"
          >
            {saving ? tCommon('saving') : tCommon('save')}
          </Button>
          <Button variant="outline" onClick={onClose} className="w-full sm:flex-1 h-10 sm:h-8">
            {tCommon('cancel')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
