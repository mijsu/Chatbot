/**
 * Data Validator — Complete Reality-Based Intelligence Protocol (Section 4-6)
 *
 * Core data validation layer that sits BETWEEN raw IndexedDB data and AI context injection.
 * Implements the DataAvailabilityReport interface and anti-hallucination safeguards.
 *
 * Architecture:
 * ┌────────────┐     ┌──────────────────┐     ┌──────────────────┐
 * │  IndexedDB │ ──→ │  DataValidator    │ ──→ │  AI Context      │
 * │  (raw)     │     │  (availability)   │     │  (safe, scoped)  │
 * └────────────┘     └──────────────────┘     └──────────────────┘
 *                           ↓
 *                  ┌──────────────────┐
 *                  │  Anti-Hallucination│
 *                  │  Context Builder  │
 *                  └──────────────────┘
 */

import type {
  OfflineTask,
  OfflineReminder,
  OfflineGoal,
  OfflineHabit,
  OfflineMoodEntry,
  OfflineUserProfile,
  OfflineUserSettings,
  OfflineConversation,
} from './offline-db';

/* ═══════════════════════════════════════════════════════════════
   Section 4.1: DataAvailabilityReport Interface
   ═══════════════════════════════════════════════════════════════ */

export interface DataAvailabilityReport {
  profile: {
    exists: boolean;
    name: string | null;
    aboutMe: string | null;
    completeness: number; // 0-100
  };
  tasks: {
    count: number;
    hasOverdue: boolean;
    hasToday: boolean;
    hasUpcoming: boolean;
    categories: string[];
  };
  reminders: {
    activeCount: number;
    hasRecurring: boolean;
    upcoming24h: number;
  };
  planner: {
    hasEventsToday: boolean;
    hasEventsThisWeek: boolean;
    eventCountToday: number;
  };
  goals: {
    count: number;
    activeGoals: string[];
    anyNearCompletion: boolean;
  };
  habits: {
    count: number;
    activeStreaks: number;
    completedToday: number;
  };
  moods: {
    hasTodayEntry: boolean;
    historyLength: number;
    canCalculateTrend: boolean;
  };
  conversations: {
    totalCount: number;
    recentMessageCount: number;
    hasHistory: boolean;
  };
}

/* ═══════════════════════════════════════════════════════════════
   Section 6.1: EmptyStateProtocol Interface & Instances
   ═══════════════════════════════════════════════════════════════ */

export type EmptyStateCategory =
  | 'profile'
  | 'tasks'
  | 'reminders'
  | 'planner'
  | 'goals'
  | 'habits'
  | 'moods'
  | 'conversations';

export type EmptyStateAction =
  | 'encourage_first_action'
  | 'offer_suggestion'
  | 'skip_section'
  | 'use_general_knowledge'
  | 'ask_user';

export interface EmptyStateProtocol {
  category: EmptyStateCategory;
  hasData: boolean;
  strategy: EmptyStateAction;
  fallbackMessage: string;
  forbiddenClaims: string[];
  suggestedPrompt?: string;
}

