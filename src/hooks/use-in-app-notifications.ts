'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db, generateId } from '@/lib/offline-db';
import type { OfflineNotification } from '@/lib/offline-db';

interface UseInAppNotificationsReturn {
  notifications: OfflineNotification[];
  unreadCount: number;
  loading: boolean;
  addNotification: (notification: Omit<OfflineNotification, 'id' | 'createdAt'>) => Promise<string>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useInAppNotifications(): UseInAppNotificationsReturn {
  const [notifications, setNotifications] = useState<OfflineNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const all = await db.notifications
        .orderBy('createdAt')
        .reverse()
        .toArray();
      setNotifications(all);
    } catch (error) {
      console.error('[useInAppNotifications] Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for new notifications every 30 seconds (lightweight check)
  useEffect(() => {
    refreshTimerRef.current = setInterval(refresh, 30000);
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [refresh]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const addNotification = useCallback(async (
    notification: Omit<OfflineNotification, 'id' | 'createdAt'>
  ): Promise<string> => {
    const id = generateId();
    const newNotification: OfflineNotification = {
      ...notification,
      id,
      createdAt: new Date(),
    };
    await db.notifications.add(newNotification);
    // Refresh to update state
    await refresh();
    return id;
  }, [refresh]);

  const markAsRead = useCallback(async (id: string) => {
    await db.notifications.update(id, { read: true });
    await refresh();
  }, [refresh]);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await db.notifications.where('id').anyOf(unreadIds).modify({ read: true });
    await refresh();
  }, [notifications, refresh]);

  const deleteNotification = useCallback(async (id: string) => {
    await db.notifications.delete(id);
    await refresh();
  }, [refresh]);

  const clearAll = useCallback(async () => {
    await db.notifications.clear();
    await refresh();
  }, [refresh]);

  return {
    notifications,
    unreadCount,
    loading,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  };
}
