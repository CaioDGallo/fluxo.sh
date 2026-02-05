import { boolean, date, index, integer, pgEnum, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Export Auth.js schema tables
export * from './auth-schema';

// Enum for account types
export const accountTypeEnum = pgEnum('account_type', ['credit_card', 'checking', 'savings', 'cash']);
export const accountSourceEnum = pgEnum('account_source', ['manual', 'pluggy']);

// Enum for category types
export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income']);

// Enums for notifications
export const itemTypeEnum = pgEnum('item_type', ['bill_reminder']);
export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'push']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed', 'cancelled']);
export const billReminderStatusEnum = pgEnum('bill_reminder_status', ['active', 'paused', 'completed']);
export const billStatusEnum = pgEnum('bill_status', ['active', 'paused', 'archived']);
export const billOccurrenceStatusEnum = pgEnum('bill_occurrence_status', [
  'upcoming', 'pending', 'paid', 'overdue', 'skipped'
]);
export const billingSubscriptionStatusEnum = pgEnum('billing_subscription_status', [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
]);

// Enums for 50/30/20 budget methodology
export const budgetBucketEnum = pgEnum('budget_bucket', ['necessities', 'wants', 'savings']);
export const budgetPresetEnum = pgEnum('budget_preset', ['na_risca', 'entrando_na_linha', 'saindo_das_dividas', 'custom']);

// Accounts table
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  source: accountSourceEnum('source').notNull().default('manual'),
  currency: text('currency').default('BRL'),
  currentBalance: integer('current_balance').notNull().default(0), // cents
  lastBalanceUpdate: timestamp('last_balance_update').defaultNow(),
  externalBalanceCents: integer('external_balance_cents'), // cents from provider
  externalBalanceUpdatedAt: timestamp('external_balance_updated_at'),
  externalCreditLimitCents: integer('external_credit_limit_cents'), // optional, cents
  // Credit card billing cycle config (1-28, null for non-CC accounts)
  closingDay: integer('closing_day'),
  paymentDueDay: integer('payment_due_day'),
  creditLimit: integer('credit_limit'), // nullable, cents - only for credit cards
  bankLogo: text('bank_logo'), // nullable, bank logo key (e.g., "nubank", "inter")
  createdAt: timestamp('created_at').defaultNow(),
});

// Pluggy items table
export const pluggyItems = pgTable(
  'pluggy_items',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    pluggyItemId: text('pluggy_item_id').notNull(),
    connectorId: text('connector_id'),
    status: text('status'),
    statusDetail: text('status_detail'),
    lastUpdatedAt: timestamp('last_updated_at'),
    lastSyncedAt: timestamp('last_synced_at'),
    nextSyncAt: timestamp('next_sync_at'),
    lastError: text('last_error'),
    errorCount: integer('error_count').notNull().default(0),
    consentExpiresAt: timestamp('consent_expires_at'),
    clientUserId: text('client_user_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueUserItem: unique().on(table.userId, table.pluggyItemId),
  })
);

// Pluggy accounts table (maps Pluggy accounts to local accounts)
export const pluggyAccounts = pgTable(
  'pluggy_accounts',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    itemId: integer('item_id')
      .notNull()
      .references(() => pluggyItems.id, { onDelete: 'cascade' }),
    pluggyAccountId: text('pluggy_account_id').notNull(),
    accountId: integer('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    type: text('type').notNull(),
    subtype: text('subtype'),
    currency: text('currency').default('BRL'),
    mask: text('mask'),
    institutionId: text('institution_id'),
    institutionName: text('institution_name'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueUserAccount: unique().on(table.userId, table.pluggyAccountId),
    uniqueLocalAccount: unique().on(table.accountId),
  })
);

// Pluggy sync cursors table (incremental sync tokens)
export const pluggySyncCursors = pgTable(
  'pluggy_sync_cursors',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    itemId: integer('item_id')
      .notNull()
      .references(() => pluggyItems.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    cursor: text('cursor'),
    lastSyncedAt: timestamp('last_synced_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueItemScope: unique().on(table.itemId, table.scope),
  })
);

// Pluggy webhook events (idempotency)
export const pluggyWebhookEvents = pgTable(
  'pluggy_webhook_events',
  {
    id: serial('id').primaryKey(),
    eventId: text('event_id').notNull(),
    event: text('event').notNull(),
    itemId: text('item_id'),
    userId: text('user_id'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueEvent: unique().on(table.eventId),
  })
);

// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  icon: text('icon'),
  type: categoryTypeEnum('type').notNull().default('expense'),
  bucket: budgetBucketEnum('bucket'), // nullable, for 50/30/20 bucketing
  isImportDefault: boolean('is_import_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Budgets table
export const budgets = pgTable(
  'budgets',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // '2024-01'
    amount: integer('amount').notNull(), // cents
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueCategoryMonth: unique().on(table.userId, table.categoryId, table.yearMonth),
  })
);

// Budget alerts table (cooldowns per category/threshold)
export const budgetAlerts = pgTable(
  'budget_alerts',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(),
    threshold: integer('threshold').notNull(),
    lastSentAt: timestamp('last_sent_at').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueAlert: unique().on(table.userId, table.categoryId, table.yearMonth, table.threshold),
  })
);

// Monthly Budgets table (total budget per month)
export const monthlyBudgets = pgTable(
  'monthly_budgets',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    yearMonth: text('year_month').notNull(),
    amount: integer('amount').notNull(), // cents
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueUserMonth: unique().on(table.userId, table.yearMonth),
  })
);

// Budget Config table (50/30/20 preset configuration)
export const budgetConfig = pgTable(
  'budget_config',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    preset: budgetPresetEnum('preset').notNull().default('na_risca'),
    customNecessities: integer('custom_necessities'), // nullable, only used when preset='custom'
    customWants: integer('custom_wants'), // nullable, only used when preset='custom'
    customSavings: integer('custom_savings'), // nullable, only used when preset='custom'
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueUser: unique().on(table.userId),
  })
);

// Transactions table (parent for installments)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description'),
  totalAmount: integer('total_amount').notNull(), // cents
  totalInstallments: integer('total_installments').notNull().default(1),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  externalId: text('external_id'), // UUID from bank statement for idempotency
  ignored: boolean('ignored').notNull().default(false),
  isInternalTransfer: boolean('is_internal_transfer').notNull().default(false),
  isFaturaPayment: boolean('is_fatura_payment').notNull().default(false),
  refundedAmount: integer('refunded_amount').default(0), // cached sum of refunds (cents)
  createdAt: timestamp('created_at').defaultNow(),
});

// Entries table (actual monthly charges)
export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  faturaId: integer('fatura_id').references(() => faturas.id), // explicit FK to fatura (nullable for migration)
  amount: integer('amount').notNull(), // cents
  purchaseDate: date('purchase_date').notNull(), // When expense occurred (budget impact)
  faturaMonth: text('fatura_month').notNull(), // "YYYY-MM" format - denormalized for quick filtering
  dueDate: date('due_date').notNull(), // When fatura payment is due (cash flow impact)
  paidAt: timestamp('paid_at'), // null = pending, timestamp = paid
  installmentNumber: integer('installment_number').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userPurchaseDateIdx: index('entries_user_purchase_date_idx').on(table.userId, table.purchaseDate),
}));

// Faturas table (credit card statements/bills)
export const faturas = pgTable(
  'faturas',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // "2025-01"
    closingDate: date('closing_date').notNull(), // actual closing date for this billing cycle
    startDate: date('start_date'), // null = calculated from previous fatura's closing date + 1
    totalAmount: integer('total_amount').notNull().default(0), // cached sum of entries
    dueDate: date('due_date').notNull(), // when payment is due
    paidAt: timestamp('paid_at'), // null = pending, timestamp = paid
    paidFromAccountId: integer('paid_from_account_id').references(() => accounts.id), // which checking account paid it
    pluggyBillId: text('pluggy_bill_id'), // Links to Pluggy bill for Pluggy-sourced faturas
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueAccountMonth: unique().on(table.accountId, table.yearMonth),
    uniquePluggyBill: unique().on(table.accountId, table.pluggyBillId),
  })
);

// Income table
export const income = pgTable('income', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description'),
  amount: integer('amount').notNull(), // cents
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  receivedDate: date('received_date').notNull(),
  receivedAt: timestamp('received_at'), // null = pending, timestamp = received
  externalId: text('external_id'), // UUID from bank statement for idempotency
  ignored: boolean('ignored').notNull().default(false),
  // Optional link to expense category for budget replenishment
  replenishCategoryId: integer('replenish_category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  // Optional link to transaction for credit card refunds
  refundOfTransactionId: integer('refund_of_transaction_id')
    .references(() => transactions.id, { onDelete: 'set null' }),
  faturaMonth: text('fatura_month'), // "YYYY-MM" format - which fatura to credit (nullable for non-CC income)
  isRefund: boolean('is_refund').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  userReceivedDateIdx: index('income_user_received_date_idx').on(table.userId, table.receivedDate),
}));

