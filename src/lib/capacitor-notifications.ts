/**
 * Capacitor Notification Service — Web-only stub
 * 
 * In the web version, Capacitor is not available.
 * All notification functionality falls back to browser Web Notifications.
 */

import type { OfflineReminder, OfflineTask } from '@/lib/offline-db';

/* ─── Platform Detection ─── */

export function isCapacitorNative(): boolean {
  return false;
}

export function isCapacitorAndroid(): boolean {
  return false;
}

/* ─── Permission Helpers ─── */

export type NotificationPermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export async function isNotificationSupported(): Promise<boolean> {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function isNotificationGranted(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  return Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<NotificationPermissionStatus> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  const result = await Notification.requestPermission();
  return result as NotificationPermissionStatus;
}

/* ─── Browser Notification Scheduling ─── */

function parseReminderTime(timeStr: string): Date | null {
  if (!timeStr || !timeStr.trim()) return null;
  const cleaned = timeStr.replace(/\b(daily|weekly|monthly|every\s+day)\b/i, '').trim();
  const ampmMatch = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const period = ampmMatch[3].toLowerCase();
    if (period === 'am' && hours === 12) hours = 0;
    if (period === 'pm' && hours !== 12) hours += 12;
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
      return date;
    }
  }
  const h24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
      return date;
    }
  }
  return null;
}

function showBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const notification = new Notification(title, { body, tag: `syntra-${Date.now()}` });
  notification.onclick = () => { window.focus(); notification.close(); };
  setTimeout(() => notification.close(), 10000);
}

/* ─── Full Initialization ─── */

export async function initializeNotifications(): Promise<NotificationPermissionStatus> {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    return Notification.permission as NotificationPermissionStatus;
  }
  return 'unsupported';
}

export async function cancelAllScheduledNotifications(): Promise<void> {
  // No-op in web — handled by useNotifications hook
}

export async function scheduleAllNotifications(
  reminders: OfflineReminder[],
  tasks: OfflineTask[],
): Promise<number[]> {
  // Handled by browser-based useNotifications hook using setTimeout
  return [];
}

export async function scheduleReminderNotifications(reminders: OfflineReminder[]): Promise<number[]> {
  return [];
}

export async function scheduleTaskNotifications(tasks: OfflineTask[]): Promise<number[]> {
  return [];
}
