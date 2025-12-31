'use client';

import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { payFatura } from '@/lib/actions/faturas';
import { toast } from 'sonner';
import type { Account } from '@/lib/schema';

type PayFaturaDialogProps = {
  faturaId: number;
  totalAmount: number;
  accountName: string;
  checkingAccounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PayFaturaDialog({
  faturaId,
  totalAmount,
  accountName,
  checkingAccounts,
  open,
  onOpenChange,
}: PayFaturaDialogProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isPending, startTransition] = useTransition();

  const handlePay = async () => {
    if (!selectedAccountId) {
      toast.error('Selecione uma conta para pagamento');
      return;
    }

    startTransition(async () => {
      try {
        await payFatura(faturaId, parseInt(selectedAccountId));
        toast.success('Fatura paga com sucesso!');
        onOpenChange(false);
        setSelectedAccountId('');
      } catch (error) {
        toast.error('Erro ao pagar fatura');
        console.error(error);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent closeOnBackdropClick>
        <AlertDialogHeader>
          <AlertDialogTitle>Pagar Fatura</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Cartão: {accountName}</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(totalAmount)}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              Pagar com conta:
            </label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta" />
              </SelectTrigger>
              <SelectContent>
                {checkingAccounts.map((account) => (
                  <SelectItem key={account.id} value={String(account.id)}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <Button onClick={handlePay} disabled={isPending || !selectedAccountId}>
            {isPending ? 'Pagando...' : 'Confirmar Pagamento'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
