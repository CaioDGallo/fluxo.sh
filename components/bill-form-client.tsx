'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import { createBill, updateBill, getBill } from '@/lib/actions/bills';
import { getCurrentYearMonth } from '@/lib/utils';
import type { Category, Account } from '@/lib/schema';

interface BillFormClientProps {
  categories: Category[];
  accounts: Account[];
  billId: number | null; // null = create mode
}

const RECURRENCE_OPTIONS = ['once', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'] as const;

export function BillFormClient({ categories, accounts, billId }: BillFormClientProps) {
  const t = useTranslations('contasForm');
  const tCommon = useTranslations('common');
  const router = useRouter();

  // Form state
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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(billId != null);

  // Load existing bill in edit mode
  useEffect(() => {
    if (billId == null) return;
    (async () => {
      const data = await getBill(billId);
      if (data) {
        setName(data.bill.name);
        setDescription(data.bill.description ?? '');
        setCategoryId(data.bill.categoryId?.toString() ?? '');
        if (data.bill.expectedAmount != null) {
          setHasAmount(true);
          setExpectedAmount(data.bill.expectedAmount);
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
  }, [billId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
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

      if (result.success) {
        router.push('/contas');
      } else {
        setError(result.error);
      }
    } catch {
      setError(tCommon('unexpectedError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">...</div>;
  }

  const dueDayOptions = recurrenceType === 'weekly'
    ? Array.from({ length: 7 }, (_, i) => i)
    : Array.from({ length: 31 }, (_, i) => i + 1);

  const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="bill-name">{t('name')} *</Label>
        <Input
          id="bill-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('namePlaceholder')}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="bill-desc">{t('description')}</Label>
        <Textarea
          id="bill-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('descriptionPlaceholder')}
          rows={2}
        />
      </div>

      {/* Category */}
      <div className="space-y-1.5">
        <Label>{t('category')}</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger>
            <SelectValue placeholder={t('noCategory')} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                <span className="inline-block size-3 rounded-full mr-2" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has-amount"
            checked={hasAmount}
            onCheckedChange={(checked) => setHasAmount(!!checked)}
          />
          <Label htmlFor="has-amount" className="cursor-pointer">{t('expectedAmount')}</Label>
        </div>
        {hasAmount && (
          <div className="ml-6 space-y-2">
            <CurrencyInput value={expectedAmount} onChange={setExpectedAmount} />
            <div className="flex items-center gap-2">
              <Checkbox
                id="is-variable"
                checked={isVariableAmount}
                onCheckedChange={(checked) => setIsVariableAmount(!!checked)}
              />
              <Label htmlFor="is-variable" className="cursor-pointer text-sm">{t('isVariable')}</Label>
            </div>
          </div>
        )}
      </div>

      {/* Recurrence */}
      <div className="space-y-1.5">
        <Label>{t('recurrence')} *</Label>
        <Select value={recurrenceType} onValueChange={setRecurrenceType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECURRENCE_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>{t(r)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Due Day */}
      <div className="space-y-1.5">
        <Label>{t('dueDay')} *</Label>
        <Select value={dueDay.toString()} onValueChange={(v) => setDueDay(Number(v))}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dueDayOptions.map((d) => (
              <SelectItem key={d} value={d.toString()}>
                {recurrenceType === 'weekly' ? weekdayNames[d] : d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Due Time (optional) */}
      <div className="space-y-1.5">
        <Label htmlFor="bill-time">{t('dueTime')}</Label>
        <Input
          id="bill-time"
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
        />
      </div>

      {/* Start / End Month */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="bill-start">{t('startMonth')} *</Label>
          <Input
            id="bill-start"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bill-end">{t('endMonth')}</Label>
          <Input
            id="bill-end"
            type="month"
            value={endMonth}
            onChange={(e) => setEndMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Preferred Account */}
      <div className="space-y-1.5">
        <Label>{t('preferredAccount')}</Label>
        <Select value={preferredAccountId} onValueChange={setPreferredAccountId}>
          <SelectTrigger>
            <SelectValue placeholder={t('noPreferredAccount')} />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((acct) => (
              <SelectItem key={acct.id} value={acct.id.toString()}>{acct.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notifications */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-gray-700">{t('notifications')}</legend>
        <div className="ml-1 space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="n2" checked={notify2DaysBefore} onCheckedChange={(c) => setNotify2DaysBefore(!!c)} />
            <Label htmlFor="n2" className="cursor-pointer text-sm">{t('notify2DaysBefore')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="n1" checked={notify1DayBefore} onCheckedChange={(c) => setNotify1DayBefore(!!c)} />
            <Label htmlFor="n1" className="cursor-pointer text-sm">{t('notify1DayBefore')}</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="n0" checked={notifyOnDueDay} onCheckedChange={(c) => setNotifyOnDueDay(!!c)} />
            <Label htmlFor="n0" className="cursor-pointer text-sm">{t('notifyOnDueDay')}</Label>
          </div>
        </div>
      </fieldset>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving}>
          {saving ? tCommon('saving') : billId != null ? tCommon('update') : tCommon('create')}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/contas')}>
          {tCommon('cancel')}
        </Button>
      </div>
    </form>
  );
}