// Category Frequency table (for smart categorization suggestions)
export const categoryFrequency = pgTable(
  'category_frequency',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    descriptionNormalized: text('description_normalized').notNull(), // LOWER(TRIM(description))
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    type: categoryTypeEnum('type').notNull(), // 'expense' | 'income'
    count: integer('count').notNull().default(1),
    lastUsedAt: timestamp('last_used_at').defaultNow(),
  },
  (table) => ({
    uniqueUserDescCatType: unique().on(
      table.userId,
      table.descriptionNormalized,
      table.categoryId,
      table.type
    ),
    lookupIdx: sql`CREATE INDEX IF NOT EXISTS category_frequency_lookup_idx ON category_frequency (user_id, description_normalized, type)`,
  })
);

// Notification jobs table
export const notificationJobs = pgTable('notification_jobs', {
  id: serial('id').primaryKey(),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: integer('item_id').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User settings table
export const userSettings = pgTable(
  'user_settings',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    timezone: text('timezone').default('UTC'),
    locale: text('locale').default('pt-BR'),
    notificationEmail: text('notification_email'),
    notificationsEnabled: boolean('notifications_enabled').default(true),
    pushNotificationsEnabled: boolean('push_notifications_enabled').default(false),
    pushNotificationPromptedAt: timestamp('push_notification_prompted_at'),
    onboardingCompletedAt: timestamp('onboarding_completed_at'),
    onboardingSkippedAt: timestamp('onboarding_skipped_at'),
    hintsViewed: text('hints_viewed'), // JSON array: ["dashboard", "expenses", ...]
    // Analytics milestones
    firstExpenseCreatedAt: timestamp('first_expense_created_at'),
    firstImportCompletedAt: timestamp('first_import_completed_at'),
    firstBudgetCreatedAt: timestamp('first_budget_created_at'),
    firstCustomCategoryCreatedAt: timestamp('first_custom_category_created_at'),
    firstExportCompletedAt: timestamp('first_export_completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueUser: unique().on(table.userId),
  })
);

// Billing customers table
export const billingCustomers = pgTable(
  'billing_customers',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    stripeCustomerId: text('stripe_customer_id').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueUser: unique().on(table.userId),
    uniqueStripeCustomer: unique().on(table.stripeCustomerId),
  })
);

// Billing subscriptions table
export const billingSubscriptions = pgTable(
  'billing_subscriptions',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    planKey: text('plan_key').notNull(),
    status: billingSubscriptionStatusEnum('status').notNull(),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    stripeProductId: text('stripe_product_id'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueStripeSubscription: unique().on(table.stripeSubscriptionId),
  })
);

// Usage counters table (plan limits)
export const usageCounters = pgTable(
  'usage_counters',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    key: text('key').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    count: integer('count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueUsage: unique().on(table.userId, table.key, table.periodStart, table.periodEnd),
  })
);

