/**
 * Syntra Context Engine v2.0 — The Omniscient Intelligence Layer
 *
 * This module aggregates ALL user data into a single unified context object
 * that gives the AI complete awareness of the user's digital life.
 *
 * Architecture:
 * ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 * │  PROFILE  │  │ CHATS    │  │ PLANNER  │  │ TASKS    │
 * │  (Deep    │  │ (Memory  │  │ (Full    │  │ (Complete│
 * │   Under-  │  │  Graph)  │  │  Schedule│  │  Ecosys- │
 * │   stand)  │  │          │  │  Aware)  │  │   tem)   │
 * └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
 *      └─────────────┴─────────────┴─────────────┘
 *                       ↓
 *           ┌───────────────────────┐
 *           │  CONTEXT AGGREGATOR   │
 *           │  (Real-time merge)    │
 *           └───────────┬───────────┘
 *                       ↓
 * ┌─────────────────────────────────────────────────────┐
 * │           UNIFIED USER STATE OBJECT                  │
 * └─────────────────────────────────────────────────────┘
 *                       ↓
 *           ┌───────────────────────┐
 *           │   AI RESPONSE ENGINE  │
 *           │  (Weaves all context  │
 *           │   into natural resp.) │
 *           └───────────────────────┘
 */

import type {
  OfflineTask,
  OfflineReminder,
  OfflineGoal,
  OfflineHabit,
  OfflineMoodEntry,
  OfflineUserProfile,
  OfflineUserSettings,
  OfflineConversationMemory,
  OfflineGlobalMemory,
} from './offline-db';

/* ─── Unified Context Interfaces ─── */

export interface ProfileAnalysis {
  personalityTraits: string[];       // ["detail-oriented", "ambitious"]
  communicationStyle: 'formal' | 'casual' | 'friendly';
  knownConstraints: string[];        // ["busy mornings", "no meetings Fridays"]
  mentionedGoals: string[];          // Extracted from aboutMe text
  lifeSituation: string;             // "working parent", "grad student", etc.
  preferences: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    workStyle: 'deep-work' | 'collaborative' | 'flexible';
    stressTriggers: string[];
  };
}

export interface EmotionalState {
  todayMood: string | null;
  energyLevel: number | null;
  moodHistory: { mood: string; date: string; energy: number }[];
  moodTrend: 'improving' | 'declining' | 'stable';
  energyPattern: 'morning-person' | 'night-owl' | 'consistent' | 'unknown';
}

export interface MemoryLayer {
  currentConversation: {
    recentMessages: { role: string; content: string }[];
    topicsDiscussed: string[];
    decisionsMade: string[];
  };
  conversationHistory: {
    summaries: { conversationId: string; content: string; timestamp: Date }[];
    globalKnowledge: { key: string; value: string; category: string; confidence: number }[];
  };
}

export interface PlannerContext {
  today: { tasks: OfflineTask[]; count: number };
  tomorrow: { tasks: OfflineTask[]; count: number };
  thisWeek: { tasks: OfflineTask[]; count: number };
  overdue: OfflineTask[];
  conflicts: { task1: string; task2: string; time: string }[];
  timeDensity: {
    now: 'free' | 'busy' | 'overloaded';
    today: 'light' | 'moderate' | 'heavy';
    thisWeek: 'manageable' | 'full' | 'cramped';
  };
  freeWindows: { start: string; end: string; durationMin: number }[];
}

export interface ReminderContext {
  active: OfflineReminder[];
  upcoming24h: OfflineReminder[];
  upcoming7d: OfflineReminder[];
  overdue: OfflineReminder[];
  recentlyCompleted: OfflineReminder[];
  patterns: {
    totalActive: number;
    recurringCount: number;
    snoozeProne: string[];   // Titles of reminders that get snoozed often
  };
}

export interface TaskContext {
  summary: {
    total: number;
    todo: number;
    inProgress: number;
    completedToday: number;
    overdue: number;
  };
  highPriority: OfflineTask[];
  dueToday: OfflineTask[];
  dueTomorrow: OfflineTask[];
  dueThisWeek: OfflineTask[];
  recentlyCompleted: OfflineTask[];
  abandoned: OfflineTask[];        // Not touched > 7 days
  byCategory: Record<string, number>;
  workloadAnalysis: {
    trend: 'overloaded' | 'balanced' | 'light';
    completionRate: number;         // Past 7 days
    bottleneckCategory: string;
  };
}

export interface ProductivityLayer {
  tasks: TaskContext;
  goals: { title: string; progress: number; category: string; completed: boolean }[];
  habits: { title: string; streak: number; done: boolean; frequency: string }[];
  completionRate: number;
  productivityScore: number;        // 0-100
}

