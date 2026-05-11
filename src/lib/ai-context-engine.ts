/**
 * AI Context Engine — The "Brain" of Syntra
 *
 * Centralized module that:
 * 1. Gathers ALL user data (profile, settings, goals, habits, moods, tasks, reminders)
 * 2. Builds rich context for AI calls
 * 3. Generates dynamic UI content for ALL screens (greetings, suggestions, labels, tips, empty states)
 * 4. Caches results with intelligent invalidation
 * 5. Provides fallback content when AI is unavailable
 *
 * EVERY visible text element in the app should come from this engine —
 * either AI-generated or from the minimal fallback below.
 */

import type { OfflineTask, OfflineReminder, OfflineGoal, OfflineHabit, OfflineMoodEntry, OfflineUserProfile, OfflineUserSettings } from './offline-db';

/* ─── Types ─── */

export interface FullUserContext {
  profile: OfflineUserProfile;
  settings: OfflineUserSettings;
  tasks: OfflineTask[];
  reminders: OfflineReminder[];
  goals: OfflineGoal[];
  habits: OfflineHabit[];
  moods: OfflineMoodEntry[];
  recentTopics?: string[];
}

export interface AISuggestion {
  icon: string;
  text: string;
  prompt: string;
  category?: 'productivity' | 'wellness' | 'social' | 'creative' | 'focus' | 'learning';
}

/* ─── Home Screen Content ─── */

export interface ProgressMetric {
  label: string;
  value: string;
  subtext?: string;      // Contextual description (e.g. "finish the urgent one first")
  progress?: number;     // 0-100 mini progress bar
  highlight?: boolean;   // True if this item needs attention
  trend?: 'up' | 'down' | 'stable';  // Direction indicator
  statusColor?: string;  // Override status color (e.g. 'var(--nd-success)', 'var(--nd-accent)')
}

export interface ProgressItem {
  label: string;
  value: string;
  highlight?: boolean;  // True if this item needs attention / is important
}

export interface PriorityFocus {
  label: string;        // What to focus on (e.g. "Finish the design review")
  reason?: string;     // Why it matters (e.g. "Due before 3pm")
  urgency?: 'low' | 'medium' | 'high';
}

export interface HomeAIContent {
  greeting: string;
  statusLine: string;
  suggestionSectionLabel: string;
  suggestions: AISuggestion[];
  insightLabel: string;
  progressLabel: string;
  quickActionLabel: string;
  moodCheckLabel: string;
  goalsSectionLabel: string;
  habitsSectionLabel: string;
  progressItems: ProgressItem[];
  progressMetrics: ProgressMetric[];
  progressStatus: string;          // Short status like "ON TRACK", "NEEDS ATTENTION", "CRUSHING IT"
  priorityFocus?: PriorityFocus;   // Smart focus recommendation
}

/* ─── Planner Screen Content ─── */

export interface PlannerAIContent {
  headerLabel: string;
  emptyTasksMessage: string;
  emptyTasksHint: string;
  aiTaskButtonLabel: string;
  remindersSectionLabel: string;
  emptyRemindersMessage: string;
  searchPlaceholder: string;
}

/* ─── Settings Screen Content ─── */

export interface SettingsAIContent {
  profileSectionLabel: string;
  accountSectionLabel: string;
  preferencesSectionLabel: string;
  goalsSectionLabel: string;
  habitsSectionLabel: string;
  dataSectionLabel: string;
  editProfileLabel: string;
  aboutMePlaceholder: string;
  moodHistoryLabel: string;
  noGoalsMessage: string;
  noHabitsMessage: string;
}

/* ─── Bottom Nav Content ─── */

export interface NavAIContent {
  homeLabel: string;
  plannerLabel: string;
  voiceLabel: string;
  reminderLabel: string;
  profileLabel: string;
}

/* ─── Common Content ─── */

export interface CommonAIContent {
  loadingText: string;
  savedText: string;
  noDataText: string;
  confirmDeleteText: string;
  cancelText: string;
}

/* ─── Full AI Content (all screens at once) ─── */

export interface FullAIContent {
  home: HomeAIContent;
  planner: PlannerAIContent;
  settings: SettingsAIContent;
  nav: NavAIContent;
  common: CommonAIContent;
  aiGenerated: boolean;
}

/* ─── Legacy type alias for backward compatibility ─── */

export interface AIDynamicContent {
  greeting: string;
  statusLine: string;
  suggestionSectionLabel: string;
  suggestions: AISuggestion[];
  insightLabel: string;
  progressLabel: string;
  quickActionLabel: string;
  aiGenerated: boolean;
}

/* ─── Context Building ─── */