// Bill reminders table
export const billReminders = pgTable('bill_reminders', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amount: integer('amount'), // cents, optional
  dueDay: integer('due_day').notNull(), // 1-31 for monthly, 0-6 for weekly
  dueTime: text('due_time'), // "HH:mm" or null
  status: billReminderStatusEnum('status').notNull().default('active'),
  recurrenceType: text('recurrence_type').notNull().default('monthly'), // 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  startMonth: text('start_month').notNull(), // 'YYYY-MM'
  endMonth: text('end_month'), // 'YYYY-MM' or null (forever)
  notify2DaysBefore: boolean('notify_2_days_before').notNull().default(true),
  notify1DayBefore: boolean('notify_1_day_before').notNull().default(true),
  notifyOnDueDay: boolean('notify_on_due_day').notNull().default(true),
  lastAcknowledgedMonth: text('last_acknowledged_month'), // for in-app banner dismissal
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Bills table (recurring bill definitions)
export const bills = pgTable('bills', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  expectedAmount: integer('expected_amount'), // cents, null for variable
  isVariableAmount: boolean('is_variable_amount').notNull().default(false),
  recurrenceType: text('recurrence_type').notNull().default('monthly'), // once | weekly | biweekly | monthly | quarterly | yearly
  dueDay: integer('due_day').notNull(), // 1-31 for monthly, 0-6 for weekly
  dueTime: text('due_time'), // "HH:mm" or null
  startMonth: text('start_month').notNull(), // 'YYYY-MM'
  endMonth: text('end_month'), // 'YYYY-MM' or null (ongoing)
  preferredAccountId: integer('preferred_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  notify2DaysBefore: boolean('notify_2_days_before').notNull().default(true),
  notify1DayBefore: boolean('notify_1_day_before').notNull().default(true),
  notifyOnDueDay: boolean('notify_on_due_day').notNull().default(true),
  status: billStatusEnum('status').notNull().default('active'),
  legacyBillReminderId: integer('legacy_bill_reminder_id'), // migration reference
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Bill occurrences table (individual payment instances)
export const billOccurrences = pgTable(
  'bill_occurrences',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    dueDate: date('due_date').notNull(),
    expectedAmount: integer('expected_amount'), // cents, inherited or overridden
    actualAmount: integer('actual_amount'), // cents, filled when paid
    status: billOccurrenceStatusEnum('status').notNull().default('upcoming'),
    paidAt: timestamp('paid_at'),
    paidFromAccountId: integer('paid_from_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    matchedTransactionId: integer('matched_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    matchedEntryId: integer('matched_entry_id').references(() => entries.id, { onDelete: 'set null' }),
    notes: text('notes'),
    acknowledgedAt: timestamp('acknowledged_at'),
    yearMonth: text('year_month').notNull(), // 'YYYY-MM' for indexing
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueBillDue: unique().on(table.billId, table.dueDate),
    userMonthStatusIdx: sql`CREATE INDEX IF NOT EXISTS bill_occurrences_user_month_status_idx ON bill_occurrences (user_id, year_month, status)`,
  })
);

// FCM tokens table
export const fcmTokens = pgTable('fcm_tokens', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  token: text('token').notNull(),
  deviceName: text('device_name'), // "Chrome on Windows", "Safari on iPhone"
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at').defaultNow(),
}, (table) => ({
  uniqueToken: unique().on(table.token), // Tokens are globally unique
  userIdx: sql`CREATE INDEX IF NOT EXISTS fcm_tokens_user_idx ON fcm_tokens (user_id)`,
}));

// Sent emails table (deduplication for transactional emails)
export const sentEmails = pgTable('sent_emails', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  emailType: text('email_type').notNull(), // 'subscription_purchased', 'payment_failed', etc.
  referenceId: text('reference_id').notNull(), // subscriptionId, invoiceId, etc.
  sentAt: timestamp('sent_at').defaultNow().notNull(),
}, (table) => ({
  uniqueEmail: unique().on(table.userId, table.emailType, table.referenceId),
  userIdx: sql`CREATE INDEX IF NOT EXISTS sent_emails_user_idx ON sent_emails (user_id)`,
}));

// Type exports for TypeScript
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type PluggyItem = typeof pluggyItems.$inferSelect;
export type NewPluggyItem = typeof pluggyItems.$inferInsert;

export type PluggyAccount = typeof pluggyAccounts.$inferSelect;
export type NewPluggyAccount = typeof pluggyAccounts.$inferInsert;

export type PluggySyncCursor = typeof pluggySyncCursors.$inferSelect;
export type NewPluggySyncCursor = typeof pluggySyncCursors.$inferInsert;

export type PluggyWebhookEvent = typeof pluggyWebhookEvents.$inferSelect;
export type NewPluggyWebhookEvent = typeof pluggyWebhookEvents.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type BudgetAlert = typeof budgetAlerts.$inferSelect;
export type NewBudgetAlert = typeof budgetAlerts.$inferInsert;

export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;
export type NewMonthlyBudget = typeof monthlyBudgets.$inferInsert;

export type BudgetConfig = typeof budgetConfig.$inferSelect;
export type NewBudgetConfig = typeof budgetConfig.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export type Income = typeof income.$inferSelect;
export type NewIncome = typeof income.$inferInsert;

export type CategoryFrequency = typeof categoryFrequency.$inferSelect;
export type NewCategoryFrequency = typeof categoryFrequency.$inferInsert;

export type Fatura = typeof faturas.$inferSelect;
export type NewFatura = typeof faturas.$inferInsert;

export type NotificationJob = typeof notificationJobs.$inferSelect;
export type NewNotificationJob = typeof notificationJobs.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

