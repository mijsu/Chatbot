import Dexie, { type Table } from 'dexie';

/* ─── Schema Types ─── */

export interface OfflineTask {
  id: string;
  title: string;
  description: string;
  time: string;
  location: string;
  participants: string;
  category: string; // general, meeting, design, code, personal
  priority: string; // 'low', 'medium', 'high' — default: 'medium'
  completed: boolean;
  date: string; // ISO date string YYYY-MM-DD
  tags: string; // comma-separated tag names
  dependsOn: string; // comma-separated task IDs this task depends on
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineReminder {
  id: string;
  title: string;
  description: string;
  time: string;
  icon: string; // clock, bell, calendar
  completed: boolean;
  recurring: string; // '', 'daily', 'weekly', 'monthly', 'custom'
  recurringEndDate: string; // ISO date for when recurring should stop (empty = forever)
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineConversation {
  id: string;
  title: string;
  botName: string;
  icon: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineMessage {
  id: string;
  role: string; // "user" or "assistant"
  content: string;
  conversationId: string;
  createdAt: Date;
}

export interface OfflineUserProfile {
  id: string; // always "default"
  name: string;
  status: string;
  aboutMe: string; // Free-text bio — who the user is, their life context, priorities, preferences
  language: string;
  updatedAt: Date;
}

export interface OfflineUserSettings {
  id: string; // always "default"
  notifications: boolean;
  darkMode: boolean;
  privateMode: boolean;
  locationServices: boolean;
  passwordHash: string; // SHA-256 hash of user's PIN/password, empty string = no password set
  voiceTone: string; // 'friendly' | 'professional' | 'fun' — changes AI personality
  role: string; // 'student' | 'young-professional' | 'freelancer' | 'entrepreneur'
  interests: string; // comma-separated: 'task-management,scheduling,reminders,notes,research'
  deepContextMode: boolean; // Phase 2: Full omniscient mode (true) vs basic context (false)
  updatedAt: Date;
}

export interface OfflineGoal {
  id: string;
  title: string;
  description: string;
  category: string; // health, career, personal, social, learning
  progress: number; // 0-100
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineHabit {
  id: string;
  title: string;
  description: string;
  frequency: string; // daily, weekly
  streak: number;
  lastCompletedDate: string; // ISO date YYYY-MM-DD
  completionHistory: string; // comma-separated ISO dates (YYYY-MM-DD)
  createdAt: Date;
  updatedAt: Date;
}

export interface OfflineMoodEntry {
  id: string;
  mood: string; // 'great' | 'good' | 'okay' | 'low' | 'bad'
  energy: number; // 1-5
  note: string;
  date: string; // ISO date YYYY-MM-DD
  createdAt: Date;
}

/* ─── Memory & Intelligence Tables (Phase 2) ─── */

export interface OfflineConversationMemory {
  id: string;
  conversationId: string;
  type: 'summary' | 'keyDecision' | 'preference' | 'entity';
  content: string;
  timestamp: Date;
  importance: 'low' | 'medium' | 'high' | 'critical';
}

export interface OfflineGlobalMemory {
  id: string;
  category: 'preference' | 'fact' | 'goal' | 'relationship' | 'insight';
  key: string;        // e.g., "prefers_morning_meetings"
  value: string;      // e.g., "User said they focus better before noon"
  sourceConversationId: string;
  confidence: number; // 0-1, increases if confirmed multiple times
  lastMentioned: Date;
  timesConfirmed: number;
}

export interface OfflineInsightLog {
  id: string;
  type: 'warning' | 'suggestion' | 'celebration' | 'question';
  title: string;
  description: string;
  dismissed: boolean;
  createdAt: Date;
}

export interface OfflineContextCache {
  id: string;        // unique cache key
  data: string;      // JSON-serialized context data
  generatedAt: Date;
  ttl: number;       // TTL in milliseconds
}

export interface OfflineNotification {
  id: string;
  type: 'reminder' | 'task' | 'insight' | 'system' | 'achievement' | 'streak';
  title: string;
  body: string;
  icon: string;       // lucide icon name: 'bell', 'check', 'flame', 'target', 'sparkles', 'calendar-check'
  read: boolean;
  actionType?: 'navigate' | 'chat' | 'none'; // what happens when clicked
  actionData?: string;  // JSON string for action payload (e.g., screen name, conversation id)
  createdAt: Date;
}

export interface OfflineFocusSession {
  id: string;
  duration: number;       // minutes focused
  completedAt: Date;
  type: string;           // 'focus' | 'break'
  taskId: string;         // empty string if not linked to a task
}

export interface OfflineAchievement {
  id: string;
  type: string; // badge type: 'streak_7', 'streak_30', 'tasks_50', 'habits_7d', etc.
  title: string;
  description: string;
  unlockedAt: Date;
  icon: string; // lucide icon name
}

/* ─── Database ─── */

class SyntraDatabase extends Dexie {
  tasks!: Table<OfflineTask, string>;
  reminders!: Table<OfflineReminder, string>;
  conversations!: Table<OfflineConversation, string>;
  messages!: Table<OfflineMessage, string>;
  profile!: Table<OfflineUserProfile, string>;
  settings!: Table<OfflineUserSettings, string>;
  goals!: Table<OfflineGoal, string>;
  habits!: Table<OfflineHabit, string>;
  moods!: Table<OfflineMoodEntry, string>;
  conversationMemories!: Table<OfflineConversationMemory, string>;
  globalMemories!: Table<OfflineGlobalMemory, string>;
  insightLog!: Table<OfflineInsightLog, string>;
  contextCache!: Table<OfflineContextCache, string>;
  notifications!: Table<OfflineNotification, string>;
  focusSessions!: Table<OfflineFocusSession, string>;
  achievements!: Table<OfflineAchievement, string>;

  constructor() {
    super('SyntraDB');

    this.version(1).stores({
      tasks: 'id, date, category, completed, createdAt',
      reminders: 'id, completed, icon, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
    });

    // Version 2: Add goals, habits, moods tables
    this.version(2).stores({
      tasks: 'id, date, category, completed, createdAt',
      reminders: 'id, completed, icon, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
    });

    // Version 3: Add recurring fields to reminders
    this.version(3).stores({
      tasks: 'id, date, category, completed, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
    });

    // Version 4: Add completionHistory to habits
    this.version(4).stores({
      tasks: 'id, date, category, completed, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
    });

    // Version 5: Add priority to tasks, role & interests to settings
    this.version(5).stores({
      tasks: 'id, date, category, completed, priority, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
    });

    // Version 6: Add aboutMe to profile
    this.version(6).stores({
      tasks: 'id, date, category, completed, priority, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
    }).upgrade((tx) => {
      // Add aboutMe field to existing profiles
      return tx.table('profile').toCollection().modify((profile: any) => {
        if (profile.aboutMe === undefined) {
          profile.aboutMe = '';
        }
      });
    });

    // Version 7: Add memory & intelligence tables (Phase 2)
    this.version(7).stores({
      tasks: 'id, date, category, completed, priority, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
      conversationMemories: 'id, conversationId, type, timestamp, importance',
      globalMemories: 'id, category, key, lastMentioned',
      insightLog: 'id, type, dismissed, createdAt',
      contextCache: 'id, generatedAt',
    });

    // Version 8: Clear placeholder data ("John Smith", "Premium Member") from profile
    this.version(8).stores({
      tasks: 'id, date, category, completed, priority, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
      conversationMemories: 'id, conversationId, type, timestamp, importance',
      globalMemories: 'id, category, key, lastMentioned',
      insightLog: 'id, type, dismissed, createdAt',
      contextCache: 'id, generatedAt',
    }).upgrade((tx) => {
      return tx.table('profile').toCollection().modify((profile: any) => {
        if (profile.name === 'John Smith') {
          profile.name = '';
        }
        if (profile.status === 'Premium Member') {
          profile.status = '';
        }
      });
    });

    // Version 9: Add notifications table for in-app notification center
    this.version(9).stores({
      tasks: 'id, date, category, completed, priority, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
      conversationMemories: 'id, conversationId, type, timestamp, importance',
      globalMemories: 'id, category, key, lastMentioned',
      insightLog: 'id, type, dismissed, createdAt',
      contextCache: 'id, generatedAt',
      notifications: 'id, type, read, createdAt',
    });

    // Version 10: Add focusSessions & achievements tables; add tags & dependsOn to tasks
    this.version(10).stores({
      tasks: 'id, date, category, completed, priority, createdAt',
      reminders: 'id, completed, icon, recurring, createdAt',
      conversations: 'id, pinned, updatedAt',
      messages: 'id, conversationId, createdAt, [conversationId+createdAt]',
      profile: 'id',
      settings: 'id',
      goals: 'id, category, completed, createdAt',
      habits: 'id, frequency, lastCompletedDate, createdAt',
      moods: 'id, date, createdAt',
      conversationMemories: 'id, conversationId, type, timestamp, importance',
      globalMemories: 'id, category, key, lastMentioned',
      insightLog: 'id, type, dismissed, createdAt',
      contextCache: 'id, generatedAt',
      notifications: 'id, type, read, createdAt',
      focusSessions: 'id, completedAt, type',
      achievements: 'id, type, unlockedAt',
    }).upgrade((tx) => {
      // Add tags & dependsOn fields to existing tasks
      return tx.table('tasks').toCollection().modify((task: any) => {
        if (task.tags === undefined) {
          task.tags = '';
        }
        if (task.dependsOn === undefined) {
          task.dependsOn = '';
        }
      });
    });
  }
}

export const db = new SyntraDatabase();

/* ─── ID Generator ─── */

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

/* ─── Time Format Utilities (12h ↔ 24h) ─── */

/** Convert "14:30" (HH:MM 24h) → "2:30 PM" */
export function formatTime12(time24: string | null | undefined): string {
  if (!time24 || !/^\d{1,2}:\d{2}$/.test(time24)) return time24 || '';
  const [h, m] = time24.split(':').map(Number);
  if (h === 0) return `12:${String(m).padStart(2, '0')} AM`;
  if (h === 12) return `12:${String(m).padStart(2, '0')} PM`;
  if (h > 12) return `${h - 12}:${String(m).padStart(2, '0')} PM`;
  return `${h}:${String(m).padStart(2, '0')} AM`;
}

/** Convert "2:30 PM" → "14:30" (HH:MM 24h) for storage */
export function parseTime12(time12: string): string {
  const match = time12.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) {
    // Already 24h format or unparseable — return as-is
    return time12;
  }
  let [, h, m, period] = match;
  const hours = parseInt(h, 10);
  const minutes = parseInt(m, 10);
  if (period.toUpperCase() === 'AM') {
    if (hours === 12) return `00:${String(minutes).padStart(2, '0')}`;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  // PM
  if (hours === 12) return `12:${String(minutes).padStart(2, '0')}`;
  return `${String(hours + 12).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/* ─── Initialize Default Data ─── */

/* ─── Password Hashing (SHA-256 via Web Crypto API) ─── */

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '__syntra_salt__');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === storedHash;
}

export async function hasPassword(): Promise<boolean> {
  await initializeDefaults();
  const settings = await db.settings.get('default');
  return !!(settings?.passwordHash && settings.passwordHash.length > 0);
}

export async function checkAuth(password: string): Promise<boolean> {
  await initializeDefaults();
  const settings = await db.settings.get('default');
  if (!settings?.passwordHash) return true; // No password set = always authenticated
  return verifyPassword(password, settings.passwordHash);
}

export async function setPassword(password: string): Promise<void> {
  const hash = await hashPassword(password);
  await db.settings.update('default', { passwordHash: hash, updatedAt: new Date() });
}

export async function removePassword(): Promise<void> {
  await db.settings.update('default', { passwordHash: '', updatedAt: new Date() });
}

/* ─── Initialize Default Data ─── */

export async function initializeDefaults() {
  // Detect fresh install: if no profile AND no settings exist, this is a brand new user
  const existingProfile = await db.profile.get('default');
  const existingSettings = await db.settings.get('default');
  const isFreshInstall = !existingProfile && !existingSettings;

  // On fresh install, clear ALL localStorage caches to ensure a clean start
  if (isFreshInstall) {
    try {
      const keysToRemove = [
        'syntra_daily_summary_cache',
        'syntra_ai_suggestions_cache',
        'syntra_ai_dynamic_content',
        'syntra_ai_full_content',
        'syntra_mood_cache',
      ];
      keysToRemove.forEach(key => {
        try { localStorage.removeItem(key); } catch { /* ignore */ }
      });
    } catch { /* localStorage unavailable */ }
  }

  // Ensure default profile exists — starts fresh, no placeholder data
  if (!existingProfile) {
    await db.profile.add({
      id: 'default',
      name: '',
      status: '',
      aboutMe: '',
      language: 'en',
      updatedAt: new Date(),
    });
  }

  // Ensure default settings exist
  if (!existingSettings) {
    await db.settings.add({
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
    });
  }
}
