/**
 * Browser Notification Utilities for Syntra
 *
 * Uses the Web Notifications API to deliver reminder and task notifications.
 * Scheduling is done via setTimeout (no service worker required).
 * Known limitation: notifications won't fire when the tab is closed.
 */

import type { OfflineReminder, OfflineTask } from '@/lib/offline-db';
import { db, generateId } from '@/lib/offline-db';

/* ─── Permission Helpers ─── */

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isNotificationGranted(): boolean {
  if (!isNotificationSupported()) return false;
  return Notification.permission === 'granted';
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

/* ─── Show & Schedule ─── */

export function showNotification(title: string, body: string, icon?: string): void {
  if (!isNotificationSupported() || !isNotificationGranted()) return;

  const notification = new Notification(title, {
    body,
    icon: icon || '/syntra-icon.png',
    badge: '/syntra-icon.png',
    tag: `syntra-${Date.now()}`,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };

  // Auto-close after 10 seconds
  setTimeout(() => {
    notification.close();
  }, 10000);

  // Note: We do NOT call storeInAppNotification() here anymore.
  // In-app notifications are already created by generateUpcomingNotifications()
  // for reminders/tasks, and by createInAppNotification() for other types.
  // Calling storeInAppNotification() here would create duplicates.
}

/**
 * Schedule a notification for a specific time.
 * If the scheduled time is in the past or now, shows immediately.
 * Returns the timeout ID so it can be cancelled, or null if shown immediately.
 */
export function scheduleNotification(
  title: string,
  body: string,
  scheduledTime: Date,
): number | null {
  if (!isNotificationSupported() || !isNotificationGranted()) return null;

  const now = Date.now();
  const scheduled = scheduledTime.getTime();

  if (scheduled <= now) {
    // Time has passed or is now — show immediately
    showNotification(title, body);
    return null;
  }

  const delay = scheduled - now;

  // Cap at 24 hours to avoid setTimeout overflow issues
  if (delay > 24 * 60 * 60 * 1000) {
    return null;
  }

  const timeoutId = window.setTimeout(() => {
    showNotification(title, body);
  }, delay);

  return timeoutId;
}

/**
 * Cancel a previously scheduled notification by its timeout ID.
 */
export function cancelScheduledNotification(timeoutId: number): void {
  window.clearTimeout(timeoutId);
}

/* ─── In-App Notification Storage ─── */

/**
 * REMOVED: storeInAppNotification() was previously called from showNotification()
 * to automatically store a browser notification as an in-app notification.
 * This caused duplicate notifications because generateUpcomingNotifications()
 * already creates in-app notifications for reminders/tasks, and
 * createInAppNotification() is used for other types.
 *
 * If you need to create an in-app notification, use createInAppNotification() directly.
 */

/**
 * Create an in-app notification directly (without browser notification).
 * Use this for system messages, achievements, streaks, etc.
 */
export async function createInAppNotification(params: {
  type: 'reminder' | 'task' | 'insight' | 'system' | 'achievement' | 'streak';
  title: string;
  body: string;
  icon?: string;
  actionType?: 'navigate' | 'chat' | 'none';
  actionData?: string;
}): Promise<string> {
  const id = generateId();
  await db.notifications.add({
    id,
    type: params.type,
    title: params.title,
    body: params.body,
    icon: params.icon || 'bell',
    read: false,
    actionType: params.actionType || 'none',
    actionData: params.actionData,
    createdAt: new Date(),
  });
  return id;
}

/* ─── Time Parsing ─── */

/**
 * Parse a reminder time string into a Date for today (or tomorrow if already passed).
 * Supports formats like: "8:00 AM", "2:00 PM", "8:00 AM daily", "14:30"
 * Returns null if the time string cannot be parsed.
 */
function parseReminderTime(timeStr: string): Date | null {
  if (!timeStr || !timeStr.trim()) return null;

  // Remove "daily", "weekly", "monthly" suffixes
  const cleaned = timeStr.replace(/\b(daily|weekly|monthly|every\s+day)\b/i, '').trim();

  // Try formats: "8:00 AM", "2:00 PM", "8 AM", "2 PM"
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
      // If the time has already passed today, schedule for tomorrow
      if (date.getTime() <= Date.now()) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }
  }

  // Try 24h format: "14:30", "8:00"
  const h24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);

    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const date = new Date();
      date.setHours(hours, minutes, 0, 0);
      if (date.getTime() <= Date.now()) {
        date.setDate(date.getDate() + 1);
      }
      return date;
    }
  }

  return null;
}

/**
 * Parse a task time string and combine with task date.
 * Task time can be like "9:00 AM", "14:30", etc.
 * Returns null if no valid time can be extracted.
 */
function parseTaskTime(dateStr: string, timeStr: string): Date | null {
  if (!timeStr || !timeStr.trim()) return null;

  // Parse the date portion (YYYY-MM-DD)
  const datePart = dateStr ? new Date(dateStr) : null;
  if (!datePart || isNaN(datePart.getTime())) return null;

  // Parse the time
  const parsedTime = parseReminderTime(timeStr);
  if (!parsedTime) return null;

  // Combine date from task with time from parsed
  const combined = new Date(datePart);
  combined.setHours(parsedTime.getHours(), parsedTime.getMinutes(), 0, 0);

  // Only return if in the future
  if (combined.getTime() <= Date.now()) return null;

  return combined;
}

/* ─── Batch Scheduling ─── */

/**
 * Schedule browser notifications for all active (non-completed) reminders.
 * Parses reminder times (e.g., "8:00 AM", "2:00 PM daily") and schedules
 * browser notifications accordingly.
 * Returns array of timeout IDs for cancellation.
 */
export function scheduleReminderNotifications(reminders: OfflineReminder[]): number[] {
  const timeoutIds: number[] = [];

  if (!isNotificationGranted()) return timeoutIds;

  for (const reminder of reminders) {
    if (reminder.completed) continue;

    const scheduledTime = parseReminderTime(reminder.time);
    if (!scheduledTime) continue;

    // Check recurring end date
    if (reminder.recurringEndDate) {
      const endDate = new Date(reminder.recurringEndDate);
      if (endDate < new Date()) continue; // Recurring period has ended
    }

    const title = 'Syntra Reminder';
    const body = reminder.title + (reminder.description ? ` — ${reminder.description}` : '');

    const tid = scheduleNotification(title, body, scheduledTime);
    if (tid !== null) {
      timeoutIds.push(tid);
    }
  }

  return timeoutIds;
}

/**
 * Schedule browser notifications for tasks that have times set.
 * Only schedules for today's tasks or future tasks with specific times.
 * Returns array of timeout IDs for cancellation.
 */
export function scheduleTaskNotifications(tasks: OfflineTask[]): number[] {
  const timeoutIds: number[] = [];

  if (!isNotificationGranted()) return timeoutIds;

  for (const task of tasks) {
    if (task.completed) continue;
    if (!task.time || !task.time.trim()) continue;

    const scheduledTime = parseTaskTime(task.date, task.time);
    if (!scheduledTime) continue;

    const title = 'Syntra Task';
    const body = task.title + (task.description ? ` — ${task.description}` : '');

    const tid = scheduleNotification(title, body, scheduledTime);
    if (tid !== null) {
      timeoutIds.push(tid);
    }
  }

  return timeoutIds;
}