export type BillingCustomer = typeof billingCustomers.$inferSelect;
export type NewBillingCustomer = typeof billingCustomers.$inferInsert;

export type BillingSubscription = typeof billingSubscriptions.$inferSelect;
export type NewBillingSubscription = typeof billingSubscriptions.$inferInsert;

export type UsageCounter = typeof usageCounters.$inferSelect;
export type NewUsageCounter = typeof usageCounters.$inferInsert;

export type BillReminder = typeof billReminders.$inferSelect;
export type NewBillReminder = typeof billReminders.$inferInsert;

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;

export type BillOccurrence = typeof billOccurrences.$inferSelect;
export type NewBillOccurrence = typeof billOccurrences.$inferInsert;

export type FcmToken = typeof fcmTokens.$inferSelect;
export type NewFcmToken = typeof fcmTokens.$inferInsert;

export type SentEmail = typeof sentEmails.$inferSelect;
export type NewSentEmail = typeof sentEmails.$inferInsert;

// Relations
import { relations } from 'drizzle-orm';

export const transactionsRelations = relations(transactions, ({ many, one }) => ({
  entries: many(entries),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  refunds: many(income),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [entries.transactionId],
    references: [transactions.id],
  }),
  account: one(accounts, {
    fields: [entries.accountId],
    references: [accounts.id],
  }),
  fatura: one(faturas, {
    fields: [entries.faturaId],
    references: [faturas.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  income: many(income),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  entries: many(entries),
  income: many(income),
  pluggyAccounts: many(pluggyAccounts),
}));

export const pluggyItemsRelations = relations(pluggyItems, ({ many }) => ({
  accounts: many(pluggyAccounts),
  syncCursors: many(pluggySyncCursors),
}));

export const pluggyAccountsRelations = relations(pluggyAccounts, ({ one }) => ({
  item: one(pluggyItems, {
    fields: [pluggyAccounts.itemId],
    references: [pluggyItems.id],
  }),
  account: one(accounts, {
    fields: [pluggyAccounts.accountId],
    references: [accounts.id],
  }),
}));

export const pluggySyncCursorsRelations = relations(pluggySyncCursors, ({ one }) => ({
  item: one(pluggyItems, {
    fields: [pluggySyncCursors.itemId],
    references: [pluggyItems.id],
  }),
}));

export const incomeRelations = relations(income, ({ one }) => ({
  category: one(categories, {
    fields: [income.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [income.accountId],
    references: [accounts.id],
  }),
  replenishCategory: one(categories, {
    fields: [income.replenishCategoryId],
    references: [categories.id],
  }),
  refundOfTransaction: one(transactions, {
    fields: [income.refundOfTransactionId],
    references: [transactions.id],
  }),
}));

export const categoryFrequencyRelations = relations(categoryFrequency, ({ one }) => ({
  category: one(categories, {
    fields: [categoryFrequency.categoryId],
    references: [categories.id],
  }),
}));

export const faturasRelations = relations(faturas, ({ one, many }) => ({
  account: one(accounts, {
    fields: [faturas.accountId],
    references: [accounts.id],
  }),
  paidFromAccount: one(accounts, {
    fields: [faturas.paidFromAccountId],
    references: [accounts.id],
  }),
  entries: many(entries),
}));

export const userSettingsRelations = relations(userSettings, () => ({}));

export const billRemindersRelations = relations(billReminders, ({ one }) => ({
  category: one(categories, {
    fields: [billReminders.categoryId],
    references: [categories.id],
  }),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  category: one(categories, {
    fields: [bills.categoryId],
    references: [categories.id],
  }),
  preferredAccount: one(accounts, {
    fields: [bills.preferredAccountId],
    references: [accounts.id],
  }),
  occurrences: many(billOccurrences),
}));

export const billOccurrencesRelations = relations(billOccurrences, ({ one }) => ({
  bill: one(bills, {
    fields: [billOccurrences.billId],
    references: [bills.id],
  }),
  paidFromAccount: one(accounts, {
    fields: [billOccurrences.paidFromAccountId],
    references: [accounts.id],
  }),
  matchedTransaction: one(transactions, {
    fields: [billOccurrences.matchedTransactionId],
    references: [transactions.id],
  }),
  matchedEntry: one(entries, {
    fields: [billOccurrences.matchedEntryId],
    references: [entries.id],
  }),
}));
