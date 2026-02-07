-- Reset placeholder Pluggy CC fatura amounts to 0.
-- These faturas were created by ensurePluggyFaturaRange() for months where Pluggy
-- hasn't returned a bill yet. Their totalAmount was incorrectly calculated from entries
-- instead of being left at 0 until syncPluggyBills() provides the bank's authoritative amount.
UPDATE faturas f
SET total_amount = 0
FROM accounts a
WHERE f.account_id = a.id
  AND a.source = 'pluggy'
  AND a.type = 'credit_card'
  AND f.pluggy_bill_id IS NULL;
