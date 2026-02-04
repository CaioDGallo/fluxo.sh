'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createBill, updateBill, getBill } from '@/lib/actions/bills';
import type { Category, Account } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { getCurrentYearMonth } from '@/lib/utils';

const RECURRENCE_OPTIONS = ['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;
const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

type BillSheetProps = {
  billId?: number;
  categories: Category[];
  accounts: Account[];
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function BillSheet({
  billId,
  categories,
  accounts,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: BillSheetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const t = useTranslations('billsForm');
  const tCommon = useTranslations('common');
  const tBills = useTranslations('bills');

  // Form state (15 variables from bill-form-client.tsx lines 31-48)
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [expectedAmount, setExpectedAmount] = useState(0);
  const [hasAmount, setHasAmount] = useState(false);
  const [isVariableAmount, setIsVariableAmount] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<string>('monthly');
  const [dueDay, setDueDay] = useState<number>(1);
  const [dueTime, setDueTime] = useState('');
  const [startMonth, setStartMonth] = useState(getCurrentYearMonth());
  const [endMonth, setEndMonth] = useState('');
  const [preferredAccountId, setPreferredAccountId] = useState<string>('');
  const [notify2DaysBefore, setNotify2DaysBefore] = useState(true);
  const [notify1DayBefore, setNotify1DayBefore] = useState(true);
  const [notifyOnDueDay, setNotifyOnDueDay] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load existing bill in edit mode (triggers on every open when billId is set)
  useEffect(() => {
    if (billId == null || !open) return;

    setLoading(true);
    (async () => {
      const data = await getBill(billId);
      if (data) {
        setName(data.bill.name);
        setDescription(data.bill.description ?? '');
        setCategoryId(data.bill.categoryId?.toString() ?? '');
        if (data.bill.expectedAmount != null) {
          setHasAmount(true);
          setExpectedAmount(data.bill.expectedAmount);
        } else {
          setHasAmount(false);
          setExpectedAmount(0);
        }
        setIsVariableAmount(data.bill.isVariableAmount);
        setRecurrenceType(data.bill.recurrenceType);
        setDueDay(data.bill.dueDay);
        setDueTime(data.bill.dueTime ?? '');
        setStartMonth(data.bill.startMonth);
        setEndMonth(data.bill.endMonth ?? '');
        setPreferredAccountId(data.bill.preferredAccountId?.toString() ?? '');
        setNotify2DaysBefore(data.bill.notify2DaysBefore);
        setNotify1DayBefore(data.bill.notify1DayBefore);
        setNotifyOnDueDay(data.bill.notifyOnDueDay);
      }
      setLoading(false);
    })();
  }, [billId, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const payload = {
      name,
      description: description || null,
      categoryId: categoryId ? Number(categoryId) : null,
      expectedAmount: hasAmount ? expectedAmount : null,
      isVariableAmount,
      recurrenceType,
      dueDay,
      dueTime: dueTime || null,
      startMonth,
      endMonth: endMonth || null,
      preferredAccountId: preferredAccountId ? Number(preferredAccountId) : null,
      notify2DaysBefore,
      notify1DayBefore,
      notifyOnDueDay,
    };

    try {
      const result = billId != null
        ? await updateBill(billId, payload)
        : await createBill(payload);

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (billId != null) {
        // Close immediately for edit mode
        setOpen(false);
      } else {
        // Reset form for create mode
        setName('');
        setDescription('');
        setCategoryId('');
        setExpectedAmount(0);
        setHasAmount(false);
        setIsVariableAmount(false);
        setRecurrenceType('monthly');
        setDueDay(1);
        setDueTime('');
        setStartMonth(getCurrentYearMonth());
        setEndMonth('');
        setPreferredAccountId('');
        setNotify2DaysBefore(true);
        setNotify1DayBefore(true);
        setNotifyOnDueDay(true);
        setOpen(false);
      }

      onSuccess?.();
    } catch (err) {
      console.error('[BillSheet] submit failed:', err);
      setError(tCommon('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = billId != null ? tBills('title') : tBills('addBill');

  // Weekday names for weekly recurrence
  const dueDayOptions = recurrenceType === 'weekly'
    ? Array.from({ length: 7 }, (_, i) => i)
    : Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className="max-h-[80vh] p-0 flex flex-col"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches) {
            nameInputRef.current?.focus();
          }
        }}
      >
        <SheetHeader className="border-b border-border/60 bg-muted/70 dark:bg-muted/20 px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <SheetTitle className="text-start text-sm font-semibold text-balance">{title}</SheetTitle>
            <div className="flex items-center gap-2">
              <span
                className="size-4 rounded-full border border-green-700 bg-green-500 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
              <span
                className="size-4 rounded-full border border-amber-600 bg-amber-400 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
              <SheetClose asChild>
                <button
                  type="button"
                  className="group size-4 rounded-full border border-red-700 bg-red-500 text-[10px] font-bold text-red-950 shadow-[1px_1px_0px_rgba(0,0,0,0.6)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                  aria-label={tCommon('close')}
                >
                  <span className="relative block -mt-px text-white leading-none opacity-80 group-hover:opacity-100">
                    <span className='w-14 h-10 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2' />
                    x
                  </span>
                </button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="sr-only">
            {billId != null ? tCommon('edit') : tCommon('create')} {tBills('title')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex bg-muted/20 dark:bg-muted flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4 space-y-5">
            {loading ? (
              <div className="text-center py-12 text-gray-400">...</div>
            ) : (
              <FieldGroup>
                {/* Name */}
                <Field>
                  <FieldLabel htmlFor="bill-name">{t('name')} *</FieldLabel>
                  <Input
                    ref={nameInputRef}
                    id="bill-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('namePlaceholder')}
                    required
                    autoComplete="off"
                  />
                </Field>

                {/* Description */}
                <Field>
                  <FieldLabel htmlFor="bill-desc">{t('description')}</FieldLabel>
                  <Textarea
                    id="bill-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('descriptionPlaceholder')}
                    rows={2}
                  />
                </Field>

                {/* Category */}
                <Field>
                  <FieldLabel>{t('category')}</FieldLabel>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('noCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id.toString()}>
                          <div className="flex items-center gap-2">
                            <span
                              className="inline-block size-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Amount */}
                <Field>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has-amount"
                      checked={hasAmount}
                      onCheckedChange={(checked) => setHasAmount(!!checked)}
                    />
                    <FieldLabel htmlFor="has-amount" className="cursor-pointer">
                      {t('expectedAmount')}
                    </FieldLabel>
                  </div>
                  {hasAmount && (
                    <div className="ml-6 space-y-2 mt-2">
                      <CurrencyInput value={expectedAmount} onChange={setExpectedAmount} />
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="is-variable"
                          checked={isVariableAmount}
                          onCheckedChange={(checked) => setIsVariableAmount(!!checked)}
                        />
                        <label htmlFor="is-variable" className="cursor-pointer text-sm">
                          {t('isVariable')}
                        </label>
                      </div>
                    </div>
                  )}
                </Field>

                {/* Recurrence */}
                <Field>
                  <FieldLabel>{t('recurrence')} *</FieldLabel>
                  <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RECURRENCE_OPTIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Due Day */}
                <Field>
                  <FieldLabel>{t('dueDay')} *</FieldLabel>
                  <Select value={dueDay.toString()} onValueChange={(v) => setDueDay(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {dueDayOptions.map((d) => (
                        <SelectItem key={d} value={d.toString()}>
                          {recurrenceType === 'weekly'
                            ? t(`weekdays.${WEEKDAY_KEYS[d]}`)
                            : d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Due Time */}
                <Field>
                  <FieldLabel htmlFor="bill-time">{t('dueTime')}</FieldLabel>
                  <Input
                    id="bill-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </Field>

                {/* Start / End Month */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="bill-start">{t('startMonth')} *</FieldLabel>
                    <Input
                      id="bill-start"
                      type="month"
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="bill-end">{t('endMonth')}</FieldLabel>
                    <Input
                      id="bill-end"
                      type="month"
                      value={endMonth}
                      onChange={(e) => setEndMonth(e.target.value)}
                    />
                  </Field>
                </div>

                {/* Preferred Account */}
                <Field>
                  <FieldLabel>{t('preferredAccount')}</FieldLabel>
                  <Select value={preferredAccountId} onValueChange={setPreferredAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t('noPreferredAccount')} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acct) => (
                        <SelectItem key={acct.id} value={acct.id.toString()}>
                          {acct.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Notifications */}
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">{t('notifications')}</legend>
                  <div className="ml-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="n2"
                        checked={notify2DaysBefore}
                        onCheckedChange={(c) => setNotify2DaysBefore(!!c)}
                      />
                      <label htmlFor="n2" className="cursor-pointer text-sm">
                        {t('notify2DaysBefore')}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="n1"
                        checked={notify1DayBefore}
                        onCheckedChange={(c) => setNotify1DayBefore(!!c)}
                      />
                      <label htmlFor="n1" className="cursor-pointer text-sm">
                        {t('notify1DayBefore')}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="n0"
                        checked={notifyOnDueDay}
                        onCheckedChange={(c) => setNotifyOnDueDay(!!c)}
                      />
                      <label htmlFor="n0" className="cursor-pointer text-sm">
                        {t('notifyOnDueDay')}
                      </label>
                    </div>
                  </div>
                </fieldset>

                {/* Error */}
                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {error}
                  </div>
                )}
              </FieldGroup>
            )}
          </div>

          <SheetFooter className="border-t border-border/60 bg-muted/70 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button type="submit" disabled={isSubmitting || loading}>
              {isSubmitting ? tCommon('saving') : billId != null ? tCommon('update') : tCommon('create')}
            </Button>
            <SheetClose asChild>
              <Button type="button" variant="outline">
                {tCommon('cancel')}
              </Button>
            </SheetClose>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
