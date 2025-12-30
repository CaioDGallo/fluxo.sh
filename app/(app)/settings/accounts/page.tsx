import { getAccounts } from '@/lib/actions/accounts';
import { AccountForm } from '@/components/account-form';
import { AccountCard } from '@/components/account-card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default async function AccountsPage() {
  const accounts = await getAccounts();

  // Group accounts by type
  const creditCardAccounts = accounts.filter(acc => acc.type === 'credit_card');
  const checkingAccounts = accounts.filter(acc => acc.type === 'checking');
  const savingsAccounts = accounts.filter(acc => acc.type === 'savings');
  const cashAccounts = accounts.filter(acc => acc.type === 'cash');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Accounts</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="hollow">Add Account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent closeOnBackdropClick>
            <AlertDialogHeader>
              <AlertDialogTitle>Add Account</AlertDialogTitle>
            </AlertDialogHeader>
            <AccountForm />
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-8">
        {/* Credit Card Accounts */}
        {creditCardAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">Credit Cards</h2>
            <div className="space-y-3">
              {creditCardAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Checking Accounts */}
        {checkingAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">Checking Accounts</h2>
            <div className="space-y-3">
              {checkingAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Savings Accounts */}
        {savingsAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">Savings Accounts</h2>
            <div className="space-y-3">
              {savingsAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Cash Accounts */}
        {cashAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">Cash</h2>
            <div className="space-y-3">
              {cashAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {accounts.length === 0 && (
          <p className="text-sm text-gray-500">No accounts yet. Add your first account above.</p>
        )}
      </div>
    </div>
  );
}
