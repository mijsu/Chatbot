'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  db,
  generateId,
  initializeDefaults,
  type OfflineTask,
  type OfflineReminder,
  type OfflineConversation,
  type OfflineMessage,
  type OfflineUserProfile,
  type OfflineUserSettings,
  type OfflineGoal,
  type OfflineHabit,
  type OfflineMoodEntry,
  type OfflineFocusSession,
} from '@/lib/offline-db';

function formatDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ═══════════════════════════════════════════════════════════════════
   Generic data loader hook pattern — avoids setState-in-effect lint
   ═══════════════════════════════════════════════════════════════════ */

function useAsyncData<T>(loader: () => Promise<T>, initialValue: T, deps: React.DependencyList) {
  const [data, setData] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const thisRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await loader();
      if (requestIdRef.current === thisRequestId) setData(result);
    } catch (err) {
      if (requestIdRef.current === thisRequestId) {
        setData(initialValue);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (requestIdRef.current === thisRequestId) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    load();
  }, [load]);

  return { data, setData, loading, error, load };
}

/* ═══════════════════════════════════════════════════════════════════
   TASKS
   ═══════════════════════════════════════════════════════════════════ */

function sortTasks(result: OfflineTask[]) {
  result.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return result;
}

export function useOfflineTasks(date?: string) {
  const { data: tasks, loading, load: reloadTasks } = useAsyncData<OfflineTask[]>(
    async () => {
      if (date) {
        const result = await db.tasks.where('date').equals(date).sortBy('createdAt');
        return sortTasks(result);
      }
      const result = await db.tasks.toArray();
      return sortTasks(result);
    },
    [],
    [date]
  );

  const addTask = useCallback(async (task: Omit<OfflineTask, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newTask: OfflineTask = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    await db.tasks.add(newTask);
    await reloadTasks();
    return newTask;
  }, [reloadTasks]);

  const updateTask = useCallback(async (id: string, updates: Partial<OfflineTask>) => {
    await db.tasks.update(id, { ...updates, updatedAt: new Date() });
    await reloadTasks();
  }, [reloadTasks]);

  const deleteTask = useCallback(async (id: string) => {
    await db.tasks.delete(id);
    await reloadTasks();
  }, [reloadTasks]);

  const toggleTaskComplete = useCallback(async (id: string, currentCompleted: boolean) => {
    await db.tasks.update(id, { completed: !currentCompleted, updatedAt: new Date() });
    await reloadTasks();
  }, [reloadTasks]);

  const clearAllTasks = useCallback(async () => {
    await db.tasks.clear();
    await reloadTasks();
  }, [reloadTasks]);

  const deleteCompletedTasks = useCallback(async () => {
    const allTasks = await db.tasks.toArray();
    const completedIds = allTasks.filter(t => t.completed).map(t => t.id);
    await db.tasks.bulkDelete(completedIds);
    await reloadTasks();
  }, [reloadTasks]);

  const deleteTodayTasks = useCallback(async () => {
    const today = formatDateLocal(new Date());
    await db.tasks.where('date').equals(today).delete();
    await reloadTasks();
  }, [reloadTasks]);

  const deletePastTasks = useCallback(async () => {
    const today = formatDateLocal(new Date());
    const allTasks = await db.tasks.toArray();
    const pastIds = allTasks.filter(t => t.date < today).map(t => t.id);
    await db.tasks.bulkDelete(pastIds);
    await reloadTasks();
  }, [reloadTasks]);

  return { tasks, loading, addTask, updateTask, deleteTask, toggleTaskComplete, clearAllTasks, deleteCompletedTasks, deleteTodayTasks, deletePastTasks, reload: reloadTasks };
}

export function useOfflineMonthTasks(monthKey?: string) {
  const { data: monthTasks, load: reloadMonthTasks } = useAsyncData<OfflineTask[]>(
    async () => {
      if (!monthKey) return [];
      const [yearStr, monthStr] = monthKey.split('-');
      const year = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      const startDate = `${year}-${String(m).padStart(2, '0')}-01`;
      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      return await db.tasks.where('date').between(startDate, endDate, true, false).toArray();
    },
    [],
    [monthKey]
  );

  return { monthTasks, reload: reloadMonthTasks };
}

