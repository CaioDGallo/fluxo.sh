'use client';

import { useState } from 'react';
import { createAccount, updateAccount } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';

type AccountFormProps = {
  account?: Account;
};

export function AccountForm({ account }: AccountFormProps) {
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<'credit_card' | 'checking' | 'savings' | 'cash'>(
    account?.type || 'checking'
  );
  const [closingDay, setClosingDay] = useState<number | null>(account?.closingDay ?? null);
  const [paymentDueDay, setPaymentDueDay] = useState<number | null>(account?.paymentDueDay ?? null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = {
        name,
        type,
        ...(type === 'credit_card' && { closingDay, paymentDueDay }),
      };

      if (account) {
        await updateAccount(account.id, data);
      } else {
        await createAccount(data);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="NuBank CC"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="type">Type</FieldLabel>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {type === 'credit_card' && (
          <>
            <Field>
              <FieldLabel htmlFor="closingDay">Closing Day (1-28)</FieldLabel>
              <Select
                value={closingDay?.toString() || ''}
                onValueChange={(v) => setClosingDay(v ? Number(v) : null)}
              >
                <SelectTrigger id="closingDay">
                  <SelectValue placeholder="Select day" />
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
              <FieldLabel htmlFor="paymentDueDay">Payment Due Day (1-28)</FieldLabel>
              <Select
                value={paymentDueDay?.toString() || ''}
                onValueChange={(v) => setPaymentDueDay(v ? Number(v) : null)}
              >
                <SelectTrigger id="paymentDueDay">
                  <SelectValue placeholder="Select day" />
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
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : account ? 'Update' : 'Create'}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}
