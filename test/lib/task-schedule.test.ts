import 'temporal-polyfill/global';
import { describe, it, expect } from 'vitest';
import { buildTaskSchedule, type TaskWithRecurrence } from '@/lib/task-schedule';

function createTask(overrides: Partial<TaskWithRecurrence> = {}): TaskWithRecurrence {
  return {
    id: 1,
    userId: 'test-user',
    title: 'Test Task',
    description: null,
    location: null,
    dueAt: new Date('2026-02-01T12:00:00Z'),
    startAt: null,
    durationMinutes: null,
    priority: 'medium',
    status: 'pending',
    completedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    recurrenceRule: null,
    ...overrides,
  };
}

describe('buildTaskSchedule', () => {
  it('falls back to the base task when RRULE is invalid', () => {
    const task = createTask({ recurrenceRule: 'NOT_AN_RRULE' });

    const { scheduleEvents, occurrenceOverrides } = buildTaskSchedule([task], 'UTC');

    expect(scheduleEvents).toHaveLength(1);
    expect(scheduleEvents[0].id).toBe(`task-${task.id}`);
    expect(occurrenceOverrides.get(`task-${task.id}`)?.startAt).toEqual(task.dueAt);
    expect(occurrenceOverrides.get(`task-${task.id}`)?.endAt).toEqual(task.dueAt);
  });

  it('stores occurrence overrides for recurring tasks', () => {
    const startAt = new Date('2026-02-01T08:00:00Z');
    const task = createTask({
      id: 7,
      startAt,
      durationMinutes: 90,
      dueAt: new Date('2026-02-01T09:30:00Z'),
      recurrenceRule: 'FREQ=WEEKLY;COUNT=2',
    });

    const { scheduleEvents, occurrenceOverrides } = buildTaskSchedule([task], 'UTC');

    expect(scheduleEvents).toHaveLength(2);

    const occurrenceId = `task-${task.id}-occ-${startAt.getTime()}`;
    const override = occurrenceOverrides.get(occurrenceId);
    expect(override).toBeDefined();
    expect(override?.startAt).toEqual(startAt);
    expect(override?.endAt).toEqual(new Date(startAt.getTime() + 90 * 60000));
  });
});