/* ═══════════════════════════════════════════════════════════════════
   REMINDERS
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineReminders() {
  const { data: reminders, loading, load: reloadReminders } = useAsyncData<OfflineReminder[]>(
    async () => {
      const result = await db.reminders.toArray();
      result.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return result;
    },
    [],
    []
  );

  const addReminder = useCallback(async (reminder: Omit<OfflineReminder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newReminder: OfflineReminder = { ...reminder, id: generateId(), createdAt: now, updatedAt: now };
    await db.reminders.add(newReminder);
    await reloadReminders();
    return newReminder;
  }, [reloadReminders]);

  const updateReminder = useCallback(async (id: string, updates: Partial<OfflineReminder>) => {
    await db.reminders.update(id, { ...updates, updatedAt: new Date() });
    await reloadReminders();
  }, [reloadReminders]);

  const deleteReminder = useCallback(async (id: string) => {
    await db.reminders.delete(id);
    await reloadReminders();
  }, [reloadReminders]);

  const toggleReminderComplete = useCallback(async (id: string, currentCompleted: boolean) => {
    await db.reminders.update(id, { completed: !currentCompleted, updatedAt: new Date() });
    await reloadReminders();
  }, [reloadReminders]);

  const clearAllReminders = useCallback(async () => {
    await db.reminders.clear();
    await reloadReminders();
  }, [reloadReminders]);

  const deleteCompletedReminders = useCallback(async () => {
    const allReminders = await db.reminders.toArray();
    const completedIds = allReminders.filter(r => r.completed).map(r => r.id);
    await db.reminders.bulkDelete(completedIds);
    await reloadReminders();
  }, [reloadReminders]);

  const deleteRecurringReminders = useCallback(async () => {
    const allReminders = await db.reminders.toArray();
    const recurringIds = allReminders.filter(r => r.recurring && r.recurring !== '').map(r => r.id);
    await db.reminders.bulkDelete(recurringIds);
    await reloadReminders();
  }, [reloadReminders]);

  const deleteOneTimeReminders = useCallback(async () => {
    const allReminders = await db.reminders.toArray();
    const oneTimeIds = allReminders.filter(r => !r.recurring || r.recurring === '').map(r => r.id);
    await db.reminders.bulkDelete(oneTimeIds);
    await reloadReminders();
  }, [reloadReminders]);

  return { reminders, loading, addReminder, updateReminder, deleteReminder, toggleReminderComplete, clearAllReminders, deleteCompletedReminders, deleteRecurringReminders, deleteOneTimeReminders, reload: reloadReminders };
}

/* ═══════════════════════════════════════════════════════════════════
   CONVERSATIONS & MESSAGES
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineConversations() {
  const { data: conversations, loading, load: reloadConversations } = useAsyncData<OfflineConversation[]>(
    async () => {
      const result = await db.conversations.toArray();
      result.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
      return result;
    },
    [],
    []
  );

  const addConversation = useCallback(async (conv: Omit<OfflineConversation, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newConv: OfflineConversation = { ...conv, id: generateId(), createdAt: now, updatedAt: now };
    await db.conversations.add(newConv);
    await reloadConversations();
    return newConv;
  }, [reloadConversations]);

  const updateConversation = useCallback(async (id: string, updates: Partial<OfflineConversation>) => {
    await db.conversations.update(id, { ...updates, updatedAt: new Date() });
    await reloadConversations();
  }, [reloadConversations]);

  const deleteConversation = useCallback(async (id: string) => {
    await db.messages.where('conversationId').equals(id).delete();
    await db.conversationMemories.where('conversationId').equals(id).delete();
    await db.conversations.delete(id);
    await reloadConversations();
  }, [reloadConversations]);

  const getConversationPreview = useCallback(async (conversationId: string): Promise<string> => {
    const msgs = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .reverse()
      .sortBy('createdAt');
    return msgs[0]?.content || '';
  }, []);

  const clearAllConversations = useCallback(async () => {
    await db.messages.clear();
    await db.conversations.clear();
    await db.conversationMemories.clear();
    await reloadConversations();
  }, [reloadConversations]);

  const deleteUnpinnedConversations = useCallback(async () => {
    const allConvs = await db.conversations.toArray();
    const unpinnedIds = allConvs.filter(c => !c.pinned).map(c => c.id);
    await db.messages.where('conversationId').anyOf(unpinnedIds).delete();
    await db.conversationMemories.where('conversationId').anyOf(unpinnedIds).delete();
    await db.conversations.bulkDelete(unpinnedIds);
    await reloadConversations();
  }, [reloadConversations]);

  return {
    conversations,
    loading,
    addConversation,
    updateConversation,
    deleteConversation,
    getConversationPreview,
    clearAllConversations,
    deleteUnpinnedConversations,
    reload: reloadConversations,
  };
}

export function useOfflineMessages(conversationId?: string) {
  const { data: messages, load: reloadMessages } = useAsyncData<OfflineMessage[]>(
    async () => {
      if (!conversationId) return [];
      return await db.messages.where('conversationId').equals(conversationId).sortBy('createdAt');
    },
    [],
    [conversationId]
  );

  const addMessage = useCallback(async (msg: Omit<OfflineMessage, 'id' | 'createdAt'>) => {
    const newMsg: OfflineMessage = { ...msg, id: generateId(), createdAt: new Date() };
    await db.messages.add(newMsg);
    if (msg.conversationId) {
      await db.conversations.update(msg.conversationId, { updatedAt: new Date() });
    }
    await reloadMessages();
    return newMsg;
  }, [reloadMessages]);

  return { messages, addMessage, reload: reloadMessages };
}

/* ═══════════════════════════════════════════════════════════════════
   PROFILE
   ═══════════════════════════════════════════════════════════════════ */