export const emptyStateProtocols: EmptyStateProtocol[] = [
  {
    category: 'profile',
    hasData: false,
    strategy: 'encourage_first_action',
    fallbackMessage: "I don't know much about you yet. Tell me about yourself so I can personalize your experience.",
    forbiddenClaims: [
      'Claiming to know the user\'s preferences',
      'Referencing the user\'s name without data',
      'Assuming the user\'s role or occupation',
      'Making assumptions about work style or schedule',
    ],
    suggestedPrompt: 'What\'s your name and what do you do?',
  },
  {
    category: 'tasks',
    hasData: false,
    strategy: 'offer_suggestion',
    fallbackMessage: 'You don\'t have any tasks yet. Would you like help planning your day?',
    forbiddenClaims: [
      'Referencing "your tasks" as if they exist',
      'Saying "Don\'t forget to..." when no tasks are set',
      'Claiming the user is "busy" or "has a lot on their plate"',
      'Referencing specific task categories or priorities',
    ],
    suggestedPrompt: 'Help me plan my tasks for today',
  },
  {
    category: 'reminders',
    hasData: false,
    strategy: 'offer_suggestion',
    fallbackMessage: 'No reminders set up yet. Reminders help you stay on track — want to create one?',
    forbiddenClaims: [
      'Saying "Don\'t forget to..." when no reminders exist',
      'Referencing "your reminders" as if they exist',
      'Claiming the user "usually" or "typically" forgets things',
      'Referencing recurring patterns that don\'t exist',
    ],
    suggestedPrompt: 'Set a reminder for me',
  },
  {
    category: 'planner',
    hasData: false,
    strategy: 'skip_section',
    fallbackMessage: 'Your planner is empty. Add tasks or events to get schedule insights.',
    forbiddenClaims: [
      'Saying "Your schedule looks packed" when planner is empty',
      'Referencing "your meetings" or "your appointments"',
      'Claiming time conflicts exist',
      'Referencing "free time" or "busy periods" without data',
    ],
    suggestedPrompt: 'Help me organize my schedule',
  },
  {
    category: 'goals',
    hasData: false,
    strategy: 'encourage_first_action',
    fallbackMessage: 'No goals set yet. Setting goals gives you direction and motivation.',
    forbiddenClaims: [
      'Claiming to know the user\'s ambitions',
      'Referencing "your progress" on goals',
      'Saying "You\'re close to completing..." without data',
      'Assuming what the user wants to achieve',
    ],
    suggestedPrompt: 'Help me set a goal',
  },
  {
    category: 'habits',
    hasData: false,
    strategy: 'encourage_first_action',
    fallbackMessage: 'No habits tracked yet. Tracking habits helps build consistency.',
    forbiddenClaims: [
      'Claiming "You\'ve been consistent with..." without data',
      'Referencing "your streak" when no habits exist',
      'Saying "You usually do X at this time"',
      'Making claims about habit completion rates',
    ],
    suggestedPrompt: 'Help me start a daily habit',
  },
  {
    category: 'moods',
    hasData: false,
    strategy: 'ask_user',
    fallbackMessage: 'I don\'t have any mood data yet. How are you feeling today?',
    forbiddenClaims: [
      'Claiming "You seem to be feeling..." without mood data',
      'Referencing mood trends or patterns',
      'Saying "Your energy is usually..." without data',
      'Making correlations between mood and productivity',
    ],
    suggestedPrompt: 'How are you feeling today?',
  },
  {
    category: 'conversations',
    hasData: false,
    strategy: 'use_general_knowledge',
    fallbackMessage: 'We haven\'t chatted before. I\'m here whenever you need to talk.',
    forbiddenClaims: [
      'Claiming "We discussed..." when no history exists',
      'Referencing "last time you mentioned..." without data',
      'Saying "As we talked about before"',
      'Claiming continuity from past conversations',
    ],
    suggestedPrompt: 'Tell me something interesting',
  },
];

/* ═══════════════════════════════════════════════════════════════
   Section 5.1: Pattern Detection Thresholds
   ═══════════════════════════════════════════════════════════════ */

export const PATTERN_THRESHOLDS = {
  taskCompletionTime: { minDataPoints: 15, minDays: 14 },
  preferredTaskCategory: { minDataPoints: 20, minDays: 30 },
  streakConsistency: { minDataPoints: 7, minDays: 21 },
  moodCorrelation: { minDataPoints: 14, minDays: 14 },
  energyFluctuation: { minDataPoints: 14, minDays: 14 },
  habitSuccessRate: { minDataPoints: 21, minDays: 21 },
} as const;

export type PatternType = keyof typeof PATTERN_THRESHOLDS;

export interface PatternDetectionResult {
  canDetect: boolean;
  confidenceLevel: 'none' | 'low' | 'moderate' | 'high';
  dataPoints: number;
}

/* ═══════════════════════════════════════════════════════════════
   Section 4.2: Scenario Types
   ═══════════════════════════════════════════════════════════════ */

export type ScenarioType = 'A' | 'B' | 'C' | 'D' | 'E';

