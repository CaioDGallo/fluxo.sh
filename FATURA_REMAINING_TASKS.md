# Fatura Feature - Remaining Tasks

## Overview

The fatura (Brazilian credit card statement) feature is **functionally complete** at the backend level. All core logic works:

- ✅ Credit cards can have closing day & payment due day configuration
- ✅ Purchases are assigned to the correct fatura based on closing date
- ✅ Budget tracking uses purchase date (not payment date)
- ✅ Installments correctly span multiple faturas
- ✅ Fatura totals are automatically maintained
- ✅ Payment logic exists (marks fatura + all entries as paid)

**What's missing:** UI for browsing and paying faturas.

---

## Completed Work

### Backend

| Component | Status | Description |
|-----------|--------|-------------|
| Schema | ✅ Complete | `accounts` (closingDay, paymentDueDay), `entries` (purchaseDate, faturaMonth), `faturas` table |
| Migration | ✅ Applied | `/drizzle/0003_outgoing_wallow.sql` with backfill logic |
| Fatura Utils | ✅ Complete | `/lib/fatura-utils.ts` - getFaturaMonth(), getFaturaPaymentDueDate() |
| Fatura Actions | ✅ Complete | `/lib/actions/faturas.ts` - CRUD, payment, total updates |
| Expense Actions | ✅ Updated | `/lib/actions/expenses.ts` - creates/updates with purchaseDate, faturaMonth |
| Budget Queries | ✅ Updated | `/lib/actions/budgets.ts`, `dashboard.ts` - use purchaseDate |

### Frontend

| Component | Status | Description |
|-----------|--------|-------------|
| Account Form | ✅ Complete | `/components/account-form.tsx` - billing cycle fields (closingDay, paymentDueDay) |
| Transaction Form | ✅ Updated | `/components/transaction-form.tsx` - uses purchaseDate field |

---

## Remaining Tasks

### Task 1: Create Fatura Page

**File:** `/app/(app)/faturas/page.tsx`

**Purpose:** Browse faturas by month and credit card account.

**Requirements:**

- Month picker (reuse existing pattern from budgets/expenses pages)
- Filter by credit card account
- Display list of faturas for selected month
- Show fatura status (paid/pending), total amount, due date
- "Pay Fatura" button for unpaid faturas

**Suggested Implementation:**

```typescript
import { getFaturasByMonth } from '@/lib/actions/faturas';
import { getAccounts } from '@/lib/actions/accounts';
import { FaturaList } from '@/components/fatura-list';
// ... month picker component

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: { month?: string; account?: string };
}) {
  const yearMonth = searchParams.month || getCurrentYearMonth();
  const accounts = await getAccounts();
  const creditCards = accounts.filter(a => a.type === 'credit_card');
  const faturas = await getFaturasByMonth(yearMonth);

  return (
    <div>
      {/* Month picker */}
      {/* Account filter */}
      <FaturaList faturas={faturas} />
    </div>
  );
}
```

**Available Actions:**

- `getFaturasByMonth(yearMonth)` - returns all faturas for a month
- `getFaturasByAccount(accountId)` - returns all faturas for an account
- `getFaturaWithEntries(faturaId)` - returns fatura + all its entries

---

### Task 2: Create Fatura UI Components

#### 2.1 FaturaCard Component

**File:** `/components/fatura-card.tsx`

**Purpose:** Display a single fatura summary with pay/unpay actions.

**Props:**

```typescript
type FaturaCardProps = {
  fatura: {
    id: number;
    accountName: string;
    yearMonth: string;
    totalAmount: number;
    dueDate: string;
    paidAt: string | null;
    paidFromAccountId: number | null;
  };
  checkingAccounts: Account[]; // For payment source selection
};
```

**Features:**

- Card header: account name + fatura month (use `formatFaturaMonth()` from `/lib/fatura-utils.ts`)
- Total amount (use `centsToDisplay()`, `formatCurrency()`)
- Due date
- Status badge (paid/pending)
- Pay button (opens PayFaturaDialog)
- Click to expand → show FaturaDetailSheet

**Available Actions:**

- `payFatura(faturaId, fromAccountId)` - marks fatura as paid
- `markFaturaUnpaid(faturaId)` - reverses payment

---

#### 2.2 FaturaList Component

**File:** `/components/fatura-list.tsx`

**Purpose:** List of FaturaCard components, grouped by account.

```typescript
type FaturaListProps = {
  faturas: Array<{
    id: number;
    accountId: number;
    accountName: string;
    yearMonth: string;
    totalAmount: number;
    dueDate: string;
    paidAt: string | null;
  }>;
};
```

---

#### 2.3 FaturaDetailSheet Component

**File:** `/components/fatura-detail-sheet.tsx`

**Purpose:** Side sheet showing all entries in a fatura.

**Features:**

- List all entries (purchases) in the fatura
- Group by category or show chronologically
- Show: description, purchase date, amount, installment info
- Running total
- Payment history (which account paid, when)

**Data Source:**

```typescript
const faturaDetail = await getFaturaWithEntries(faturaId);
// Returns: { ...fatura, entries: [...] }
```

