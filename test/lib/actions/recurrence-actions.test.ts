import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestTask } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type RecurrenceActions = typeof import('@/lib/actions/recurrence');

const OTHER_USER_ID = 'other-user-id';

describe('Recurrence Actions', () => {
  let db: ReturnType<typeof getTestDb>;
  let createRecurrenceRule: RecurrenceActions['createRecurrenceRule'];
  let updateRecurrenceRule: RecurrenceActions['updateRecurrenceRule'];
  let deleteRecurrenceRule: RecurrenceActions['deleteRecurrenceRule'];
  let getRecurrenceRuleByItem: RecurrenceActions['getRecurrenceRuleByItem'];
  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    const recurrenceActions = await import('@/lib/actions/recurrence');
    createRecurrenceRule = recurrenceActions.createRecurrenceRule;
    updateRecurrenceRule = recurrenceActions.updateRecurrenceRule;
    deleteRecurrenceRule = recurrenceActions.deleteRecurrenceRule;
    getRecurrenceRuleByItem = recurrenceActions.getRecurrenceRuleByItem;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('creates and updates recurrence rules for owned tasks', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Recurring Task' }))
      .returning();

    const createResult = await createRecurrenceRule({
      itemType: 'task',
      itemId: task.id,
      rrule: 'FREQ=WEEKLY;COUNT=2',
    });
    expect(createResult.success).toBe(true);

    const [rule] = await db.select().from(schema.recurrenceRules);
    const updateResult = await updateRecurrenceRule(rule.id, { rrule: 'FREQ=DAILY;COUNT=5' });
    expect(updateResult.success).toBe(true);

    const [updated] = await db.select().from(schema.recurrenceRules).where(eq(schema.recurrenceRules.id, rule.id));
    expect(updated.rrule).toBe('FREQ=DAILY;COUNT=5');
  });

  it('deletes recurrence rules for owned tasks', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Task With Rule' }))
      .returning();

    const [rule] = await db
      .insert(schema.recurrenceRules)
      .values({ itemType: 'task', itemId: task.id, rrule: 'FREQ=MONTHLY;COUNT=2' })
      .returning();

    const result = await deleteRecurrenceRule(rule.id);
    expect(result.success).toBe(true);

    const remaining = await db.select().from(schema.recurrenceRules).where(eq(schema.recurrenceRules.id, rule.id));
    expect(remaining).toHaveLength(0);
  });

  it('blocks updates for recurrence rules owned by another user', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ userId: OTHER_USER_ID, title: 'Other Task' }))
      .returning();

    const [rule] = await db
      .insert(schema.recurrenceRules)
      .values({ itemType: 'task', itemId: task.id, rrule: 'FREQ=WEEKLY;COUNT=3' })
      .returning();

    const result = await updateRecurrenceRule(rule.id, { rrule: 'FREQ=DAILY;COUNT=1' });
    expect(result.success).toBe(false);

    const [unchanged] = await db.select().from(schema.recurrenceRules).where(eq(schema.recurrenceRules.id, rule.id));
    expect(unchanged.rrule).toBe('FREQ=WEEKLY;COUNT=3');
  });

  it('blocks deletes for recurrence rules owned by another user', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ userId: OTHER_USER_ID, title: 'Other Task' }))
      .returning();

    const [rule] = await db
      .insert(schema.recurrenceRules)
      .values({ itemType: 'task', itemId: task.id, rrule: 'FREQ=YEARLY;COUNT=2' })
      .returning();

    const result = await deleteRecurrenceRule(rule.id);
    expect(result.success).toBe(false);

    const remaining = await db.select().from(schema.recurrenceRules).where(eq(schema.recurrenceRules.id, rule.id));
    expect(remaining).toHaveLength(1);
  });

  it('does not fetch recurrence rules for items owned by another user', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ userId: OTHER_USER_ID, title: 'Other Task' }))
      .returning();

    await db.insert(schema.recurrenceRules).values({
      itemType: 'task',
      itemId: task.id,
      rrule: 'FREQ=DAILY;COUNT=2',
    });

    const result = await getRecurrenceRuleByItem('task', task.id);
    expect(result).toBeUndefined();
  });
});
