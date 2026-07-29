import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { SqlExecutor } from '../src/data';
import {
  canScheduleFollowUp,
  notificationTriggerAt,
  syncFollowUpReminder,
  type FollowUpNotificationGateway,
  type NotificationPermissionState,
} from '../src/features/operations';

type ReminderRow = { notification_id: string; follow_up_on: string };

class ReminderDb implements SqlExecutor {
  reminders = new Map<string, ReminderRow>();

  async execAsync(): Promise<void> {}

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes('FROM notification_reminders')) {
      const row = this.reminders.get(String(params[0]));
      return row ? [row as T] : [];
    }
    return [];
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<unknown> {
    if (sql.startsWith('DELETE FROM notification_reminders')) {
      this.reminders.delete(String(params[0]));
      return;
    }
    if (sql.includes('INSERT INTO notification_reminders')) {
      this.reminders.set(String(params[0]), { notification_id: String(params[1]), follow_up_on: String(params[2]) });
    }
  }
}

const gateway = (permission: NotificationPermissionState) => {
  const scheduled: string[] = [];
  const cancelled: string[] = [];
  let serial = 0;
  const value: FollowUpNotificationGateway = {
    getPermission: async () => permission,
    schedule: async () => {
      serial += 1;
      const id = `notification-${serial}`;
      scheduled.push(id);
      return id;
    },
    cancel: async (id) => { cancelled.push(id); },
  };
  return { value, scheduled, cancelled };
};

const now = new Date(2026, 6, 16, 9, 0, 0);

const main = async (): Promise<void> => {
  assert.equal(canScheduleFollowUp(null, '2026-07-16'), false, 'null dates must never schedule');
  assert.equal(canScheduleFollowUp('2026-07-16', '2026-07-16'), false, 'due-today reminders are not scheduled late');
  assert.equal(canScheduleFollowUp('2026-07-15', '2026-07-16'), false, 'past dates must never schedule');
  assert.equal(canScheduleFollowUp('2026-07-17', '2026-07-16'), true, 'future canonical due dates are schedulable');
  const trigger = notificationTriggerAt('2026-07-20');
  assert.deepEqual([trigger.getFullYear(), trigger.getMonth() + 1, trigger.getDate(), trigger.getHours(), trigger.getMinutes()], [2026, 7, 20, 8, 0], 'notification trigger keeps the local calendar due date');

  const db = new ReminderDb();
  const granted = gateway('granted');
  const created = await syncFollowUpReminder(db, { activityId: 'activity-a', followUpOn: '2026-07-20' }, granted.value, now);
  assert.equal(created.status, 'scheduled');
  assert.equal(granted.scheduled.length, 1);
  assert.equal(db.reminders.get('activity-a')?.follow_up_on, '2026-07-20');

  await syncFollowUpReminder(db, { activityId: 'activity-a', followUpOn: '2026-07-21' }, granted.value, now);
  assert.deepEqual(granted.cancelled, ['notification-1'], 'rescheduling cancels the old reminder before retaining one replacement');
  assert.equal(db.reminders.get('activity-a')?.follow_up_on, '2026-07-21');

  const cleared = await syncFollowUpReminder(db, { activityId: 'activity-a', followUpOn: null }, granted.value, now);
  assert.deepEqual(cleared, { status: 'skipped', reason: 'no_follow_up' });
  assert.equal(db.reminders.has('activity-a'), false, 'clearing a follow-up removes its scheduled reminder row');
  assert.deepEqual(granted.cancelled, ['notification-1', 'notification-2']);

  const denied = gateway('denied');
  const deniedResult = await syncFollowUpReminder(db, { activityId: 'activity-denied', followUpOn: '2026-07-20' }, denied.value, now);
  assert.deepEqual(deniedResult, { status: 'skipped', reason: 'permission_denied' }, 'permission denial remains a safe saved-activity state');
  assert.equal(denied.scheduled.length, 0);

  const past = gateway('granted');
  const pastResult = await syncFollowUpReminder(db, { activityId: 'activity-past', followUpOn: '2026-07-15' }, past.value, now);
  assert.deepEqual(pastResult, { status: 'skipped', reason: 'past_due' });
  assert.equal(past.scheduled.length, 0);

  const screen = await readFile(resolve(process.cwd(), 'src/features/operations/OperationalSliceScreen.tsx'), 'utf8');
  const expoAdapter = await readFile(resolve(process.cwd(), 'src/features/operations/expoNotifications.ts'), 'utf8');
  assert.ok(screen.includes('เปิดการแจ้งเตือนวันติดตาม') && screen.includes('syncFollowUpReminder'), 'permission request must be intentional and schedule only after Activity save');
  assert.ok(expoAdapter.includes('setNotificationChannelAsync') && expoAdapter.includes('scheduleNotificationAsync'), 'native adapter must configure Android channel and use Expo local scheduling');
  console.log('FOLLOW_UP_NOTIFICATION_CONTRACT_PASS: canonical due scheduling, idempotent cancellation, permission denial, null, and past-date guards are valid');
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