const defaultProfile: OfflineUserProfile = {
  id: 'default',
  name: '',
  status: '',
  aboutMe: '',
  language: 'en',
  updatedAt: new Date(),
};

export function useOfflineProfile() {
  const { data: profile, loading, load: reloadProfile } = useAsyncData<OfflineUserProfile>(
    async () => {
      await initializeDefaults();
      const result = await db.profile.get('default');
      return result || defaultProfile;
    },
    defaultProfile,
    []
  );

  const updateProfile = useCallback(async (updates: Partial<OfflineUserProfile>) => {
    await db.profile.update('default', { ...updates, updatedAt: new Date() });
    await reloadProfile();
  }, [reloadProfile]);

  return { profile, loading, updateProfile, reload: reloadProfile };
}

/* ═══════════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════════ */

const defaultSettings: OfflineUserSettings = {
  id: 'default',
  notifications: true,
  darkMode: true,
  privateMode: false,
  locationServices: false,
  passwordHash: '',
  voiceTone: 'friendly',
  role: '',
  interests: '',
  deepContextMode: true,
  updatedAt: new Date(),
};

export function useOfflineSettings() {
  const { data: settings, loading, load: reloadSettings } = useAsyncData<OfflineUserSettings>(
    async () => {
      await initializeDefaults();
      const result = await db.settings.get('default');
      return result || defaultSettings;
    },
    defaultSettings,
    []
  );

  const updateSettings = useCallback(async (updates: Partial<OfflineUserSettings>) => {
    await db.settings.update('default', { ...updates, updatedAt: new Date() });
    await reloadSettings();
  }, [reloadSettings]);

  return { settings, loading, updateSettings, reload: reloadSettings };
}

/* ═══════════════════════════════════════════════════════════════════
   STATS (computed from other data)
   ═══════════════════════════════════════════════════════════════════ */

const defaultStats = { tasks: 0, meetings: 0, reminders: 0, percentage: 0 };

export function useOfflineStats() {
  const { data: stats, loading, load: reloadStats } = useAsyncData(
    async () => {
      const today = formatDateLocal(new Date());

      // ── Tasks ──
      const allTasks = await db.tasks.where('date').equals(today).toArray();
      const totalTasks = allTasks.length;
      const completedTasks = allTasks.filter((t) => t.completed).length;
      const pendingTasks = totalTasks - completedTasks;
      const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // ── Reminders ──
      const allReminders = await db.reminders.toArray();
      const activeReminders = allReminders.filter(r => !r.completed).length;

      // ── Habits ──
      const allHabits = await db.habits.toArray();
      const dailyHabits = allHabits.filter(h => h.frequency === 'daily' || !h.frequency);
      const habitsDone = dailyHabits.filter(h => h.lastCompletedDate === today).length;
      const habitPct = dailyHabits.length > 0 ? Math.round((habitsDone / dailyHabits.length) * 100) : 0;

      // ── Goals ──
      const allGoals = await db.goals.toArray();
      const activeGoals = allGoals.filter(g => !g.completed && g.progress < 100);
      const goalPct = activeGoals.length > 0
        ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length)
        : (allGoals.length > 0 ? 100 : 0);

      // ── Overall percentage — weighted average across all categories with data ──
      const weights: { pct: number; weight: number }[] = [];
      if (totalTasks > 0) weights.push({ pct: taskPct, weight: 3 }); // Tasks are most important
      if (dailyHabits.length > 0) weights.push({ pct: habitPct, weight: 2 });
      if (allGoals.length > 0) weights.push({ pct: goalPct, weight: 1 });

      const percentage = weights.length > 0
        ? Math.round(weights.reduce((sum, w) => sum + w.pct * w.weight, 0) / weights.reduce((sum, w) => sum + w.weight, 0))
        : 0;

      return {
        tasks: totalTasks,
        meetings: Math.min(pendingTasks, 3),
        reminders: activeReminders,
        percentage,
      };
    },
    defaultStats,
    []
  );

  return { stats, loading, reload: reloadStats };
}

