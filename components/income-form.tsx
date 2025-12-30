'use client';

import { useState } from 'react';
import { createIncome, updateIncome } from '@/lib/actions/income';
import { displayToCents, centsToDisplay } from '@/lib/utils';
import type { Account, Category, Income } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { CategoryIcon } from '@/components/icon-picker';
import { cn } from '@/lib/utils';

type IncomeFormProps = {
  accounts: Account[];
  categories: Category[];
  income?: Income;
  trigger: React.ReactNode;
  onSuccess?: () => void;
};

export function IncomeForm({ accounts, categories, income, trigger, onSuccess }: IncomeFormProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    income ? centsToDisplay(income.amount) : ''
  );
  const [description, setDescription] = useState(income?.description || '');
  const [categoryId, setCategoryId] = useState<number>(
    income?.categoryId || categories[0]?.id || 0
  );
  const [accountId, setAccountId] = useState<number>(
    income?.accountId || accounts[0]?.id || 0
  );
  const [receivedDate, setReceivedDate] = useState(
    income?.receivedDate || new Date().toISOString().split('T')[0]
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalCents = amount ? displayToCents(amount) : 0;
  const hasCategories = categories.length > 0;
  const hasAccounts = accounts.length > 0;
  const canSubmit = hasCategories && hasAccounts && !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = {
        description,
        amount: totalCents,
        categoryId,
        accountId,
        receivedDate,
      };

      if (income) {
        await updateIncome(income.id, data);
      } else {
        await createIncome(data);
      }

      setOpen(false);
      onSuccess?.();

      // Reset form if creating new
      if (!income) {
        setAmount('');
        setDescription('');
        setCategoryId(categories[0]?.id || 0);
        setAccountId(accounts[0]?.id || 0);
        setReceivedDate(new Date().toISOString().split('T')[0]);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {income ? 'Edit Income' : 'Add Income'}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {/* Amount */}
            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>R$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  type="number"
                  id="amount"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                />
              </InputGroup>
            </Field>

            {/* Description */}
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Monthly salary"
              />
            </Field>

            {/* Category */}
            <Field>
              <FieldLabel>Category</FieldLabel>
              {hasCategories ? (
                <div className="grid grid-cols-4 gap-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-md border p-2 transition hover:bg-neutral-50',
                        categoryId === category.id && 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                      )}
                    >
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full"
                        style={{ backgroundColor: category.color }}
                      >
                        <div className="text-white">
                          <CategoryIcon icon={category.icon} />
                        </div>
                      </div>
                      <span className="text-xs font-medium text-center line-clamp-1">
                        {category.name}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  No income categories available. Please create one in Settings first.
                </div>
              )}
            </Field>

            {/* Account */}
            <Field>
              <FieldLabel htmlFor="account">Account</FieldLabel>
              {hasAccounts ? (
                <Select
                  value={accountId.toString()}
                  onValueChange={(value) => setAccountId(parseInt(value))}
                >
                  <SelectTrigger id="account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              ) : (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  No accounts available. Please create one in Settings first.
                </div>
              )}
            </Field>

            {/* Received Date */}
            <Field>
              <FieldLabel htmlFor="receivedDate">Received Date</FieldLabel>
              <Input
                type="date"
                id="receivedDate"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                required
              />
            </Field>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? 'Saving...' : income ? 'Update' : 'Create'}
              </Button>
            </AlertDialogFooter>
          </FieldGroup>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
