import { getCategories } from '@/lib/actions/categories';
import { AddCategoryButton } from '@/components/add-category-button';
import { CategoryCard } from '@/components/category-card';

export default async function CategoriesPage() {
  const categories = await getCategories();

  const expenseCategories = categories.filter(cat => cat.type === 'expense');
  const incomeCategories = categories.filter(cat => cat.type === 'income');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <AddCategoryButton />
      </div>

      <div className="space-y-8">
        {/* Expense Categories */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-700">Expense Categories</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {expenseCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
          {expenseCategories.length === 0 && (
            <p className="text-sm text-gray-500">No expense categories yet.</p>
          )}
        </div>

        {/* Income Categories */}
        <div>
          <h2 className="mb-4 text-lg font-semibold text-gray-700">Income Categories</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {incomeCategories.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
          {incomeCategories.length === 0 && (
            <p className="text-sm text-gray-500">No income categories yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