export interface SchedulingLayer {
  planner: PlannerContext;
  reminders: ReminderContext;
  timeDensity: {
    now: 'free' | 'busy' | 'overloaded';
    today: 'light' | 'moderate' | 'heavy';
    thisWeek: 'manageable' | 'full' | 'cramped';
  };
  upcomingConflicts: { task1: string; task2: string; time: string }[];
  freeWindows: { start: string; end: string; durationMin: number }[];
}

export interface PatternInsights {
  behavioralPatterns: {
    peakProductivityHours: number[];
    commonTaskCategories: string[];
    deadlineBehavior: 'early' | 'on-time' | 'last-minute' | 'unknown';
  };
  correlations: {
    moodVsProductivity: 'positive' | 'negative' | 'neutral' | 'unknown';
    taskVelocityTrend: 'increasing' | 'stable' | 'decreasing';
    habitSuccessRate: number;
  };
  predictions: {
    likelyToOverlook: string[];    // Task titles based on history
    riskOfBurnout: boolean;
    suggestedFocusAreas: string[];
  };
}

export interface TemporalContext {
  currentDate: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  dayOfWeek: string;
  weekNumber: number;
  monthProgress: number;           // 0-1
  seasonality: 'start-of-week' | 'mid-week' | 'end-of-week' | 'weekend';
}

export interface SyntraUnifiedContext {
  // IDENTITY LAYER
  identity: {
    name: string;
    aboutMe: string;
    parsedProfile: ProfileAnalysis;
    role: string;
    interests: string[];
  };

  // EMOTIONAL STATE
  emotionalState: EmotionalState;

  // MEMORY LAYER
  memory: MemoryLayer;

  // PRODUCTIVITY LAYER
  productivity: ProductivityLayer;

  // TIME LAYER
  scheduling: SchedulingLayer;

  // PATTERN RECOGNITION LAYER
  insights: PatternInsights;

  // TEMPORAL CONTEXT
  temporal: TemporalContext;

  // METADATA
  meta: {
    generatedAt: Date;
    dataFreshness: 'real-time' | 'cached' | 'stale';
    contextMode: 'deep' | 'basic';
  };
}

/* ─── Context Input Data ─── */

export interface ContextInputData {
  profile: OfflineUserProfile;
  settings: OfflineUserSettings;
  tasks: OfflineTask[];
  reminders: OfflineReminder[];
  goals: OfflineGoal[];
  habits: OfflineHabit[];
  moods: OfflineMoodEntry[];
  recentMessages?: { role: string; content: string }[];
  conversationMemories?: OfflineConversationMemory[];
  globalMemories?: OfflineGlobalMemory[];
  deepContextMode?: boolean;
}

/* ─── Helper Functions ─── */