/**
 * Scenario Definitions (from Section 4.2):
 *
 * A — Fresh Start:  No data at all (new user). AI should be exploratory and encouraging.
 * B — Partial Data: Some categories have data, others are empty. AI should stay within
 *                    data boundaries and acknowledge gaps.
 * C — Rich Data:    Most categories have data. AI can make informed observations but
 *                    must stay grounded in actual data.
 * D — Historical:   Has past data but no recent activity. AI should reference what it
 *                    knows but note the gap and avoid assuming current state.
 * E — Abundant:     Deep data across categories with enough for pattern detection.
 *                    AI can identify patterns with appropriate confidence levels.
 */

/* ═══════════════════════════════════════════════════════════════
   DataValidator Class
   ═══════════════════════════════════════════════════════════════ */

export class DataValidator {
  /* ─── Helpers ─── */

  private static formatDateLocal(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private static addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private static countUniqueDays(dates: string[]): number {
    return new Set(dates).size;
  }

  /**
   * Generate a DataAvailabilityReport from raw IndexedDB data.
   *
   * This is the FIRST step before any AI context is built — it establishes
   * exactly what data exists and what doesn't.
   */
  static generateAvailabilityReport(
    tasks: OfflineTask[],
    reminders: OfflineReminder[],
    goals: OfflineGoal[],
    habits: OfflineHabit[],
    moods: OfflineMoodEntry[],
    profile: OfflineUserProfile | undefined,
    settings: OfflineUserSettings | undefined,
    conversations: OfflineConversation[],
  ): DataAvailabilityReport {
    const today = this.formatDateLocal(new Date());
    const tomorrow = this.formatDateLocal(this.addDays(new Date(), 1));
    const endOfWeek = this.formatDateLocal(this.addDays(new Date(), 7));

    // ─── Profile ───
    const profileExists = !!(profile && profile.name && profile.name.trim().length > 0);
    const profileCompleteness = (() => {
      if (!profile) return 0;
      let score = 0;
      if (profile.name?.trim()) score += 30;
      if (profile.aboutMe?.trim()) score += 30;
      if (profile.status?.trim()) score += 10;
      if (settings?.role?.trim()) score += 15;
      if (settings?.interests?.trim()) score += 15;
      return Math.min(100, score);
    })();

    // ─── Tasks ───
    const activeTasks = tasks.filter(t => !t.completed);
    const todayTasks = tasks.filter(t => t.date === today);
    const overdueTasks = tasks.filter(t => t.date < today && !t.completed);
    const upcomingTasks = tasks.filter(t => t.date > today && !t.completed);
    const categories = [...new Set(activeTasks.map(t => t.category || 'general'))];

    // ─── Reminders ───
    const activeReminders = reminders.filter(r => !r.completed);
    const recurringReminders = activeReminders.filter(r => r.recurring && r.recurring !== '');
    const upcoming24hReminders = activeReminders.slice(0, 20); // All active are potentially upcoming (no due date field)

    // ─── Planner (derived from tasks) ───
    const todayEvents = todayTasks;
    const thisWeekEvents = tasks.filter(t =>
      t.date >= today && t.date <= endOfWeek
    );

    // ─── Goals ───
    const activeGoalsList = goals.filter(g => !g.completed && g.progress < 100);
    const nearCompletionGoals = activeGoalsList.filter(g => g.progress >= 75);

    // ─── Habits ───
    const todayCompletedHabits = habits.filter(h => h.lastCompletedDate === today);
    const habitsWithStreak = habits.filter(h => h.streak >= 2);

    // ─── Moods ───
    const todayMood = moods.find(m => m.date === today);
    const moodDates = moods.map(m => m.date);
    const uniqueMoodDays = this.countUniqueDays(moodDates);

    // ─── Conversations ───
    // Note: we estimate recentMessageCount from conversation count since
    // messages are passed separately; this report works with what's available
    const hasConvoHistory = conversations.length > 0;

    return {
      profile: {
        exists: profileExists,
        name: profile?.name?.trim() || null,
        aboutMe: profile?.aboutMe?.trim() || null,
        completeness: profileCompleteness,
      },
      tasks: {
        count: activeTasks.length,
        hasOverdue: overdueTasks.length > 0,
        hasToday: todayTasks.length > 0,
        hasUpcoming: upcomingTasks.length > 0,
        categories,
      },
      reminders: {
        activeCount: activeReminders.length,
        hasRecurring: recurringReminders.length > 0,
        upcoming24h: upcoming24hReminders.length,
      },
      planner: {
        hasEventsToday: todayEvents.length > 0,
        hasEventsThisWeek: thisWeekEvents.length > 0,
        eventCountToday: todayEvents.length,
      },
      goals: {
        count: activeGoalsList.length,
        activeGoals: activeGoalsList.map(g => g.title),
        anyNearCompletion: nearCompletionGoals.length > 0,
      },
      habits: {
        count: habits.length,
        activeStreaks: habitsWithStreak.length,
        completedToday: todayCompletedHabits.length,
      },
      moods: {
        hasTodayEntry: !!todayMood,
        historyLength: moods.length,
        canCalculateTrend: uniqueMoodDays >= 5,
      },
      conversations: {
        totalCount: conversations.length,
        recentMessageCount: conversations.length, // Proxied from conversation count
        hasHistory: hasConvoHistory,
      },
    };
  }

  /**
   * Determine which scenario template to use based on data availability.
   *
   * A — Fresh Start: No profile, no tasks, no conversations
   * B — Partial Data: Some categories filled, some empty
   * C — Rich Data: Most categories have data
   * D — Historical: Has data but no recent activity (no today data)
   * E — Abundant: Deep data with pattern detection capability
   */
  static determineScenario(report: DataAvailabilityReport): ScenarioType {
    // Count how many categories have data
    const categoriesWithData: boolean[] = [
      report.profile.exists,
      report.tasks.count > 0,
      report.reminders.activeCount > 0,
      report.planner.hasEventsToday || report.planner.hasEventsThisWeek,
      report.goals.count > 0,
      report.habits.count > 0,
      report.moods.historyLength > 0,
      report.conversations.hasHistory,
    ];

    const filledCount = categoriesWithData.filter(Boolean).length;

    // Scenario A: Fresh Start — almost nothing
    if (filledCount <= 1 && !report.profile.exists && report.tasks.count === 0) {
      return 'A';
    }

    // Check for pattern detection capability (Scenario E)
    const canDetectPatterns = this.assessPatternDetectionCapability(report);
    if (filledCount >= 6 && canDetectPatterns.confidenceLevel === 'high') {
      return 'E';
    }

    // Check for historical but stale data (Scenario D)
    const hasAnyData = filledCount >= 3;
    const hasNoRecentActivity =
      !report.tasks.hasToday &&
      !report.planner.hasEventsToday &&
      !report.moods.hasTodayEntry &&
      report.habits.completedToday === 0;

    if (hasAnyData && hasNoRecentActivity && filledCount >= 3) {
      return 'D';
    }

    // Rich data (Scenario C)
    if (filledCount >= 6) {
      return 'C';
    }

    // Partial data (Scenario B) — the most common case
    return 'B';
  }

  /**
   * Get the empty state strategy for a specific category.
   * Returns the protocol from emptyStateProtocols, updated with actual hasData status.
   */
  static getEmptyStateStrategy(
    category: EmptyStateCategory,
    report: DataAvailabilityReport,
  ): EmptyStateProtocol {
    // Determine if this category has data based on the report
    const hasData = this.categoryHasData(category, report);

    // Find the base protocol
    const baseProtocol = emptyStateProtocols.find(p => p.category === category) ||
      emptyStateProtocols[0]; // Fallback to profile protocol

    return {
      ...baseProtocol,
      hasData,
      // Update strategy based on hasData
      strategy: hasData ? 'use_general_knowledge' : baseProtocol.strategy,
    };
  }

  /**
   * Check if a category has actual data based on the availability report.
   */
  private static categoryHasData(
    category: EmptyStateCategory,
    report: DataAvailabilityReport,
  ): boolean {
    switch (category) {
      case 'profile':
        return report.profile.exists;
      case 'tasks':
        return report.tasks.count > 0;
      case 'reminders':
        return report.reminders.activeCount > 0;
      case 'planner':
        return report.planner.hasEventsToday || report.planner.hasEventsThisWeek;
      case 'goals':
        return report.goals.count > 0;
      case 'habits':
        return report.habits.count > 0;
      case 'moods':
        return report.moods.historyLength > 0;
      case 'conversations':
        return report.conversations.hasHistory;
      default:
        return false;
    }
  }

  /**
   * Build a concise context string for AI with data availability awareness.
   * This is the CONTEXT that gets injected into AI prompts — it tells the AI
   * exactly what it can and cannot reference.
   */
  static buildContextForAI(
    report: DataAvailabilityReport,
    rawData: {
      tasks: OfflineTask[];
      reminders: OfflineReminder[];
      goals: OfflineGoal[];
      habits: OfflineHabit[];
      moods: OfflineMoodEntry[];
      profile?: OfflineUserProfile;
    },
  ): string {
    const parts: string[] = [];
    const today = this.formatDateLocal(new Date());

    // ─── Data Availability Summary ───
    parts.push('═══ DATA AVAILABILITY ═══');
    parts.push(`Profile: ${report.profile.exists ? `YES (${report.profile.name})` : 'NONE'}`);
    parts.push(`Tasks: ${report.tasks.count > 0 ? `${report.tasks.count} active` : 'NONE'}${report.tasks.hasOverdue ? ' [HAS OVERDUE]' : ''}`);
    parts.push(`Reminders: ${report.reminders.activeCount > 0 ? `${report.reminders.activeCount} active` : 'NONE'}`);
    parts.push(`Planner: ${report.planner.hasEventsToday ? `${report.planner.eventCountToday} events today` : 'EMPTY TODAY'}`);
    parts.push(`Goals: ${report.goals.count > 0 ? `${report.goals.count} active` : 'NONE'}`);
    parts.push(`Habits: ${report.habits.count > 0 ? `${report.habits.count} tracked` : 'NONE'}`);
    parts.push(`Moods: ${report.moods.historyLength > 0 ? `${report.moods.historyLength} entries` : 'NONE'}${report.moods.hasTodayEntry ? ' [HAS TODAY]' : ''}`);
    parts.push(`Conversations: ${report.conversations.hasHistory ? `${report.conversations.totalCount} total` : 'NONE'}`);
    parts.push('');

    // ─── Scenario ───
    const scenario = this.determineScenario(report);
    parts.push(`Scenario: ${scenario} (${this.getScenarioDescription(scenario)})`);
    parts.push('');

    // ─── Actual Data (only what exists) ───
    if (report.profile.exists) {
      parts.push('═══ PROFILE ═══');
      if (rawData.profile?.name) parts.push(`Name: ${rawData.profile.name}`);
      if (rawData.profile?.aboutMe?.trim()) parts.push(`About: ${rawData.profile.aboutMe.trim().slice(0, 300)}`);
      parts.push('');
    }

    if (report.tasks.count > 0) {
      parts.push('═══ TASKS ═══');
      const todayTasks = rawData.tasks.filter(t => t.date === today);
      const overdueTasks = rawData.tasks.filter(t => t.date < today && !t.completed);

      if (todayTasks.length > 0) {
        const pending = todayTasks.filter(t => !t.completed);
        const completed = todayTasks.filter(t => t.completed);
        if (pending.length > 0) {
          parts.push(`Today pending (${pending.length}): ${pending.slice(0, 8).map(t => `"${t.title}"${t.time ? ` at ${t.time}` : ''}${t.priority === 'high' ? ' [HIGH]' : ''}`).join(', ')}`);
        }
        if (completed.length > 0) {
          parts.push(`Today completed (${completed.length}): ${completed.slice(0, 5).map(t => `"${t.title}"`).join(', ')}`);
        }
      }
      if (overdueTasks.length > 0) {
        parts.push(`Overdue (${overdueTasks.length}): ${overdueTasks.slice(0, 5).map(t => `"${t.title}"`).join(', ')}`);
      }
      if (report.tasks.categories.length > 0) {
        parts.push(`Categories: ${report.tasks.categories.join(', ')}`);
      }
      parts.push('');
    }

    if (report.reminders.activeCount > 0) {
      parts.push('═══ REMINDERS ═══');
      const activeReminders = rawData.reminders.filter(r => !r.completed);
      parts.push(`Active (${activeReminders.length}): ${activeReminders.slice(0, 8).map(r => `"${r.title}"${r.time ? ` at ${r.time}` : ''}${r.recurring ? ` (${r.recurring})` : ''}`).join(', ')}`);
      if (report.reminders.hasRecurring) {
        const recurring = activeReminders.filter(r => r.recurring && r.recurring !== '');
        parts.push(`Recurring: ${recurring.map(r => `"${r.title}" (${r.recurring})`).join(', ')}`);
      }
      parts.push('');
    }

    if (report.goals.count > 0) {
      parts.push('═══ GOALS ═══');
      const activeGoals = rawData.goals.filter(g => !g.completed);
      parts.push(`Active (${activeGoals.length}): ${activeGoals.slice(0, 6).map(g => `"${g.title}" (${g.progress}%)`).join(', ')}`);
      if (report.goals.anyNearCompletion) {
        const nearCompletion = activeGoals.filter(g => g.progress >= 75);
        parts.push(`Near completion: ${nearCompletion.map(g => `"${g.title}" (${g.progress}%)`).join(', ')}`);
      }
      parts.push('');
    }

    if (report.habits.count > 0) {
      parts.push('═══ HABITS ═══');
      parts.push(`Tracked (${rawData.habits.length}): ${rawData.habits.slice(0, 6).map(h => `"${h.title}" (${h.lastCompletedDate === today ? 'done today' : 'pending'}, ${h.streak}-day streak)`).join('; ')}`);
      if (report.habits.activeStreaks > 0) {
        const withStreaks = rawData.habits.filter(h => h.streak >= 2);
        parts.push(`Active streaks: ${withStreaks.map(h => `"${h.title}" (${h.streak} days)`).join(', ')}`);
      }
      parts.push('');
    }

    if (report.moods.historyLength > 0) {
      parts.push('═══ MOOD ═══');
      const todayMood = rawData.moods.find(m => m.date === today);
      if (todayMood) {
        parts.push(`Today: ${todayMood.mood}, energy ${todayMood.energy}/5${todayMood.note ? ` — "${todayMood.note}"` : ''}`);
      } else {
        parts.push('No entry today');
      }
      // Recent mood history (last 5)
      const recentMoods = [...rawData.moods]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5);
      if (recentMoods.length > 0) {
        parts.push(`Recent: ${recentMoods.map(m => `${m.date}: ${m.mood} (${m.energy}/5)`).join(' → ')}`);
      }
      if (report.moods.canCalculateTrend) {
        parts.push('[Trend data available — can reference mood trends with appropriate hedging]');
      }
      parts.push('');
    }

    // ─── Empty Categories Warning ───
    const emptyCategories: string[] = [];
    if (!report.profile.exists) emptyCategories.push('profile');
    if (report.tasks.count === 0) emptyCategories.push('tasks');
    if (report.reminders.activeCount === 0) emptyCategories.push('reminders');
    if (!report.planner.hasEventsToday && !report.planner.hasEventsThisWeek) emptyCategories.push('planner');
    if (report.goals.count === 0) emptyCategories.push('goals');
    if (report.habits.count === 0) emptyCategories.push('habits');
    if (report.moods.historyLength === 0) emptyCategories.push('moods');
    if (!report.conversations.hasHistory) emptyCategories.push('conversations');

    if (emptyCategories.length > 0) {
      parts.push('═══ EMPTY CATEGORIES — DO NOT REFERENCE ═══');
      parts.push(`No data for: ${emptyCategories.join(', ')}`);
      parts.push('For these categories: use the appropriate empty state strategy.');
      parts.push('');
    }

    return parts.join('\n');
  }