/* ═══════════════════════════════════════════════════════════════════
   TODAY TASKS (for home screen)
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineTodayTasks() {
  const { data: todayTasks, load: reloadTodayTasks } = useAsyncData<OfflineTask[]>(
    async () => {
      const today = formatDateLocal(new Date());
      const allTasks = await db.tasks.where('date').equals(today).toArray();
      return allTasks
        .filter((t) => !t.completed)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6);
    },
    [],
    []
  );

  return { todayTasks, reload: reloadTodayTasks };
}

/* ═══════════════════════════════════════════════════════════════════
   FACTORY RESET — Clear ALL data
   ═══════════════════════════════════════════════════════════════════ */

export async function factoryReset(): Promise<void> {
  await db.tasks.clear();
  await db.reminders.clear();
  await db.messages.clear();
  await db.conversations.clear();
  await db.profile.clear();
  await db.settings.clear();
  await db.goals.clear();
  await db.habits.clear();
  await db.moods.clear();
  // Phase 2: Clear memory & intelligence tables
  await db.conversationMemories.clear();
  await db.globalMemories.clear();
  await db.insightLog.clear();
  await db.contextCache.clear();
  // Phase 3: Clear notifications table
  await db.notifications.clear();
  // Phase 4: Clear focus sessions & achievements tables
  await db.focusSessions.clear();
  await db.achievements.clear();
  await initializeDefaults();

  // Clear localStorage caches (daily summary, AI suggestions, dynamic content, mood cache)
  try {
    localStorage.removeItem('syntra_daily_summary_cache');
    localStorage.removeItem('syntra_ai_suggestions_cache');
    localStorage.removeItem('syntra_ai_dynamic_content');
    localStorage.removeItem('syntra_ai_full_content');
    localStorage.removeItem('syntra_mood_cache');
  } catch {
    /* localStorage unavailable */
  }
}

/* ═══════════════════════════════════════════════════════════════════
   GOALS
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineGoals() {
  const { data: goals, loading, load: reloadGoals } = useAsyncData<OfflineGoal[]>(
    async () => {
      const result = await db.goals.toArray();
      result.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return result;
    },
    [],
    []
  );

  const addGoal = useCallback(async (goal: Omit<OfflineGoal, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newGoal: OfflineGoal = { ...goal, id: generateId(), createdAt: now, updatedAt: now };
    await db.goals.add(newGoal);
    await reloadGoals();
    return newGoal;
  }, [reloadGoals]);

  const updateGoal = useCallback(async (id: string, updates: Partial<OfflineGoal>) => {
    await db.goals.update(id, { ...updates, updatedAt: new Date() });
    await reloadGoals();
  }, [reloadGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    await db.goals.delete(id);
    await reloadGoals();
  }, [reloadGoals]);

  return { goals, loading, addGoal, updateGoal, deleteGoal, reload: reloadGoals };
}

/* ═══════════════════════════════════════════════════════════════════
   HABITS
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Calculate consecutive day streak from a sorted completion history.
 * A streak counts consecutive days ending at today.
 */
