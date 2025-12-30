import { AppSidebar } from '@/components/app-sidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { FAB } from '@/components/fab';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accounts, expenseCategories, incomeCategories] = await Promise.all([
    getAccounts(),
    getCategories('expense'),
    getCategories('income'),
  ]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="font-semibold md:hidden">Northstar</span>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </SidebarInset>
      <FAB
        accounts={accounts}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />
    </SidebarProvider>
  );
}