  /**
   * Assess whether pattern detection is reliable based on data volume.
   * Uses PATTERN_THRESHOLDS to determine confidence levels.
   */
  static assessPatternDetectionCapability(
    report: DataAvailabilityReport,
  ): PatternDetectionResult {
    // Aggregate available data points across categories relevant to pattern detection
    const taskDataPoints = report.tasks.count;
    const moodDataPoints = report.moods.historyLength;
    const habitDataPoints = report.habits.count;

    // Total data points (rough estimate for overall pattern capability)
    const dataPoints = taskDataPoints + moodDataPoints + habitDataPoints;

    // Determine confidence based on thresholds
    // We need at least moderate data in at least 2 categories for any pattern
    const meetsTaskThreshold = taskDataPoints >= PATTERN_THRESHOLDS.taskCompletionTime.minDataPoints;
    const meetsMoodThreshold = moodDataPoints >= PATTERN_THRESHOLDS.moodCorrelation.minDataPoints;
    const meetsHabitThreshold = habitDataPoints >= PATTERN_THRESHOLDS.habitSuccessRate.minDataPoints;

    const categoriesMeetingThreshold = [meetsTaskThreshold, meetsMoodThreshold, meetsHabitThreshold]
      .filter(Boolean).length;

    if (categoriesMeetingThreshold >= 3) {
      return { canDetect: true, confidenceLevel: 'high', dataPoints };
    }
    if (categoriesMeetingThreshold >= 2) {
      return { canDetect: true, confidenceLevel: 'moderate', dataPoints };
    }
    if (dataPoints >= 10) {
      return { canDetect: true, confidenceLevel: 'low', dataPoints };
    }
    return { canDetect: false, confidenceLevel: 'none', dataPoints };
  }

