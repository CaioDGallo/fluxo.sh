# 50/30/20 Budget Configuration

## Default Setup for New Users

All new users automatically get:
- **Default preset**: `na_risca` (50/30/20 split)
- **Default categories** with buckets pre-assigned:
  - **Necessidades (50%)**: Alimentacao, Transporte, Saude, Moradia, Contas, Educacao
  - **Desejos (30%)**: Entretenimento, Compras, Lazer, Assinaturas
  - **Poupança (20%)**: (no default categories, user creates their own)

## How It Works

### Budget Settings Page (`/settings/budgets`)
When a user has a budget config set up:
1. **Grouped by Bucket** - Categories shown in collapsible sections by bucket
2. **Mini Progress Bars** - Each bucket shows allocation % vs target (50/30/20)
3. **Real-time Updates** - Progress bars update as you change budget amounts
4. **Unassigned Warning** - Categories without buckets shown with amber alert

### Categories Page (`/settings/categories`)
Expense categories grouped by bucket:
- **Necessidades** - Default open
- **Desejos** - Collapsed on mobile, open on desktop
- **Poupança** - Collapsed on mobile, open on desktop
- **Unassigned** - Shown with warning banner at top

## Changing Presets

Users can change from the default `na_risca` preset to:

### Via Dashboard UI
*(To be implemented - future work)*
Settings button on dashboard will allow switching between:
- `na_risca` (50/30/20) - Default, balanced approach
- `entrando_na_linha` (60/30/10) - More conservative, higher necessities
- `saindo_das_dividas` (70/25/5) - For users paying down debt
- `custom` - User defines their own percentages (must sum to 100)

### Via Database (Current Workaround)
```sql
-- Switch to "entrando na linha" (60/30/10)
UPDATE budget_config
SET preset = 'entrando_na_linha'
WHERE user_id = 'your-user-id';

-- Switch to custom percentages
UPDATE budget_config
SET
  preset = 'custom',
  custom_necessities = 70,
  custom_wants = 20,
  custom_savings = 10
WHERE user_id = 'your-user-id';
```

## Technical Details

### Data Flow
1. `setupNewUser()` creates budget config when user signs up
2. `/settings/budgets` page calls `getBudgetConfig()`
3. Config converted to percentages via `getBudgetPercentages()`
4. `BudgetForm` receives percentages and enables bucket grouping
5. `groupBudgetsByBucket()` organizes categories by bucket

### Backward Compatibility
- If no budget config exists → shows flat list (legacy mode)
- If categories have no buckets → shows flat list with assignment prompt
- Old users keep working until they set up a config

## Future Enhancements
- [ ] UI to change preset from dashboard settings
- [ ] Migration for existing users to default preset
- [ ] Onboarding flow to help users assign category buckets
- [ ] Budget config API for programmatic changes