function formatDateLocal(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/* ─── Profile Analysis ─── */

const PERSONALITY_KEYWORDS: Record<string, string[]> = {
  'detail-oriented': ['detail', 'precise', 'thorough', 'meticulous', 'careful', 'perfectionist'],
  'ambitious': ['ambitious', 'driven', 'goal-oriented', 'achiever', 'competitive', 'hustle'],
  'creative': ['creative', 'artistic', 'innovative', 'imaginative', 'designer', 'writer'],
  'analytical': ['analytical', 'logical', 'data', 'systematic', 'methodical', 'engineer'],
  'social': ['social', 'extrovert', 'people', 'team', 'collaborative', 'communicator'],
  'introverted': ['introvert', 'quiet', 'focused', 'independent', 'solo', 'reflective'],
  'organized': ['organized', 'structured', 'planner', 'systematic', 'routine', 'schedule'],
  'flexible': ['flexible', 'adaptable', 'spontaneous', 'go with the flow', 'easy-going'],
};

const MORNING_KEYWORDS = ['morning person', 'early bird', 'wake up early', 'dawn', '5am', '6am', '7am'];
const NIGHT_KEYWORDS = ['night owl', 'stay up late', 'evening person', 'midnight', 'nocturnal'];
const DEEP_WORK_KEYWORDS = ['deep work', 'focus time', 'uninterrupted', 'flow state', 'concentration'];
const COLLABORATIVE_KEYWORDS = ['team', 'collaborative', 'pair', 'group', 'meeting', 'brainstorm'];
const STRESS_KEYWORDS = ['stress', 'overwhelm', 'anxious', 'burnout', 'pressure', 'deadline', 'busy'];

function analyzeProfile(profile: OfflineUserProfile, settings: OfflineUserSettings): ProfileAnalysis {
  const text = `${profile.aboutMe || ''} ${settings.interests || ''} ${settings.role || ''}`.toLowerCase();

  const personalityTraits: string[] = [];
  for (const [trait, keywords] of Object.entries(PERSONALITY_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) {
      personalityTraits.push(trait);
    }
  }
  // Default traits if none detected
  if (personalityTraits.length === 0) {
    personalityTraits.push('adaptable');
  }

  const communicationStyle: ProfileAnalysis['communicationStyle'] =
    text.includes('formal') || text.includes('professional') ? 'formal' :
    text.includes('casual') || text.includes('chill') ? 'casual' : 'friendly';

  const constraints: string[] = [];
  if (text.includes('busy morning')) constraints.push('busy mornings');
  if (text.includes('no meeting') || text.includes('no meeting friday')) constraints.push('prefers no-meeting days');
  if (text.includes('parent') || text.includes('kids') || text.includes('children')) constraints.push('family commitments');

  const mentionedGoals: string[] = [];
  const goalPatterns = [
    /(?:want to|goal is|working on|trying to|aim to|hope to)\s+([^.!?\n]{5,60})/gi,
  ];
  for (const pattern of goalPatterns) {
    let match;
    while ((match = pattern.exec(profile.aboutMe || '')) !== null) {
      mentionedGoals.push(match[1].trim());
    }
  }

  const lifeSituation =
    text.includes('student') ? 'student' :
    text.includes('parent') ? 'working parent' :
    text.includes('freelanc') ? 'freelancer' :
    text.includes('entrepreneur') || text.includes('startup') ? 'entrepreneur' :
    text.includes('retired') ? 'retired' :
    settings.role || 'professional';

  const timeOfDay: ProfileAnalysis['preferences']['timeOfDay'] =
    MORNING_KEYWORDS.some(kw => text.includes(kw)) ? 'morning' :
    NIGHT_KEYWORDS.some(kw => text.includes(kw)) ? 'night' : 'afternoon';

  const workStyle: ProfileAnalysis['preferences']['workStyle'] =
    DEEP_WORK_KEYWORDS.some(kw => text.includes(kw)) ? 'deep-work' :
    COLLABORATIVE_KEYWORDS.some(kw => text.includes(kw)) ? 'collaborative' : 'flexible';

  const stressTriggers = STRESS_KEYWORDS.filter(kw => text.includes(kw));

  return {
    personalityTraits,
    communicationStyle,
    knownConstraints: constraints,
    mentionedGoals,
    lifeSituation,
    preferences: {
      timeOfDay,
      workStyle,
      stressTriggers,
    },
  };
}

/* ─── Emotional State Analysis ─── */

function analyzeEmotionalState(moods: OfflineMoodEntry[]): EmotionalState {
  const today = formatDateLocal(new Date());
  const todayMood = moods.find(m => m.date === today);

  // Last 7 days of mood history
  const last7Days: EmotionalState['moodHistory'] = [];
  for (let i = 0; i < 7; i++) {
    const d = formatDateLocal(addDays(new Date(), -i));
    const entry = moods.find(m => m.date === d);
    if (entry) {
      last7Days.push({ mood: entry.mood, date: d, energy: entry.energy });
    }
  }

  // Mood trend
  const moodScores: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
  let moodTrend: EmotionalState['moodTrend'] = 'stable';
  if (last7Days.length >= 3) {
    const recent = last7Days.slice(0, 2);
    const older = last7Days.slice(2);
    const recentAvg = recent.reduce((s, m) => s + (moodScores[m.mood] || 3), 0) / recent.length;
    const olderAvg = older.reduce((s, m) => s + (moodScores[m.mood] || 3), 0) / older.length;
    if (recentAvg > olderAvg + 0.5) moodTrend = 'improving';
    else if (recentAvg < olderAvg - 0.5) moodTrend = 'declining';
  }

  // Energy pattern
  let energyPattern: EmotionalState['energyPattern'] = 'unknown';
  if (last7Days.length >= 3) {
    const avgEnergy = last7Days.reduce((s, m) => s + m.energy, 0) / last7Days.length;
    if (avgEnergy >= 3.5) energyPattern = 'consistent';
    else if (avgEnergy < 2.5) energyPattern = 'night-owl'; // Low morning energy suggests night owl
    else energyPattern = 'consistent';
  }

  return {
    todayMood: todayMood?.mood || null,
    energyLevel: todayMood?.energy || null,
    moodHistory: last7Days,
    moodTrend,
    energyPattern,
  };
}

/* ─── Planner Context ─── */

function buildPlannerContext(tasks: OfflineTask[]): PlannerContext {
  const today = formatDateLocal(new Date());
  const tomorrow = formatDateLocal(addDays(new Date(), 1));
  const endOfWeek = formatDateLocal(addDays(new Date(), 7));

  const todayTasks = tasks.filter(t => t.date === today);
  const tomorrowTasks = tasks.filter(t => t.date === tomorrow);
  const thisWeekTasks = tasks.filter(t => t.date >= today && t.date <= endOfWeek);
  const overdueTasks = tasks.filter(t => t.date < today && !t.completed);

  // Detect time conflicts
  const conflicts: PlannerContext['conflicts'] = [];
  const todayTasksWithTime = todayTasks.filter(t => t.time && !t.completed);
  for (let i = 0; i < todayTasksWithTime.length; i++) {
    for (let j = i + 1; j < todayTasksWithTime.length; j++) {
      if (todayTasksWithTime[i].time === todayTasksWithTime[j].time) {
        conflicts.push({
          task1: todayTasksWithTime[i].title,
          task2: todayTasksWithTime[j].title,
          time: todayTasksWithTime[i].time,
        });
      }
    }
  }

  // Time density
  const pendingToday = todayTasks.filter(t => !t.completed).length;
  const pendingThisWeek = thisWeekTasks.filter(t => !t.completed).length;

  const timeDensity: PlannerContext['timeDensity'] = {
    now: pendingToday === 0 ? 'free' : pendingToday <= 3 ? 'busy' : 'overloaded',
    today: pendingToday === 0 ? 'light' : pendingToday <= 3 ? 'moderate' : 'heavy',
    thisWeek: pendingThisWeek <= 5 ? 'manageable' : pendingThisWeek <= 10 ? 'full' : 'cramped',
  };

  // Free windows (simplified — based on gaps between tasks with times)
  const freeWindows: PlannerContext['freeWindows'] = [];
  const scheduledTasks = todayTasksWithTime.sort((a, b) => a.time.localeCompare(b.time));
  if (scheduledTasks.length === 0) {
    freeWindows.push({ start: '9:00 AM', end: '5:00 PM', durationMin: 480 });
  } else if (scheduledTasks.length === 1) {
    freeWindows.push({ start: 'Morning', end: scheduledTasks[0].time, durationMin: 120 });
    freeWindows.push({ start: scheduledTasks[0].time, end: 'End of day', durationMin: 240 });
  }

  return {
    today: { tasks: todayTasks, count: todayTasks.length },
    tomorrow: { tasks: tomorrowTasks, count: tomorrowTasks.length },
    thisWeek: { tasks: thisWeekTasks, count: thisWeekTasks.length },
    overdue: overdueTasks,
    conflicts,
    timeDensity,
    freeWindows,
  };
}

/* ─── Reminder Context ─── */

function buildReminderContext(reminders: OfflineReminder[]): ReminderContext {
  const today = formatDateLocal(new Date());
  const tomorrow = formatDateLocal(addDays(new Date(), 1));
  const next7Days = formatDateLocal(addDays(new Date(), 7));

  const active = reminders.filter(r => !r.completed);
  const recentlyCompleted = reminders.filter(r => r.completed).slice(0, 5);

  // For upcoming, we look at reminders that are not completed
  // (since reminders don't have due dates in the same way tasks do,
  // we consider all active reminders as "upcoming")
  const recurring = active.filter(r => r.recurring && r.recurring !== '');

  return {
    active,
    upcoming24h: active.slice(0, 10),  // All active reminders are potentially upcoming
    upcoming7d: active,
    overdue: [],  // Reminders don't have a due date field, so no overdue concept
    recentlyCompleted,
    patterns: {
      totalActive: active.length,
      recurringCount: recurring.length,
      snoozeProne: [],  // Would need snooze tracking data
    },
  };
}

/* ─── Task Context ─── */

function buildTaskContext(tasks: OfflineTask[]): TaskContext {
  const today = formatDateLocal(new Date());
  const tomorrow = formatDateLocal(addDays(new Date(), 1));
  const next7Days = formatDateLocal(addDays(new Date(), 7));

  const todo = tasks.filter(t => !t.completed);
  const completedToday = tasks.filter(t => t.completed && t.date === today);
  const overdue = tasks.filter(t => t.date < today && !t.completed);
  const dueToday = tasks.filter(t => t.date === today && !t.completed);
  const dueTomorrow = tasks.filter(t => t.date === tomorrow && !t.completed);
  const dueThisWeek = tasks.filter(t => t.date >= today && t.date <= next7Days && !t.completed);
  const highPriority = todo.filter(t => t.priority === 'high' && t.date >= today);

  // Recently completed (last 5)
  const recentlyCompleted = tasks.filter(t => t.completed)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  // Abandoned tasks (not completed, created > 7 days ago, not due in future)
  const sevenDaysAgo = formatDateLocal(addDays(new Date(), -7));
  const abandoned = todo.filter(t => t.date < sevenDaysAgo);

  // Category breakdown
  const byCategory: Record<string, number> = {};
  for (const t of todo) {
    byCategory[t.category || 'general'] = (byCategory[t.category || 'general'] || 0) + 1;
  }

  // Workload analysis
  const completedLast7Days = tasks.filter(t => t.completed).length; // Simplified
  const totalCreated = todo.length;
  const completionRate = totalCreated > 0 ? Math.round((completedLast7Days / (completedLast7Days + totalCreated)) * 100) : 50;
  const bottleneckCategory = Object.entries(byCategory).sort(([,a], [,b]) => b - a)[0]?.[0] || 'general';

  const trend: TaskContext['workloadAnalysis']['trend'] =
    todo.length > completedLast7Days * 2 ? 'overloaded' :
    todo.length < completedLast7Days ? 'light' : 'balanced';

  return {
    summary: {
      total: tasks.length,
      todo: todo.length,
      inProgress: 0, // No in-progress state in current schema
      completedToday: completedToday.length,
      overdue: overdue.length,
    },
    highPriority,
    dueToday,
    dueTomorrow,
    dueThisWeek,
    recentlyCompleted,
    abandoned,
    byCategory,
    workloadAnalysis: {
      trend,
      completionRate,
      bottleneckCategory,
    },
  };
}

/* ─── Memory Layer ─── */

function buildMemoryLayer(
  recentMessages: { role: string; content: string }[] | undefined,
  conversationMemories: OfflineConversationMemory[] | undefined,
  globalMemories: OfflineGlobalMemory[] | undefined
): MemoryLayer {
  const summaries = (conversationMemories || [])
    .filter(m => m.type === 'summary')
    .map(m => ({ conversationId: m.conversationId, content: m.content, timestamp: m.timestamp }));

  const globalKnowledge = (globalMemories || [])
    .filter(m => m.confidence >= 0.3)
    .map(m => ({ key: m.key, value: m.value, category: m.category, confidence: m.confidence }));

  const decisionsMade = (conversationMemories || [])
    .filter(m => m.type === 'keyDecision')
    .map(m => m.content);

  // Extract topics from recent messages
  const topicsDiscussed = (conversationMemories || [])
    .filter(m => m.type === 'entity')
    .map(m => m.content)
    .slice(0, 5);

  return {
    currentConversation: {
      recentMessages: (recentMessages || []).slice(-20),
      topicsDiscussed,
      decisionsMade,
    },
    conversationHistory: {
      summaries: summaries.slice(0, 5),
      globalKnowledge: globalKnowledge.slice(0, 20),
    },
  };
}

/* ─── Pattern Insights ─── */

function buildPatternInsights(
  tasks: OfflineTask[],
  moods: OfflineMoodEntry[],
  habits: OfflineHabit[],
  goals: OfflineGoal[]
): PatternInsights {
  // Peak productivity hours (based on task completion times)
  // Since we don't track exact completion hours, we'll use creation patterns
  const peakHours: number[] = [9, 10, 14]; // Default assumption

  // Common task categories
  const catCounts: Record<string, number> = {};
  for (const t of tasks) {
    catCounts[t.category || 'general'] = (catCounts[t.category || 'general'] || 0) + 1;
  }
  const commonTaskCategories = Object.entries(catCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  // Deadline behavior — based on how many tasks are overdue
  const overdue = tasks.filter(t => t.date < formatDateLocal(new Date()) && !t.completed).length;
  const total = tasks.filter(t => !t.completed).length;
  const deadlineBehavior: PatternInsights['behavioralPatterns']['deadlineBehavior'] =
    overdue === 0 ? 'early' :
    overdue / Math.max(total, 1) > 0.3 ? 'last-minute' : 'on-time';

  // Mood vs productivity correlation
  const today = formatDateLocal(new Date());
  const todayMood = moods.find(m => m.date === today);
  const todayCompleted = tasks.filter(t => t.completed && t.date === today).length;
  const moodVsProductivity: PatternInsights['correlations']['moodVsProductivity'] =
    !todayMood ? 'unknown' :
    (todayMood.mood === 'great' || todayMood.mood === 'good') && todayCompleted > 0 ? 'positive' :
    (todayMood.mood === 'low' || todayMood.mood === 'bad') && todayCompleted === 0 ? 'negative' : 'neutral';

  // Task velocity
  const recentCompleted = tasks.filter(t => t.completed).length;
  const taskVelocityTrend: PatternInsights['correlations']['taskVelocityTrend'] =
    recentCompleted > total * 0.5 ? 'increasing' :
    recentCompleted < total * 0.2 ? 'decreasing' : 'stable';

  // Habit success rate
  const habitsDone = habits.filter(h => h.lastCompletedDate === today).length;
  const habitSuccessRate = habits.length > 0 ? habitsDone / habits.length : 0;

  // Predictions
  const likelyToOverlook = tasks
    .filter(t => !t.completed && t.priority !== 'high' && t.date < formatDateLocal(addDays(new Date(), 2)))
    .map(t => t.title)
    .slice(0, 3);

  // Burnout risk: high workload + declining mood + many overdue
  const riskOfBurnout = overdue > 5 &&
    (todayMood?.mood === 'low' || todayMood?.mood === 'bad') &&
    total > 15;

  const suggestedFocusAreas: string[] = [];
  if (overdue > 0) suggestedFocusAreas.push('Clear overdue tasks');
  if (habitsDone < habits.length / 2) suggestedFocusAreas.push('Build habit consistency');
  const activeGoals = goals.filter(g => !g.completed && g.progress < 50);
  if (activeGoals.length > 0) suggestedFocusAreas.push(`Progress on: ${activeGoals[0].title}`);

  return {
    behavioralPatterns: {
      peakProductivityHours: peakHours,
      commonTaskCategories,
      deadlineBehavior,
    },
    correlations: {
      moodVsProductivity,
      taskVelocityTrend,
      habitSuccessRate: Math.round(habitSuccessRate * 100),
    },
    predictions: {
      likelyToOverlook,
      riskOfBurnout,
      suggestedFocusAreas,
    },
  };
}

/* ─── Temporal Context ─── */

function buildTemporalContext(): TemporalContext {
  const now = new Date();
  const hour = now.getHours();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const dayNum = now.getDay(); // 0=Sun, 6=Sat

  const timeOfDay: TemporalContext['timeOfDay'] =
    hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'night';

  const seasonality: TemporalContext['seasonality'] =
    dayNum === 0 || dayNum === 6 ? 'weekend' :
    dayNum === 1 ? 'start-of-week' :
    dayNum === 5 ? 'end-of-week' : 'mid-week';

  return {
    currentDate: formatDateLocal(now),
    timeOfDay,
    dayOfWeek,
    weekNumber: getWeekNumber(now),
    monthProgress: now.getDate() / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(),
    seasonality,
  };
}

/* ─── Main Aggregation Function ─── */

export function buildSyntraUnifiedContext(input: ContextInputData): SyntraUnifiedContext {
  const { profile, settings, tasks, reminders, goals, habits, moods, recentMessages, conversationMemories, globalMemories, deepContextMode } = input;

  const parsedProfile = analyzeProfile(profile, settings);
  const emotionalState = analyzeEmotionalState(moods);
  const plannerContext = buildPlannerContext(tasks);
  const reminderContext = buildReminderContext(reminders);
  const taskContext = buildTaskContext(tasks);
  const memoryLayer = buildMemoryLayer(recentMessages, conversationMemories, globalMemories);
  const temporalContext = buildTemporalContext();

  // Productivity layer
  const today = formatDateLocal(new Date());
  const goalsForProductivity = goals.map(g => ({
    title: g.title,
    progress: g.progress,
    category: g.category,
    completed: g.completed,
  }));
  const habitsForProductivity = habits.map(h => ({
    title: h.title,
    streak: h.streak,
    done: h.lastCompletedDate === today,
    frequency: h.frequency,
  }));
  const completedToday = tasks.filter(t => t.completed && t.date === today).length;
  const totalToday = tasks.filter(t => t.date === today).length;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 50;

  // Productivity score (0-100)
  const productivityScore = Math.min(100, Math.round(
    (completionRate * 0.3) +
    (habitsForProductivity.filter(h => h.done).length / Math.max(habitsForProductivity.length, 1) * 100 * 0.2) +
    (goalsForProductivity.filter(g => g.progress > 50).length / Math.max(goalsForProductivity.length, 1) * 100 * 0.2) +
    (emotionalState.todayMood === 'great' ? 30 : emotionalState.todayMood === 'good' ? 20 : 10)
  ));

  const patternInsights = buildPatternInsights(tasks, moods, habits, goals);

  return {
    identity: {
      name: profile.name || 'User',
      aboutMe: profile.aboutMe || '',
      parsedProfile,
      role: settings.role || '',
      interests: settings.interests ? settings.interests.split(',').map(s => s.trim()).filter(Boolean) : [],
    },
    emotionalState,
    memory: memoryLayer,
    productivity: {
      tasks: taskContext,
      goals: goalsForProductivity,
      habits: habitsForProductivity,
      completionRate,
      productivityScore,
    },
    scheduling: {
      planner: plannerContext,
      reminders: reminderContext,
      timeDensity: plannerContext.timeDensity,
      upcomingConflicts: plannerContext.conflicts,
      freeWindows: plannerContext.freeWindows,
    },
    insights: patternInsights,
    temporal: temporalContext,
    meta: {
      generatedAt: new Date(),
      dataFreshness: 'real-time',
      contextMode: deepContextMode ? 'deep' : 'basic',
    },
  };
}

/* ─── Context Serialization ─── */

/**
 * Convert the full SyntraUnifiedContext into a concise text block
 * suitable for injection into an AI system prompt.
 * Target: MAX 4000 tokens (~16000 chars)
 */
export function serializeContextForPrompt(ctx: SyntraUnifiedContext): string {
  const parts: string[] = [];
  const { identity, emotionalState, memory, productivity, scheduling, insights, temporal } = ctx;

  // IDENTITY (300 tokens)
  parts.push('═══ WHO YOU KNOW ═══');
  parts.push(`Name: ${identity.name}`);
  if (identity.aboutMe) parts.push(`About: ${identity.aboutMe.slice(0, 300)}`);
  if (identity.role) parts.push(`Role: ${identity.role}`);
  if (identity.interests.length > 0) parts.push(`Interests: ${identity.interests.join(', ')}`);
  const p = identity.parsedProfile;
  if (p.personalityTraits.length > 0) parts.push(`Personality: ${p.personalityTraits.join(', ')}`);
  if (p.communicationStyle !== 'friendly') parts.push(`Communication style: ${p.communicationStyle}`);
  if (p.knownConstraints.length > 0) parts.push(`Constraints: ${p.knownConstraints.join('; ')}`);
  if (p.mentionedGoals.length > 0) parts.push(`Mentioned goals: ${p.mentionedGoals.join('; ')}`);
  if (p.lifeSituation) parts.push(`Life situation: ${p.lifeSituation}`);
  if (p.preferences.workStyle !== 'flexible') parts.push(`Work style: ${p.preferences.workStyle}`);
  if (p.preferences.stressTriggers.length > 0) parts.push(`Stress triggers: ${p.preferences.stressTriggers.join(', ')}`);

  // EMOTIONAL STATE (200 tokens)
  parts.push('');
  parts.push('═══ HOW THEY FEEL ═══');
  if (emotionalState.todayMood) parts.push(`Today's mood: ${emotionalState.todayMood}, energy: ${emotionalState.energyLevel}/5`);
  else parts.push('No mood check-in today');
  if (emotionalState.moodTrend !== 'stable') parts.push(`Mood trend: ${emotionalState.moodTrend}`);
  if (emotionalState.moodHistory.length > 1) {
    const avg = emotionalState.moodHistory.slice(0, 3).map(m => m.mood).join(' → ');
    parts.push(`Recent moods: ${avg}`);
  }

  // MEMORY (800 tokens)
  parts.push('');
  parts.push('═══ WHAT THEY REMEMBER ═══');
  if (memory.conversationHistory.globalKnowledge.length > 0) {
    const memStr = memory.conversationHistory.globalKnowledge
      .slice(0, 10)
      .map(m => `${m.key}: ${m.value} (${Math.round(m.confidence * 100)}% confidence)`)
      .join('; ');
    parts.push(`Known preferences/facts: ${memStr}`);
  }
  if (memory.conversationHistory.summaries.length > 0) {
    const summStr = memory.conversationHistory.summaries
      .slice(0, 3)
      .map(s => s.content.slice(0, 100))
      .join(' | ');
    parts.push(`Past conversation summaries: ${summStr}`);
  }
  if (memory.currentConversation.decisionsMade.length > 0) {
    parts.push(`Recent decisions: ${memory.currentConversation.decisionsMade.join('; ')}`);
  }
  if (memory.currentConversation.topicsDiscussed.length > 0) {
    parts.push(`Active topics: ${memory.currentConversation.topicsDiscussed.join(', ')}`);
  }

  // TASKS (800 tokens)
  parts.push('');
  parts.push('═══ WHAT THEY\'RE DOING ═══');
  const t = productivity.tasks;
  parts.push(`Tasks: ${t.summary.todo} pending, ${t.summary.completedToday} done today, ${t.summary.overdue} overdue`);
  if (t.highPriority.length > 0) {
    parts.push(`HIGH PRIORITY: ${t.highPriority.slice(0, 5).map(t => `"${t.title}"${t.time ? ` at ${t.time}` : ''}`).join(', ')}`);
  }
  if (t.dueToday.length > 0) {
    parts.push(`Due today: ${t.dueToday.slice(0, 5).map(t => `"${t.title}"${t.time ? ` at ${t.time}` : ''}${t.priority === 'high' ? ' [!]' : ''}`).join(', ')}`);
  }
  if (t.summary.overdue > 0) {
    parts.push(`OVERDUE: ${t.abandoned.slice(0, 3).map(t => `"${t.title}"`).join(', ')}`);
  }
  if (t.recentlyCompleted.length > 0) {
    parts.push(`Recently completed: ${t.recentlyCompleted.slice(0, 3).map(t => `"${t.title}"`).join(', ')}`);
  }
  parts.push(`Workload: ${t.workloadAnalysis.trend} (${t.workloadAnalysis.completionRate}% completion rate)`);

  // PLANNER (600 tokens)
  parts.push('');
  parts.push('═══ WHERE THEY NEED TO BE ═══');
  const pl = scheduling.planner;
  parts.push(`Today: ${pl.today.count} tasks, Tomorrow: ${pl.tomorrow.count} tasks`);
  if (pl.overdue.length > 0) parts.push(`Overdue: ${pl.overdue.slice(0, 3).map(t => `"${t.title}"`).join(', ')}`);
  if (pl.conflicts.length > 0) parts.push(`⚠ CONFLICTS: ${pl.conflicts.map(c => `${c.task1} & ${c.task2} at ${c.time}`).join('; ')}`);
  parts.push(`Schedule density: Now=${pl.timeDensity.now}, Today=${pl.timeDensity.today}, Week=${pl.timeDensity.thisWeek}`);
  if (pl.freeWindows.length > 0) parts.push(`Free time: ${pl.freeWindows.map(w => `${w.start}-${w.end} (${w.durationMin}min)`).join(', ')}`);

  // REMINDERS (400 tokens)
  parts.push('');
  parts.push('═══ WHAT NOT TO FORGET ═══');
  const rm = scheduling.reminders;
  parts.push(`Reminders: ${rm.patterns.totalActive} active, ${rm.patterns.recurringCount} recurring`);
  if (rm.active.length > 0) {
    parts.push(`Active: ${rm.active.slice(0, 5).map(r => `"${r.title}"${r.time ? ` at ${r.time}` : ''}${r.recurring ? ` (${r.recurring})` : ''}`).join(', ')}`);
  }
  if (rm.recentlyCompleted.length > 0) {
    parts.push(`Recently done: ${rm.recentlyCompleted.slice(0, 3).map(r => `"${r.title}"`).join(', ')}`);
  }

  // GOALS & HABITS (300 tokens)
  parts.push('');
  parts.push('═══ PROGRESS ═══');
  if (productivity.goals.length > 0) {
    parts.push(`Goals: ${productivity.goals.filter(g => !g.completed).slice(0, 5).map(g => `"${g.title}" (${g.progress}%)`).join(', ')}`);
  }
  if (productivity.habits.length > 0) {
    parts.push(`Habits: ${productivity.habits.slice(0, 5).map(h => `"${h.title}" (${h.done ? '✓' : '○'}, ${h.streak}-day streak)`).join(', ')}`);
  }
  parts.push(`Productivity score: ${productivity.productivityScore}/100`);

  // INSIGHTS (400 tokens)
  parts.push('');
  parts.push('═══ PATTERNS & INSIGHTS ═══');
  if (insights.predictions.likelyToOverlook.length > 0) {
    parts.push(`May overlook: ${insights.predictions.likelyToOverlook.join(', ')}`);
  }
  if (insights.predictions.riskOfBurnout) parts.push('⚠ BURNOUT RISK DETECTED');
  if (insights.predictions.suggestedFocusAreas.length > 0) {
    parts.push(`Suggested focus: ${insights.predictions.suggestedFocusAreas.join('; ')}`);
  }
  if (insights.correlations.moodVsProductivity !== 'unknown') {
    parts.push(`Mood-productivity: ${insights.correlations.moodVsProductivity}`);
  }
  if (insights.behavioralPatterns.deadlineBehavior !== 'unknown') {
    parts.push(`Deadline style: ${insights.behavioralPatterns.deadlineBehavior}`);
  }

  // TEMPORAL (200 tokens)
  parts.push('');
  parts.push('═══ RIGHT NOW ═══');
  parts.push(`Date: ${temporal.currentDate} (${temporal.dayOfWeek} ${temporal.timeOfDay})`);
  parts.push(`Week ${temporal.weekNumber}, ${Math.round(temporal.monthProgress * 100)}% through month, ${temporal.seasonality}`);
  parts.push(`Context generated: ${ctx.meta.generatedAt.toISOString()}`);

  return parts.join('\n');
}

/**
 * Build a BASIC context (for when Deep Context Mode is OFF).
 * Only includes: name, mood, basic tasks count, time.
 */
export function serializeBasicContextForPrompt(ctx: SyntraUnifiedContext): string {
  const parts: string[] = [];
  parts.push(`User's name: ${ctx.identity.name}`);
  if (ctx.identity.aboutMe) parts.push(`About: ${ctx.identity.aboutMe.slice(0, 150)}`);
  if (ctx.identity.role) parts.push(`Role: ${ctx.identity.role}`);
  if (ctx.emotionalState.todayMood) parts.push(`Mood: ${ctx.emotionalState.todayMood}, energy: ${ctx.emotionalState.energyLevel}/5`);
  parts.push(`Pending tasks: ${ctx.productivity.tasks.summary.todo}, Overdue: ${ctx.productivity.tasks.summary.overdue}`);
  parts.push(`Time: ${ctx.temporal.dayOfWeek} ${ctx.temporal.timeOfDay}`);
  return parts.join('\n');
}
