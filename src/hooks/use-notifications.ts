'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, formatTime12 } from '@/lib/offline-db';
import type { OfflineReminder, OfflineTask } from '@/lib/offline-db';
import { createInAppNotification } from '@/lib/notifications';

type PermissionStatus = 'granted' | 'denied' | 'default' | 'unsupported';

interface UseNotificationsReturn {
  permissionStatus: PermissionStatus;
  requestPermission: () => Promise<PermissionStatus>;
  scheduleAll: () => Promise<void>;
  clearAll: () => Promise<void>;
}

function getInitialPermissionStatus(): PermissionStatus {
  if (typeof window === 'undefined') return 'default';
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as PermissionStatus;
}

export function useNotifications(): UseNotificationsReturn {
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>(getInitialPermissionStatus);
  const scheduledTimeoutsRef = useRef<number[]>([]);
  const initializedRef = useRef(false);

  // Initialize on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Browser: check current permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission as PermissionStatus);
    }
  }, []);

  // Request permission (browser only)
  const requestPerm = useCallback(async (): Promise<PermissionStatus> => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      setPermissionStatus(result as PermissionStatus);
      return result as PermissionStatus;
    } catch {
      return 'denied';
    }
  }, []);

  // Clear all scheduled notifications
  const clearAll = useCallback(async () => {
    // Clear tracked timeout IDs (browser)
    for (const tid of scheduledTimeoutsRef.current) {
      window.clearTimeout(tid);
    }
    scheduledTimeoutsRef.current = [];
  }, []);

  // Schedule all pending reminder/task notifications from IndexedDB
  const scheduleAll = useCallback(async () => {
    // Clear previously scheduled notifications
    await clearAll();

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    try {
      // Check if user has disabled notifications in settings
      const settings = await db.settings.get('default');
      if (settings && settings.notifications === false) return;

      // Read all reminders and tasks from IndexedDB
      const allReminders: OfflineReminder[] = await db.reminders.toArray();
      const allTasks: OfflineTask[] = await db.tasks.toArray();

      // Browser: use setTimeout-based scheduling
      const { scheduleReminderNotifications, scheduleTaskNotifications } = await import('@/lib/notifications');
      const reminderTimeouts = scheduleReminderNotifications(allReminders);
      const taskTimeouts = scheduleTaskNotifications(allTasks);
      scheduledTimeoutsRef.current = [...reminderTimeouts, ...taskTimeouts];

      // Generate in-app notifications for upcoming reminders/tasks
      await generateUpcomingNotifications(allReminders, allTasks);
    } catch (error) {
      console.error('[useNotifications] Failed to schedule notifications:', error);
    }
  }, [clearAll]);

  // Auto-schedule when permission is granted
  useEffect(() => {
    if (permissionStatus === 'granted') {
      scheduleAll();
    }
    // Cleanup on unmount
    return () => {
      clearAll();
    };
  }, [permissionStatus, scheduleAll, clearAll]);

  return {
    permissionStatus,
    requestPermission: requestPerm,
    scheduleAll,
    clearAll,
  };
}

/* ─── Generate In-App Notifications for Upcoming Items ─── */

async function generateUpcomingNotifications(reminders: OfflineReminder[], tasks: OfflineTask[]): Promise<void> {
  try {
    // Check if we already generated notifications in this session
    const sessionKey = 'syntra_notifications_generated_' + new Date().toISOString().split('T')[0];
    if (typeof window !== 'undefined' && sessionStorage.getItem(sessionKey)) return;

    const activeReminders = reminders.filter(r => !r.completed);
    const activeTasks = tasks.filter(t => !t.completed);

    // Generate notification for each active reminder
    for (const reminder of activeReminders.slice(0, 5)) {
      // Check if a notification for this reminder already exists (by title match)
      const existing = await db.notifications
        .where('type')
        .equals('reminder')
        .toArray();
      const alreadyExists = existing.some(n => n.title === reminder.title && n.body.includes(reminder.title));
      if (alreadyExists) continue;

      await createInAppNotification({
        type: 'reminder',
        title: reminder.title,
        body: reminder.description || `Reminder scheduled for ${formatTime12(reminder.time) || 'today'}`,
        icon: 'calendar-check',
        actionType: 'navigate',
        actionData: JSON.stringify({ screen: 'planner' }),
      });
    }

    // Generate notification for each active task due today
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const todayTasks = activeTasks.filter(t => t.date === today);
    for (const task of todayTasks.slice(0, 5)) {
      const existing = await db.notifications
        .where('type')
        .equals('task')
        .toArray();
      const alreadyExists = existing.some(n => n.title === task.title && n.body.includes(task.title));
      if (alreadyExists) continue;

      await createInAppNotification({
        type: 'task',
        title: task.title,
        body: task.description || `Task due today${task.time ? ` at ${formatTime12(task.time)}` : ''}`,
        icon: 'check',
        actionType: 'navigate',
        actionData: JSON.stringify({ screen: 'planner' }),
      });
    }

    // Mark session as done
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(sessionKey, '1');
    }
  } catch (error) {
    console.error('[useNotifications] Failed to generate in-app notifications:', error);
  }
}

/* ─── Seed Welcome Notification ─── */

export async function seedWelcomeNotification(): Promise<void> {
  try {
    const existingCount = await db.notifications.count();
    if (existingCount > 0) return; // Already has notifications

    await createInAppNotification({
      type: 'system',
      title: 'Welcome to Syntra',
      body: 'Your personal AI companion is ready. Set up reminders, track tasks, and chat with your assistant to get started.',
      icon: 'sparkles',
      actionType: 'none',
    });
  } catch (error) {
    console.error('[useNotifications] Failed to seed welcome notification:', error);
  }
}