export function buildAIContext(context: FullUserContext): string {
  const parts: string[] = [];
  const { profile, settings, tasks, reminders, goals, habits, moods } = context;

  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // Identity
  if (profile.name) parts.push(`User's name: ${profile.name}`);
  if (profile.aboutMe?.trim()) parts.push(`About the user: ${profile.aboutMe.trim()}`);
  if (settings.role?.trim()) parts.push(`User's role: ${settings.role.trim()}`);
  if (settings.interests?.trim()) parts.push(`User's interests: ${settings.interests.trim()}`);
  if (settings.voiceTone) parts.push(`Preferred AI tone: ${settings.voiceTone}`);

  // Time context
  parts.push(`Current time: ${dayName} ${timeOfDay} (hour: ${hour})`);

  // Tasks
  const todayTasks = tasks.filter(t => t.date === today);
  const pendingTasks = todayTasks.filter(t => !t.completed);
  const completedTasks = todayTasks.filter(t => t.completed);
  if (pendingTasks.length > 0) {
    parts.push(`Today's pending tasks (${pendingTasks.length}): ${pendingTasks.map(t => `"${t.title}"${t.time ? ` at ${t.time}` : ''}`).join(', ')}`);
  }
  if (completedTasks.length > 0) {
    parts.push(`Completed tasks today (${completedTasks.length}): ${completedTasks.map(t => `"${t.title}"`).join(', ')}`);
  }

  // Reminders
  const activeReminders = reminders.filter(r => !r.completed);
  if (activeReminders.length > 0) {
    parts.push(`Active reminders (${activeReminders.length}): ${activeReminders.slice(0, 5).map(r => `"${r.title}"`).join(', ')}`);
  }

  // Goals
  const activeGoals = goals.filter(g => !g.completed && g.progress < 100);
  if (activeGoals.length > 0) {
    parts.push(`Active goals: ${activeGoals.map(g => `"${g.title}" (${g.progress}%)`).join(', ')}`);
  }

  // Habits
  const todayHabits = habits.map(h => ({
    title: h.title,
    streak: h.streak,
    done: h.lastCompletedDate === today,
  }));
  if (todayHabits.length > 0) {
    parts.push(`Habits: ${todayHabits.map(h => `"${h.title}" (${h.done ? 'done today' : 'pending'}, ${h.streak}-day streak)`).join('; ')}`);
  }

  // Mood
  const todayMood = moods.find(m => m.date === today);
  if (todayMood) {
    parts.push(`Today's mood: ${todayMood.mood}, energy: ${todayMood.energy}/5`);
  } else {
    parts.push(`User hasn't checked in their mood today`);
  }

  // Recent conversation topics
  if (context.recentTopics && context.recentTopics.length > 0) {
    parts.push(`Recent conversation topics: ${context.recentTopics.join(', ')}`);
  }

  return parts.join('\n');
}

/* ─── Fallback Content (Minimal, for when AI is unavailable) ─── */

const FALLBACK_SUGGESTIONS: AISuggestion[] = [
  { icon: 'sparkles', text: 'BRAINSTORM', prompt: 'Help me brainstorm creative ideas for my current projects', category: 'creative' },
  { icon: 'code', text: 'DEBUG CODE', prompt: 'I need help debugging or reviewing my code', category: 'productivity' },
  { icon: 'coffee', text: 'TAKE BREAK', prompt: 'Suggest a refreshing 5-minute break activity', category: 'wellness' },
  { icon: 'calendar', text: 'PLAN DAY', prompt: 'Help me organize and plan my schedule for today', category: 'productivity' },
  { icon: 'brain', text: 'STAY FOCUSED', prompt: 'Help me maintain focus and productivity', category: 'focus' },
  { icon: 'droplets', text: 'CHECK IN', prompt: 'Help me compose a check-in message', category: 'social' },
];

export const FALLBACK_CONTENT: AIDynamicContent = {
  greeting: 'Hey there',
  statusLine: 'Start adding tasks and goals to see your daily pulse',
  suggestionSectionLabel: 'SUGGESTIONS',
  suggestions: FALLBACK_SUGGESTIONS,
  insightLabel: 'DAILY INSIGHT',
  progressLabel: 'ACADEMIC PULSE',
  quickActionLabel: 'ASK SYNTRA',
  aiGenerated: false,
};

