/**
 * Default categories for new users
 * Shared between seed script and user setup flow
 */

export interface DefaultCategory {
  name: string;
  color: string;
  icon: string;
  type: 'expense' | 'income';
  bucket?: 'necessities' | 'wants' | 'savings';
  isImportDefault: boolean;
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  // Expense categories (10) - with 50/30/20 bucket assignments
  { name: 'Alimentacao', color: '#ef4444', icon: 'Restaurant01Icon', type: 'expense', bucket: 'necessities', isImportDefault: true },
  { name: 'Transporte', color: '#3b82f6', icon: 'Car01Icon', type: 'expense', bucket: 'necessities', isImportDefault: false },
  { name: 'Entretenimento', color: '#a855f7', icon: 'GameController01Icon', type: 'expense', bucket: 'wants', isImportDefault: false },
  { name: 'Compras', color: '#f97316', icon: 'ShoppingBag01Icon', type: 'expense', bucket: 'wants', isImportDefault: false },
  { name: 'Saude', color: '#22c55e', icon: 'HealthIcon', type: 'expense', bucket: 'necessities', isImportDefault: false },
  { name: 'Moradia', color: '#64748b', icon: 'Home01Icon', type: 'expense', bucket: 'necessities', isImportDefault: false },
  { name: 'Contas', color: '#78716c', icon: 'ElectricHome01Icon', type: 'expense', bucket: 'necessities', isImportDefault: false },
  { name: 'Educacao', color: '#0ea5e9', icon: 'Book01Icon', type: 'expense', bucket: 'necessities', isImportDefault: false },
  { name: 'Lazer', color: '#ec4899', icon: 'Film01Icon', type: 'expense', bucket: 'wants', isImportDefault: false },
  { name: 'Assinaturas', color: '#8b5cf6', icon: 'Wifi01Icon', type: 'expense', bucket: 'wants', isImportDefault: false },
  // Income categories (4)
  { name: 'Salario', color: '#22c55e', icon: 'Cash01Icon', type: 'income', isImportDefault: true },
  { name: 'Freelance', color: '#3b82f6', icon: 'Briefcase01Icon', type: 'income', isImportDefault: false },
  { name: 'Investimentos', color: '#a855f7', icon: 'BankIcon', type: 'income', isImportDefault: false },
  { name: 'Outros', color: '#64748b', icon: 'SparklesIcon', type: 'income', isImportDefault: false },
];
