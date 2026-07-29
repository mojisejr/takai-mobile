import type { SqlExecutor } from '../../data';
import { localDateKey } from '../../date';
import { dayKey, formatThaiShortDate } from './date';
import { followUpDaysRemaining } from './followUp';

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export type ScheduledFollowUpNotification = {
  activityId: string;
  followUpOn: string;
  triggerAt: Date;
  title: string;
  body: string;
};

export type FollowUpNotificationGateway = {
  getPermission: () => Promise<NotificationPermissionState>;
  schedule: (notification: ScheduledFollowUpNotification) => Promise<string>;
  cancel: (notificationId: string) => Promise<void>;
};

type ReminderRow = { notification_id: string; follow_up_on: string };

export type FollowUpReminderSyncResult =
  | { status: 'scheduled'; notificationId: string }
  | { status: 'skipped'; reason: 'no_follow_up' | 'past_due' | 'permission_undetermined' | 'permission_denied' | 'unavailable' }
  | { status: 'failed'; error: string };

export const notificationTriggerAt = (followUpOn: string): Date => {
  const [year, month, day] = dayKey(followUpOn).split('-').map(Number);
  return new Date(year, month - 1, day, 8, 0, 0, 0);
};

export const canScheduleFollowUp = (followUpOn: string | null | undefined, today: string): boolean =>
  Boolean(followUpOn && followUpDaysRemaining(followUpOn, today) !== null && followUpDaysRemaining(followUpOn, today)! > 0);

const skipReasonForPermission = (permission: NotificationPermissionState): Extract<FollowUpReminderSyncResult, { status: 'skipped' }>['reason'] => {
  if (permission === 'granted') throw new Error('Granted permission does not have a skip reason');
  if (permission === 'denied') return 'permission_denied';
  if (permission === 'unavailable') return 'unavailable';
  return 'permission_undetermined';
};

const cancelExistingReminder = async (db: SqlExecutor, activityId: string, gateway: FollowUpNotificationGateway): Promise<void> => {
  const [existing] = await db.getAllAsync<ReminderRow>(
    'SELECT notification_id, follow_up_on FROM notification_reminders WHERE activity_id = ?',
    [activityId],
  );
  if (existing?.notification_id) {
    try {
      await gateway.cancel(existing.notification_id);
    } catch {
      // A notification may already have fired or been cleared by the OS. Its local row still must be cleared.
    }
  }
  await db.runAsync('DELETE FROM notification_reminders WHERE activity_id = ?', [activityId]);
};

/**
 * Replaces the single local reminder for one Activity. A nullable or non-future due date
 * cancels the old reminder instead of creating a stale one.
 */
export const syncFollowUpReminder = async (
  db: SqlExecutor,
  input: { activityId: string; followUpOn: string | null | undefined },
  gateway: FollowUpNotificationGateway,
  now = new Date(),
): Promise<FollowUpReminderSyncResult> => {
  const today = localDateKey(now);
  const followUpOn = input.followUpOn ? dayKey(input.followUpOn) : null;

  try {
    if (!followUpOn) {
      await cancelExistingReminder(db, input.activityId, gateway);
      return { status: 'skipped', reason: 'no_follow_up' };
    }
    if (!canScheduleFollowUp(followUpOn, today)) {
      await cancelExistingReminder(db, input.activityId, gateway);
      return { status: 'skipped', reason: 'past_due' };
    }

    const permission = await gateway.getPermission();
    if (permission !== 'granted') {
      await cancelExistingReminder(db, input.activityId, gateway);
      return { status: 'skipped', reason: skipReasonForPermission(permission) };
    }

    await cancelExistingReminder(db, input.activityId, gateway);
    const notificationId = await gateway.schedule({
      activityId: input.activityId,
      followUpOn,
      triggerAt: notificationTriggerAt(followUpOn),
      title: 'ถึงวันติดตามสวน',
      body: `นัดไว้ ${formatThaiShortDate(followUpOn)} · เปิดตาไก๊เพื่อบันทึกผล`,
    });
    await db.runAsync(
      `INSERT INTO notification_reminders (activity_id, notification_id, follow_up_on, scheduled_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(activity_id) DO UPDATE SET
         notification_id = excluded.notification_id,
         follow_up_on = excluded.follow_up_on,
         scheduled_at = excluded.scheduled_at`,
      [input.activityId, notificationId, followUpOn, now.toISOString()],
    );
    return { status: 'scheduled', notificationId };
  } catch (error) {
    return { status: 'failed', error: error instanceof Error ? error.message : 'ตั้งการแจ้งเตือนไม่สำเร็จ' };
  }
};