export const FALLBACK_FULL_CONTENT: FullAIContent = {
  home: {
    greeting: 'Hey there',
    statusLine: 'Start adding tasks and goals to see your daily pulse',
    suggestionSectionLabel: 'SUGGESTIONS',
    suggestions: FALLBACK_SUGGESTIONS,
    insightLabel: 'DAILY INSIGHT',
    progressLabel: 'ACADEMIC PULSE',
    quickActionLabel: 'ASK SYNTRA',
    moodCheckLabel: 'HOW ARE YOU',
    goalsSectionLabel: 'YOUR GOALS',
    habitsSectionLabel: 'DAILY HABITS',
    progressItems: [],
    progressMetrics: [],
    progressStatus: 'JUST STARTED',
    priorityFocus: undefined,
  },
  planner: {
    headerLabel: 'PLANNER',
    emptyTasksMessage: 'No tasks for this day',
    emptyTasksHint: 'Tap + to add one',
    aiTaskButtonLabel: 'SMART ADD',
    remindersSectionLabel: 'REMINDERS',
    emptyRemindersMessage: 'No reminders',
    searchPlaceholder: 'Search tasks...',
  },
  settings: {
    profileSectionLabel: 'PROFILE',
    accountSectionLabel: 'ACCOUNT',
    preferencesSectionLabel: 'PREFERENCES',
    goalsSectionLabel: 'GOALS',
    habitsSectionLabel: 'HABITS',
    dataSectionLabel: 'DATA',
    editProfileLabel: 'EDIT PROFILE',
    aboutMePlaceholder: 'Tell Syntra about yourself so it can personalize your experience...',
    moodHistoryLabel: 'MOOD HISTORY',
    noGoalsMessage: 'No goals yet. Add one to get started!',
    noHabitsMessage: 'No habits yet. Start building streaks!',
  },
  nav: {
    homeLabel: 'Home',
    plannerLabel: 'Planner',
    voiceLabel: 'Voice',
    reminderLabel: 'Reminders',
    profileLabel: 'Profile',
  },
  common: {
    loadingText: 'LOADING...',
    savedText: 'SAVED',
    noDataText: 'Nothing here yet',
    confirmDeleteText: 'Are you sure?',
    cancelText: 'CANCEL',
  },
  aiGenerated: false,
};

/* ─── Cache Management ─── */

const CONTENT_CACHE_KEY = 'syntra_ai_dynamic_content';
const FULL_CONTENT_CACHE_KEY = 'syntra_ai_full_content';
const CACHE_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface CachedContent {
  content: AIDynamicContent;
  timestamp: number;
  contextHash: string;
}

interface CachedFullContent {
  content: FullAIContent;
  timestamp: number;
  contextHash: string;
}

function hashContext(context: FullUserContext): string {
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const pendingTasks = context.tasks.filter(t => t.date === today && !t.completed).length;
  const moodToday = context.moods.find(m => m.date === today)?.mood || 'none';
  return `${hour}-${pendingTasks}-${moodToday}-${context.goals.filter(g => !g.completed).length}`;
}

export function getCachedContent(context: FullUserContext): AIDynamicContent | null {
  try {
    const raw = localStorage.getItem(CONTENT_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedContent = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_DURATION_MS) return null;
    if (cached.contextHash !== hashContext(context)) return null;
    return cached.content;
  } catch {
    return null;
  }
}

export function setCachedContent(content: AIDynamicContent, context: FullUserContext): void {
  try {
    const cached: CachedContent = {
      content,
      timestamp: Date.now(),
      contextHash: hashContext(context),
    };
    localStorage.setItem(CONTENT_CACHE_KEY, JSON.stringify(cached));
  } catch {
    /* localStorage full or unavailable */
  }
}

export function getCachedFullContent(context: FullUserContext): FullAIContent | null {
  try {
    const raw = localStorage.getItem(FULL_CONTENT_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedFullContent = JSON.parse(raw);
    if (Date.now() - cached.timestamp > CACHE_DURATION_MS) return null;
    if (cached.contextHash !== hashContext(context)) return null;
    return cached.content;
  } catch {
    return null;
  }
}

export function setCachedFullContent(content: FullAIContent, context: FullUserContext): void {
  try {
    const cached: CachedFullContent = {
      content,
      timestamp: Date.now(),
      contextHash: hashContext(context),
    };
    localStorage.setItem(FULL_CONTENT_CACHE_KEY, JSON.stringify(cached));
  } catch {
    /* localStorage full or unavailable */
  }
}

export function clearContentCache(): void {
  try {
    localStorage.removeItem(CONTENT_CACHE_KEY);
    localStorage.removeItem(FULL_CONTENT_CACHE_KEY);
  } catch { /* ignore */ }
}

/* ─── Convert FullAIContent to legacy AIDynamicContent ─── */

export function fullToLegacyContent(full: FullAIContent): AIDynamicContent {
  return {
    greeting: full.home.greeting,
    statusLine: full.home.statusLine,
    suggestionSectionLabel: full.home.suggestionSectionLabel,
    suggestions: full.home.suggestions,
    insightLabel: full.home.insightLabel,
    progressLabel: full.home.progressLabel,
    quickActionLabel: full.home.quickActionLabel,
    aiGenerated: full.aiGenerated,
  };
}
