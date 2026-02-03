/**
 * Pure balance computation function
 *
 * Formula: balance = totalReceivedIncome - totalExpenses
 *
 * For manual accounts, totalExpenses includes ALL entries (including ignored
 * ones like fatura payments and internal transfers) because they represent real
 * money movements. Display totals (dashboard, budgets) filter ignored separately.
 *
 * Note: totalReceivedIncome should only include income with receivedAt IS NOT NULL
 */
export function computeBalance(data: {
  totalExpenses: number;
  totalReceivedIncome: number;
}): number {
  return data.totalReceivedIncome - data.totalExpenses;
}
