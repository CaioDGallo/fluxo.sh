'use client';

import { useEffect, useRef, useState } from 'react';
import { createAccount, updateAccount } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { useTranslations } from 'next-intl';
import { BankLogoPicker } from '@/components/bank-logo-picker';
import { BankLogo } from '@/components/bank-logo';
import { BANK_LOGOS } from '@/lib/bank-logos';
import { HugeiconsIcon } from '@hugeicons/react';
import { BankIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

type AccountFormProps = {
  account?: Account;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function AccountForm({
  account,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: AccountFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<'credit_card' | 'checking' | 'savings' | 'cash'>(
    account?.type || 'checking'
  );
  const [initialBalanceCents, setInitialBalanceCents] = useState(0);
  const [closingDay, setClosingDay] = useState<number | null>(account?.closingDay ?? null);
  const [paymentDueDay, setPaymentDueDay] = useState<number | null>(account?.paymentDueDay ?? null);
  const [creditLimitCents, setCreditLimitCents] = useState(
    account?.creditLimit ?? 0
  );
  const [bankLogo, setBankLogo] = useState<string | null>(account?.bankLogo ?? null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('accountForm');
  const tCommon = useTranslations('common');
  const tAccounts = useTranslations('accounts');
  const tAccountTypes = useTranslations('accountTypes');

  useEffect(() => {
    if (!account) return;
    setName(account.name || '');
    setType(account.type);
    setClosingDay(account.closingDay ?? null);
    setPaymentDueDay(account.paymentDueDay ?? null);
    setCreditLimitCents(account.creditLimit ?? 0);
    setBankLogo(account.bankLogo ?? null);
  }, [account]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (type === 'credit_card' && creditLimitCents === 0) {
      toast.error(t('creditLimitRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name,
        type,
        bankLogo,
        ...(!account && { currentBalance: initialBalanceCents }),
        ...(type === 'credit_card' && {
          closingDay,
          paymentDueDay,
          creditLimit: creditLimitCents > 0 ? creditLimitCents : null,
        }),
      };

      const result = account
        ? await updateAccount(account.id, data)
        : await createAccount(data);

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      if (!account) {
        setName('');
        setType('checking');
        setInitialBalanceCents(0);
        setClosingDay(null);
        setPaymentDueDay(null);
        setCreditLimitCents(0);
        setBankLogo(null);
      }

      setOpen(false);
      onSuccess?.();
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = account
    ? `${tCommon('edit')} ${tAccounts('title')}`
    : tAccounts('addAccount');

  return (
    <>
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
                      <span className="w-14 h-10 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2" />
                      x
                    </span>
                  </button>
                </SheetClose>
              </div>
            </div>
            <SheetDescription className="sr-only">{title}</SheetDescription>
          </SheetHeader>

          <form onSubmit={handleSubmit} className="flex bg-muted/20 dark:bg-muted flex-1 flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
                  <Input
                    ref={nameInputRef}
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="NuBank CC"
                    autoComplete="off"
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="type">{t('type')}</FieldLabel>
                  <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="checking">{tAccountTypes('checking')}</SelectItem>
                        <SelectItem value="savings">{tAccountTypes('savings')}</SelectItem>
                        <SelectItem value="credit_card">{tAccountTypes('credit_card')}</SelectItem>
                        <SelectItem value="cash">{tAccountTypes('cash')}</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>

                <Field>
                  <FieldLabel htmlFor="bankLogo">{t('bankLogo')}</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setLogoPickerOpen(true)}
                    className="flex items-center gap-3 px-3 py-2 border rounded-md hover:bg-muted transition-colors text-left w-full"
                  >
                    {bankLogo ? (
                      <>
                        <div className="size-8 rounded-full flex items-center justify-center bg-white shrink-0 p-1">
                          <BankLogo logo={bankLogo} size={24} />
                        </div>
                        <span className="text-sm">
                          {BANK_LOGOS[bankLogo as keyof typeof BANK_LOGOS]?.name}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="size-8 rounded-full flex items-center justify-center bg-muted shrink-0">
                          <HugeiconsIcon
                            icon={BankIcon}
                            className="size-4 text-muted-foreground"
                            strokeWidth={2}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {t('selectBankLogo')}
                        </span>
                      </>
                    )}
                  </button>
                </Field>

                {!account && (
                  <Field>
                    <FieldLabel htmlFor="initialBalance">{t('initialBalance')}</FieldLabel>
                    <CurrencyInput
                      id="initialBalance"
                      value={initialBalanceCents}
                      onChange={setInitialBalanceCents}
                      required
                      placeholder={t('initialBalancePlaceholder')}
                    />
                  </Field>
                )}

                {type === 'credit_card' && (
                  <>
                    <Field>
                      <FieldLabel htmlFor="closingDay">{t('closingDay')}</FieldLabel>
                      <Select
                        value={closingDay?.toString() || ''}
                        onValueChange={(v) => setClosingDay(v ? Number(v) : null)}
                      >
                        <SelectTrigger id="closingDay">
                          <SelectValue placeholder={t('selectDay')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="paymentDueDay">{t('paymentDueDay')}</FieldLabel>
                      <Select
                        value={paymentDueDay?.toString() || ''}
                        onValueChange={(v) => setPaymentDueDay(v ? Number(v) : null)}
                      >
                        <SelectTrigger id="paymentDueDay">
                          <SelectValue placeholder={t('selectDay')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                              <SelectItem key={day} value={day.toString()}>
                                {day}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field>
                      <FieldLabel htmlFor="creditLimit">{t('creditLimit')}</FieldLabel>
                      <CurrencyInput
                        id="creditLimit"
                        value={creditLimitCents}
                        onChange={setCreditLimitCents}
                        required
                        placeholder={t('creditLimitPlaceholder')}
                      />
                    </Field>
                  </>
                )}
              </FieldGroup>
            </div>

            <SheetFooter className="border-t border-border/60 bg-muted/70 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('saving') : account ? t('update') : t('create')}
              </Button>
              <SheetClose asChild>
                <Button type="button" variant="outline">
                  {t('cancel')}
                </Button>
              </SheetClose>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <BankLogoPicker
        currentLogo={bankLogo}
        open={logoPickerOpen}
        onOpenChange={setLogoPickerOpen}
        onSelect={(logo) => {
          setBankLogo(logo);
          setLogoPickerOpen(false);
        }}
      />
    </>
  );
}
