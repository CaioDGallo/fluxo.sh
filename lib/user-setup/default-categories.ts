/**
 * Default categories for new users
 * Shared between seed script and user setup flow
 */

export interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
  type: 'expense' | 'income';
  isImportDefault: boolean;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expense categories (10)
  { name: 'Alimentacao', color: '#ef4444', icon: 'Restaurant01Icon', type: 'expense', isImportDefault: true },
  { name: 'Transporte', color: '#3b82f6', icon: 'Car01Icon', type: 'expense', isImportDefault: true },
  { name: 'Entretenimento', color: '#a855f7', icon: 'GameController01Icon', type: 'expense', isImportDefault: false },
  { name: 'Compras', color: '#f97316', icon: 'ShoppingBag01Icon', type: 'expense', isImportDefault: true },
  { name: 'Saude', color: '#22c55e', icon: 'HealthIcon', type: 'expense', isImportDefault: false },
  { name: 'Moradia', color: '#64748b', icon: 'Home01Icon', type: 'expense', isImportDefault: false },
  { name: 'Contas', color: '#78716c', icon: 'Receipt01Icon', type: 'expense', isImportDefault: true },
  { name: 'Educacao', color: '#0ea5e9', icon: 'Book01Icon', type: 'expense', isImportDefault: false },
  { name: 'Lazer', color: '#ec4899', icon: 'Beach01Icon', type: 'expense', isImportDefault: false },
  { name: 'Assinaturas', color: '#8b5cf6', icon: 'Calendar03Icon', type: 'expense', isImportDefault: false },
  // Income categories (4)
  { name: 'Salario', color: '#22c55e', icon: 'MoneyBag01Icon', type: 'income', isImportDefault: true },
  { name: 'Freelance', color: '#3b82f6', icon: 'BriefcaseIcon', type: 'income', isImportDefault: false },
  { name: 'Investimentos', color: '#a855f7', icon: 'ChartLineData01Icon', type: 'income', isImportDefault: false },
  { name: 'Outros', color: '#64748b', icon: 'CoinsIcon', type: 'income', isImportDefault: false },
];