function calculateStreakFromHistory(historyDates: string[]): number {
  if (historyDates.length === 0) return 0;

  const sorted = [...historyDates].sort().reverse(); // Most recent first
  const today = formatDateLocal(new Date());

  // Streak must include today or yesterday to be valid
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatDateLocal(d);
  })();

  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(sorted[i - 1]);
    const currDate = new Date(sorted[i]);
    const diffDays = Math.round((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function useOfflineHabits() {
  const { data: habits, loading, load: reloadHabits } = useAsyncData<OfflineHabit[]>(
    async () => {
      const result = await db.habits.toArray();
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return result;
    },
    [],
    []
  );

  const addHabit = useCallback(async (habit: Omit<OfflineHabit, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date();
    const newHabit: OfflineHabit = {
      ...habit,
      completionHistory: habit.completionHistory || '',
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    };
    await db.habits.add(newHabit);
    await reloadHabits();
    return newHabit;
  }, [reloadHabits]);

  const toggleHabitToday = useCallback(async (id: string, lastDate: string) => {
    const today = formatDateLocal(new Date());
    const habit = await db.habits.get(id);
    if (!habit) return;

    const history = habit.completionHistory ? habit.completionHistory.split(',').filter(Boolean) : [];

    if (lastDate === today) {
      // Already completed today — undo
      const updatedHistory = history.filter((d: string) => d !== today);
      // Recalculate streak from history
      const newStreak = calculateStreakFromHistory(updatedHistory);
      await db.habits.update(id, {
        streak: newStreak,
        lastCompletedDate: updatedHistory.length > 0 ? updatedHistory[updatedHistory.length - 1] : '',
        completionHistory: updatedHistory.join(','),
        updatedAt: new Date(),
      });
    } else {
      // Complete today
      if (!history.includes(today)) {
        history.push(today);
      }
      // Recalculate streak from history
      const newStreak = calculateStreakFromHistory(history);
      await db.habits.update(id, {
        streak: newStreak,
        lastCompletedDate: today,
        completionHistory: history.join(','),
        updatedAt: new Date(),
      });
    }
    await reloadHabits();
  }, [reloadHabits]);

  const deleteHabit = useCallback(async (id: string) => {
    await db.habits.delete(id);
    await reloadHabits();
  }, [reloadHabits]);

  return { habits, loading, addHabit, toggleHabitToday, deleteHabit, reload: reloadHabits };
}

/* ═══════════════════════════════════════════════════════════════════
   MOOD ENTRIES
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineMoods() {
  const { data: moods, loading, load: reloadMoods } = useAsyncData<OfflineMoodEntry[]>(
    async () => {
      const result = await db.moods.toArray();
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return result;
    },
    [],
    []
  );

  const addMood = useCallback(async (mood: Omit<OfflineMoodEntry, 'id' | 'createdAt'>) => {
    const newMood: OfflineMoodEntry = { ...mood, id: generateId(), createdAt: new Date() };
    // Replace existing entry for same date
    const existing = await db.moods.where('date').equals(mood.date).toArray();
    if (existing.length > 0) {
      await db.moods.update(existing[0].id, { ...newMood, id: existing[0].id });
    } else {
      await db.moods.add(newMood);
    }
    await reloadMoods();
    return newMood;
  }, [reloadMoods]);

  const getTodayMood = useCallback(async (): Promise<OfflineMoodEntry | null> => {
    const today = formatDateLocal(new Date());
    const result = await db.moods.where('date').equals(today).toArray();
    return result[0] || null;
  }, []);

  return { moods, loading, addMood, getTodayMood, reload: reloadMoods };
}

/* ═══════════════════════════════════════════════════════════════════
   FOCUS SESSIONS (Pomodoro Timer)
   ═══════════════════════════════════════════════════════════════════ */

export function useOfflineFocusSessions() {
  const { data: focusSessions, loading, load: reloadFocusSessions } = useAsyncData<OfflineFocusSession[]>(
    async () => {
      const today = formatDateLocal(new Date());
      const startOfDay = new Date(today + 'T00:00:00');
      const endOfDay = new Date(today + 'T23:59:59');
      const result = await db.focusSessions
        .where('completedAt')
        .between(startOfDay, endOfDay, true, true)
        .toArray();
      result.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
      return result;
    },
    [],
    []
  );

  const addSession = useCallback(async (session: Omit<OfflineFocusSession, 'id'>) => {
    const newSession: OfflineFocusSession = { ...session, id: generateId() };
    await db.focusSessions.add(newSession);
    await reloadFocusSessions();
    return newSession;
  }, [reloadFocusSessions]);

  const getTodayFocusMinutes = useCallback((): number => {
    if (!focusSessions) return 0;
    return focusSessions
      .filter(s => s.type === 'focus')
      .reduce((sum, s) => sum + s.duration, 0);
  }, [focusSessions]);

  return { focusSessions, loading, addSession, getTodayFocusMinutes, reload: reloadFocusSessions };
}