  /**
   * Get a human-readable description for each scenario.
   */
  static getScenarioDescription(scenario: ScenarioType): string {
    switch (scenario) {
      case 'A': return 'Fresh Start — new user, minimal data';
      case 'B': return 'Partial Data — some categories filled, gaps exist';
      case 'C': return 'Rich Data — most categories have data';
      case 'D': return 'Historical — past data exists but no recent activity';
      case 'E': return 'Abundant — deep data, pattern detection available';
    }
  }

  /**
   * Build the anti-hallucination context block for AI system prompts.
   *
   * This is injected into system prompts to tell the AI EXACTLY:
   * - What data is available and what is NOT
   * - Which scenario template to follow
   * - Specific forbidden patterns (from Section 3.2)
   * - Pattern confidence levels (from Section 5.2)
   * - Empty state strategies per category
   */
  static buildAntiHallucinationContext(report: DataAvailabilityReport): string {
    const parts: string[] = [];
    const scenario = this.determineScenario(report);
    const patternCapability = this.assessPatternDetectionCapability(report);

    parts.push('═══════════════════════════════════════');
    parts.push('ANTI-HALLUCINATION PROTOCOL — MANDATORY');
    parts.push('═══════════════════════════════════════');
    parts.push('');

    // ─── Scenario ───
    parts.push(`CURRENT SCENARIO: ${scenario} — ${this.getScenarioDescription(scenario)}`);
    parts.push(`Follow the ${scenario} scenario template strictly. Do not assume data that doesn't exist.`);
    parts.push('');

    // ─── Data Availability Matrix ───
    parts.push('DATA AVAILABILITY (reference ONLY what says YES):');
    parts.push(`  Profile:      ${report.profile.exists ? '✅ YES' : '❌ NO DATA'}`);
    parts.push(`  Tasks:        ${report.tasks.count > 0 ? `✅ YES (${report.tasks.count} active)` : '❌ NO DATA'}`);
    parts.push(`  Reminders:    ${report.reminders.activeCount > 0 ? `✅ YES (${report.reminders.activeCount} active)` : '❌ NO DATA'}`);
    parts.push(`  Planner:      ${report.planner.hasEventsToday ? `✅ YES (${report.planner.eventCountToday} today)` : report.planner.hasEventsThisWeek ? '⚠️ THIS WEEK ONLY' : '❌ NO DATA'}`);
    parts.push(`  Goals:        ${report.goals.count > 0 ? `✅ YES (${report.goals.count} active)` : '❌ NO DATA'}`);
    parts.push(`  Habits:       ${report.habits.count > 0 ? `✅ YES (${report.habits.count} tracked)` : '❌ NO DATA'}`);
    parts.push(`  Moods:        ${report.moods.historyLength > 0 ? `✅ YES (${report.moods.historyLength} entries)` : '❌ NO DATA'}`);
    parts.push(`  Conversations:${report.conversations.hasHistory ? `✅ YES (${report.conversations.totalCount} total)` : '❌ NO DATA'}`);
    parts.push('');

    // ─── Forbidden Patterns (Section 3.2) ───
    parts.push('FORBIDDEN PATTERNS — NEVER do these without data:');
    parts.push('  ❌ "You\'re probably..." — do not guess user state without data');
    parts.push('  ❌ "Most people..." — do not use population averages as if they apply to this user');
    parts.push('  ❌ "Based on your usual patterns..." — ONLY if pattern confidence is moderate+');
    parts.push('  ❌ "Don\'t forget to..." — ONLY if a task/reminder actually exists');
    parts.push('  ❌ "Your schedule looks packed" — ONLY if planner has multiple events');
    parts.push('  ❌ "You seem to prefer..." — ONLY if there\'s enough data for that pattern');
    parts.push('  ❌ "As we discussed before" — ONLY if conversation history exists');
    parts.push('  ❌ "You\'re making great progress" — ONLY if there are goals with high progress');
    parts.push('');

    // ─── Pattern Confidence Levels (Section 5.2) ───
    parts.push(`PATTERN DETECTION: ${patternCapability.canDetect ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
    parts.push(`  Overall confidence: ${patternCapability.confidenceLevel}`);
    parts.push(`  Data points: ${patternCapability.dataPoints}`);
    if (patternCapability.confidenceLevel === 'low') {
      parts.push('  ⚠️ Low confidence — hedge all pattern claims ("I\'m starting to notice...", "It seems like...")');
    }
    if (patternCapability.confidenceLevel === 'none') {
      parts.push('  🚫 Do NOT make ANY pattern claims — no behavioral, mood, or productivity patterns');
    }
    parts.push('');

    // ─── Empty State Strategies ───
    parts.push('EMPTY STATE STRATEGIES (for categories with NO DATA):');
    const allCategories: EmptyStateCategory[] = [
      'profile', 'tasks', 'reminders', 'planner', 'goals', 'habits', 'moods', 'conversations',
    ];
    for (const cat of allCategories) {
      const strategy = this.getEmptyStateStrategy(cat, report);
      if (!strategy.hasData) {
        parts.push(`  ${cat}: ${strategy.strategy} — "${strategy.fallbackMessage.slice(0, 80)}"`);
      }
    }
    parts.push('');

    // ─── Scenario-Specific Rules ───
    parts.push('SCENARIO-SPECIFIC RULES:');
    switch (scenario) {
      case 'A':
        parts.push('  • You know NOTHING about this user — be exploratory and warm');
        parts.push('  • Ask questions, offer suggestions, do NOT make assumptions');
        parts.push('  • Focus on getting the user started (first task, first goal, profile setup)');
        break;
      case 'B':
        parts.push('  • Reference ONLY the categories that have data');
        parts.push('  • For empty categories, use the empty state strategy above');
        parts.push('  • Do NOT fill in gaps with assumptions');
        break;
      case 'C':
        parts.push('  • You can make informed observations based on actual data');
        parts.push('  • Still hedge claims about patterns unless confidence is high');
        parts.push('  • Acknowledge when you\'re extrapolating vs. stating facts');
        break;
      case 'D':
        parts.push('  • Reference past data but note it may be outdated');
        parts.push('  • Do NOT assume current state matches historical patterns');
        parts.push('  • Encourage re-engagement ("It\'s been a while since...")');
        break;
      case 'E':
        parts.push('  • Pattern detection is available — you can identify trends');
        parts.push('  • State confidence level when making pattern claims');
        parts.push('  • Use hedging language for moderate-confidence patterns');
        parts.push('  • Only make definitive pattern claims at high confidence');
        break;
    }

    parts.push('');
    parts.push('═══════════════════════════════════════');
    parts.push('END ANTI-HALLUCINATION PROTOCOL');
    parts.push('═══════════════════════════════════════');

    return parts.join('\n');
  }
}
