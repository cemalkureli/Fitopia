/**
 * reminder.js — günlük antrenman hatırlatıcısı (lokal bildirim).
 * expo-notifications ile her gün seçilen saatte tetiklenir; tercih AsyncStorage'da.
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from './i18n';

const KEY = 'fitopia_reminder'; // { enabled, hour, minute }

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getReminder() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : { enabled: false, hour: 18, minute: 0 };
  } catch {
    return { enabled: false, hour: 18, minute: 0 };
  }
}

// Hatırlatıcıyı kur/kapat. Kurulumda izin ister; verilmezse false döner.
export async function setReminder(enabled, hour, minute, lang = 'tr') {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  if (enabled) {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    await Notifications.scheduleNotificationAsync({
      content: { title: t('reminderTitle', lang), body: t('reminderBody', lang) },
      trigger: { type: 'daily', hour, minute }, // her gün aynı saat
    });
  }
  await AsyncStorage.setItem(KEY, JSON.stringify({ enabled, hour, minute }));
  return true;
}
