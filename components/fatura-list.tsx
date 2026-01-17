'use client';

import { FaturaCard } from '@/components/fatura-card';
import type { Account } from '@/lib/schema';

type FaturaListProps = {
  faturas: Array<{
    id: number;
    accountId: number;
    accountName: string;
    yearMonth: string;
    closingDate: string;
    totalAmount: number;
    dueDate: string;
    paidAt: string | null;
    paidFromAccountId: number | null;
  }>;
  checkingAccounts: Account[];
};

export function FaturaList({ faturas, checkingAccounts }: FaturaListProps) {
  if (faturas.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">Nenhuma fatura para este mês</p>
      </div>
    );
  }

  // Group faturas by accountId
  const grouped = faturas.reduce((acc, fatura) => {
    if (!acc[fatura.accountId]) {
      acc[fatura.accountId] = [];
    }
    acc[fatura.accountId].push(fatura);
    return acc;
  }, {} as Record<number, typeof faturas>);

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([accountId, accountFaturas]) => (
        <section key={accountId}>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            {accountFaturas[0].accountName}
          </h2>
          <div className="space-y-3">
            {accountFaturas.map((fatura) => (
              <FaturaCard
                key={fatura.id}
                fatura={fatura}
                checkingAccounts={checkingAccounts}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
