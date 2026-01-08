import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, createTestTask } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type TaskActions = typeof import('@/lib/actions/tasks');

const OTHER_USER_ID = 'other-user-id';

describe('Task Actions - Get Tasks', () => {
  let db: ReturnType<typeof getTestDb>;
  let getTasks: TaskActions['getTasks'];
  let getTaskById: TaskActions['getTaskById'];
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

    const taskActions = await import('@/lib/actions/tasks');
    getTasks = taskActions.getTasks;
    getTaskById = taskActions.getTaskById;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('returns only tasks for the current user', async () => {
    await db.insert(schema.tasks).values([
      createTestTask({ title: 'Mine', userId: TEST_USER_ID }),
      createTestTask({ title: 'Other', userId: OTHER_USER_ID }),
    ]);

    const tasks = await getTasks();

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Mine');
    expect(tasks[0].userId).toBe(TEST_USER_ID);
  });

  it('returns a task by id when owned by the user', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Owned Task' }))
      .returning();

    const result = await getTaskById(task.id);

    expect(result).toBeDefined();
    expect(result?.id).toBe(task.id);
  });

  it('does not return tasks owned by another user', async () => {
    const [task] = await db
      .insert(schema.tasks)
      .values(createTestTask({ title: 'Other Task', userId: OTHER_USER_ID }))
      .returning();

    const result = await getTaskById(task.id);

    expect(result).toBeUndefined();

    const stored = await db.select().from(schema.tasks).where(eq(schema.tasks.id, task.id));
    expect(stored).toHaveLength(1);
  });
});
