import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { FollowUpNotificationGateway, NotificationPermissionState, ScheduledFollowUpNotification } from './followUpNotifications';

const notificationPermissionState = (status: { granted: boolean; canAskAgain: boolean }): NotificationPermissionState => {
  if (status.granted) return 'granted';
  return status.canAskAgain ? 'undetermined' : 'denied';
};

export const configureFollowUpNotifications = (): void => {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

export const expoFollowUpNotificationGateway: FollowUpNotificationGateway = {
  getPermission: async () => {
    if (Platform.OS === 'web') return 'unavailable';
    return notificationPermissionState(await Notifications.getPermissionsAsync());
  },
  cancel: async (notificationId) => {
    if (Platform.OS !== 'web') await Notifications.cancelScheduledNotificationAsync(notificationId);
  },
  schedule: async (notification: ScheduledFollowUpNotification) => {
    if (Platform.OS === 'web') throw new Error('การแจ้งเตือนในเครื่องใช้ได้บนแอป Android/iOS เท่านั้น');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('follow-ups', {
        name: 'นัดติดตามสวน',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: { activityId: notification.activityId, followUpOn: notification.followUpOn },
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: notification.triggerAt },
    });
  },
};

export const getFollowUpNotificationPermission = (): Promise<NotificationPermissionState> =>
  expoFollowUpNotificationGateway.getPermission();

export const requestFollowUpNotificationPermission = async (): Promise<NotificationPermissionState> => {
  if (Platform.OS === 'web') return 'unavailable';
  return notificationPermissionState(await Notifications.requestPermissionsAsync());
};