---

#### 2.4 PayFaturaDialog Component

**File:** `/components/pay-fatura-dialog.tsx`

**Purpose:** Dialog to select which checking account pays the fatura.

**Props:**

```typescript
type PayFaturaDialogProps = {
  fatura: Fatura;
  checkingAccounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};
```

**Flow:**

1. Select source account (dropdown of checking/savings accounts)
2. Confirm button
3. Calls `payFatura(faturaId, fromAccountId)`
4. Shows success message
5. Revalidates faturas page

**Validation:**

- Cannot pay from another credit card
- Source account must exist

---

### Task 3: Update Navigation

**Files to modify:**

- `/components/navigation.tsx` or wherever main nav is defined
- `/app/(app)/layout.tsx` if needed

**Add:**

- "Faturas" link to sidebar/bottom nav
- Icon: CreditCard or Receipt (from Hugeicons)
- Route: `/faturas`
- Position: Between "Expenses" and "Budgets"

---

## Technical Notes

### Key Database Relationships

```
accounts (id, closingDay, paymentDueDay)
  ↓
faturas (id, accountId, yearMonth, totalAmount, dueDate, paidAt)
  ↓ (virtual - linked by accountId + yearMonth)
entries (id, accountId, faturaMonth, purchaseDate, dueDate, amount, paidAt)
  ↓
transactions (id, description, totalAmount, categoryId)
```

### Fatura Computation Logic

From `/lib/fatura-utils.ts`:

```typescript
// Purchase on Jan 10, closing day 15 → fatura "2025-01"
// Purchase on Jan 20, closing day 15 → fatura "2025-02"
getFaturaMonth(purchaseDate, closingDay): string

// Fatura "2025-01", payment due day 5 → "2025-02-05"
getFaturaPaymentDueDate(faturaMonth, paymentDueDay): string
```

### Important: Fatura Total Updates

When creating/updating/deleting expenses, **always** call `updateFaturaTotal()`:

```typescript
// After inserting/deleting entries
await updateFaturaTotal(accountId, faturaMonth);
```

This is already implemented in `/lib/actions/expenses.ts` - follow that pattern.

---

## Testing Checklist

Once UI is complete, test:

1. **Account Configuration**
   - [ ] Create credit card with closing day 15, payment due day 5
   - [ ] Edit existing credit card to add billing cycle

2. **Expense Creation**
   - [ ] Single purchase before closing → correct fatura month
   - [ ] Single purchase after closing → next fatura month
   - [ ] 3-installment purchase → spans 3 faturas correctly

3. **Budget Tracking**
   - [ ] Purchase in Jan → shows in Jan budget (not payment month)
   - [ ] Verify dashboard uses purchase date

4. **Fatura Browsing**
   - [ ] View current month faturas
   - [ ] View past month faturas
   - [ ] See correct totals
   - [ ] Expand fatura to see entries

5. **Fatura Payment**
   - [ ] Pay fatura from checking account
   - [ ] Verify fatura marked as paid
   - [ ] Verify all entries marked as paid
   - [ ] Cannot pay from credit card
   - [ ] Unpay fatura (reversal)

---

## File Reference

### Modified Files

- `/lib/schema.ts` - schema definitions
- `/lib/fatura-utils.ts` - utility functions
- `/lib/actions/faturas.ts` - fatura server actions
- `/lib/actions/expenses.ts` - expense server actions (updated)
- `/lib/actions/budgets.ts` - budget queries (updated)
- `/lib/actions/dashboard.ts` - dashboard queries (updated)
- `/components/account-form.tsx` - account form (updated)
- `/components/transaction-form.tsx` - transaction form (updated)

### Files to Create

- `/app/(app)/faturas/page.tsx`
- `/components/fatura-card.tsx`
- `/components/fatura-list.tsx`
- `/components/fatura-detail-sheet.tsx`
- `/components/pay-fatura-dialog.tsx`

### Migration

- `/drizzle/0003_outgoing_wallow.sql` - already applied

---

## UI Component Patterns to Follow

Reference existing patterns from the codebase:

1. **Month Picker**: See `/app/(app)/budgets/page.tsx`
2. **Card Components**: See `/components/ui/card.tsx`
3. **Dialog/Sheet**: See `/components/ui/alert-dialog.tsx`, `/components/ui/sheet.tsx`
4. **Select Dropdown**: See `/components/account-form.tsx` (billing cycle selects)
5. **Optimistic Updates**: See `/lib/contexts/expense-context.tsx`

---

## Questions/Clarifications

If uncertain about behavior:

1. **Closing date edge cases**: Currently uses days 1-28 to avoid month-end complexity. If user wants day 29-31, need to decide on behavior.

2. **Paid status**: Currently, paying a fatura marks ALL entries as paid atomically. If user wants granular control (pay some entries, not others), need additional logic.

3. **Multiple credit cards**: Each card has independent billing cycle. Faturas page should allow filtering by card.

---

**Last Updated:** 2025-12-31
**Status:** Backend complete, UI pending
**Next Step:** Create `/app/(app)/faturas/page.tsx` (Task 1)
