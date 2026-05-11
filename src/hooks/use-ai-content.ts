'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAI } from '@/hooks/use-ai';
import {
  buildAIContext,
  getCachedFullContent,
  setCachedFullContent,
  FALLBACK_FULL_CONTENT,
  fullToLegacyContent,
  type FullAIContent,
  type AIDynamicContent,
  type FullUserContext,
} from '@/lib/ai-context-engine';
import {
  useOfflineProfile,
  useOfflineSettings,
  useOfflineTodayTasks,
  useOfflineMoods,
  useOfflineHabits,
  useOfflineGoals,
  useOfflineReminders,
  useOfflineConversations,
} from '@/hooks/use-offline-data';

/**
 * useAIContent — The unified hook that provides AI-generated content for ALL screens.
 *
 * Every screen should use this hook to get their labels, titles, empty states,
 * and suggestions. The content is:
 * - Generated once per context change (max every 30 min)
 * - Cached in localStorage
 * - Falls back to static defaults when AI is unavailable
 * - Adapts to user's context (name, goals, mood, time of day, etc.)
 */
export function useAIContent() {
  const { generateContent } = useAI();

  // Data hooks for context
  const { profile, loading: profileLoading } = useOfflineProfile();
  const { settings, loading: settingsLoading } = useOfflineSettings();
  const { todayTasks } = useOfflineTodayTasks();
  const { moods } = useOfflineMoods();
  const { habits } = useOfflineHabits();
  const { goals } = useOfflineGoals();
  const { reminders } = useOfflineReminders();
  const { conversations } = useOfflineConversations();

  // State
  const [fullContent, setFullContent] = useState<FullAIContent>(() => {
    // Try to load from cache on init — but validate it's not stale/hallucinated
    try {
      const raw = localStorage.getItem('syntra_ai_full_content');
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.content) {
          // Validate: if cached content has metrics but context hash is stale, discard it
          const hasMetrics = cached.content.home?.progressMetrics?.length > 0;
          const hasStatus = cached.content.home?.progressStatus && cached.content.home.progressStatus !== 'JUST STARTED';
          // If the cached content shows data metrics but we can't verify the context, play it safe
          //and use fresh fallback — the AI content will be re-fetched once data loads
          if (hasMetrics || hasStatus) {
            // Check if there's a matching context hash — if not, the cache is stale
            const contextHash = cached.contextHash;
            if (!contextHash) {
              // No context hash = stale cache from before the fresh-start fix, discard
              localStorage.removeItem('syntra_ai_full_content');
              return FALLBACK_FULL_CONTENT;
            }
          }
          // Validate: if cached nav labels are wrong (e.g. "Dashboard", "Study Sched", "Alerts"), discard cache
          const nav = cached.content.nav;
          if (nav && (
            nav.homeLabel !== 'Home' ||
            nav.plannerLabel !== 'Planner' ||
            nav.reminderLabel !== 'Reminders' ||
            nav.profileLabel !== 'Profile'
          )) {
            localStorage.removeItem('syntra_ai_full_content');
            return FALLBACK_FULL_CONTENT;
          }
          return cached.content;
        }
      }
    } catch {
      // Invalid cache, clear it
      try { localStorage.removeItem('syntra_ai_full_content'); } catch {}
    }
    return FALLBACK_FULL_CONTENT;
  });
  const [contentLoading, setContentLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch AI content
  const fetchContent = useCallback(async (isRefresh = false) => {
    // Build full user context
    const fullContext: FullUserContext = {
      profile,
      settings,
      tasks: todayTasks,
      reminders,
      goals,
      habits,
      moods,
      recentTopics: conversations.slice(0, 3).map(c => c.title),
    };

    // Check cache first (skip if this is an explicit refresh)
    if (!isRefresh) {
      const cached = getCachedFullContent(fullContext);
      if (cached) {
        setFullContent((prev) => {
          if (prev.home.greeting === cached.home.greeting) return prev;
          return cached;
        });
        setAiGenerated(cached.aiGenerated);
        return;
      }
    }

    // If the user has NO meaningful tracking data, skip the AI call to prevent hallucinated content.
    // A fresh user should see a clean empty state, not AI-invented metrics.
    // Note: having a name/aboutMe alone isn't enough — we need actual tasks/goals/habits/moods
    // to generate meaningful progress metrics and daily summaries.
    const hasTrackingData =
      todayTasks.length > 0 ||
      reminders.length > 0 ||
      goals.length > 0 ||
      habits.length > 0 ||
      moods.length > 0;

    if (!hasTrackingData && !isRefresh) {
      // Use fresh-start fallback content instead of calling AI
      setFullContent(FALLBACK_FULL_CONTENT);
      setAiGenerated(false);
      return;
    }

    if (isRefresh) {
      setContentLoading(true);
    }

    try {
      const contextString = buildAIContext(fullContext);
      const refreshId = isRefresh
        ? `refresh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        : undefined;

      const result = await generateContent(contextString, refreshId);

      if (result.content) {
        const rawContent = result.content as any;
        const newContent: FullAIContent = {
          home: {
            greeting: result.content.greeting,
            statusLine: result.content.statusLine,
            suggestionSectionLabel: result.content.suggestionSectionLabel,
            suggestions: (rawContent.suggestions || []).map((s: any) => ({
              icon: s.icon,
              text: s.text,
              prompt: s.prompt,
              category: s.category as any,
            })),
            insightLabel: result.content.insightLabel,
            progressLabel: result.content.progressLabel,
            quickActionLabel: result.content.quickActionLabel,
            moodCheckLabel: rawContent.moodCheckLabel || 'HOW ARE YOU',
            goalsSectionLabel: rawContent.goalsSectionLabel || 'YOUR GOALS',
            habitsSectionLabel: rawContent.habitsSectionLabel || 'DAILY HABITS',
            progressItems: Array.isArray(rawContent.progressItems) ? rawContent.progressItems.map((item: any) => ({
              label: typeof item?.label === 'string' ? item.label : 'STATUS',
              value: typeof item?.value === 'string' ? item.value : '0',
              highlight: Boolean(item?.highlight),
            })) : [],
            progressMetrics: Array.isArray(rawContent.progressMetrics) ? rawContent.progressMetrics.map((m: any) => ({
              label: typeof m?.label === 'string' ? m.label : 'STATUS',
              value: typeof m?.value === 'string' ? m.value : '0',
              subtext: typeof m?.subtext === 'string' ? m.subtext : undefined,
              progress: typeof m?.progress === 'number' ? m.progress : undefined,
              highlight: Boolean(m?.highlight),
              trend: m?.trend === 'up' || m?.trend === 'down' || m?.trend === 'stable' ? m.trend : undefined,
              statusColor: typeof m?.statusColor === 'string' ? m.statusColor : undefined,
            })) : [],
            progressStatus: typeof rawContent.progressStatus === 'string' ? rawContent.progressStatus.toUpperCase() : 'ON TRACK',
            priorityFocus: rawContent.priorityFocus && typeof rawContent.priorityFocus.label === 'string' ? {
              label: rawContent.priorityFocus.label,
              reason: typeof rawContent.priorityFocus.reason === 'string' ? rawContent.priorityFocus.reason : undefined,
              urgency: rawContent.priorityFocus.urgency === 'low' || rawContent.priorityFocus.urgency === 'medium' || rawContent.priorityFocus.urgency === 'high' ? rawContent.priorityFocus.urgency : 'medium',
            } : undefined,
          },
          planner: {
            headerLabel: (result.content as any).plannerHeaderLabel || 'PLANNER',
            emptyTasksMessage: (result.content as any).plannerEmptyTasks || 'No tasks for this day',
            emptyTasksHint: (result.content as any).plannerEmptyHint || 'Tap + to add one',
            aiTaskButtonLabel: (result.content as any).plannerAiButton || 'SMART ADD',
            remindersSectionLabel: (result.content as any).plannerRemindersLabel || 'REMINDERS',
            emptyRemindersMessage: (result.content as any).plannerEmptyReminders || 'No reminders',
            searchPlaceholder: (result.content as any).plannerSearch || 'Search tasks...',
          },
          settings: {
            profileSectionLabel: (result.content as any).settingsProfileLabel || 'PROFILE',
            accountSectionLabel: (result.content as any).settingsAccountLabel || 'ACCOUNT',
            preferencesSectionLabel: (result.content as any).settingsPreferencesLabel || 'PREFERENCES',
            goalsSectionLabel: (result.content as any).settingsGoalsLabel || 'GOALS',
            habitsSectionLabel: (result.content as any).settingsHabitsLabel || 'HABITS',
            dataSectionLabel: (result.content as any).settingsDataLabel || 'DATA',
            editProfileLabel: (result.content as any).settingsEditProfile || 'Edit Profile',
            aboutMePlaceholder: (result.content as any).settingsAboutPlaceholder || 'Tell Syntra about yourself...',
            moodHistoryLabel: (result.content as any).settingsMoodHistory || 'MOOD HISTORY',
            noGoalsMessage: (result.content as any).settingsNoGoals || 'No goals yet. Add one!',
            noHabitsMessage: (result.content as any).settingsNoHabits || 'No habits yet. Start building streaks!',
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
          aiGenerated: result.aiGenerated === true,
        };
        setFullContent(newContent);
        setAiGenerated(result.aiGenerated === true);
        setCachedFullContent(newContent, fullContext);
      } else {
        setAiGenerated(false);
      }
    } catch {
      setAiGenerated(false);
    } finally {
      setContentLoading(false);
    }
  }, [profile, settings, todayTasks, reminders, goals, habits, moods, conversations, generateContent]);

  // Fetch content once data stabilizes
  useEffect(() => {
    if (profileLoading || settingsLoading) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    // Stagger: delay 2s to let other data settle
    const timer = setTimeout(() => {
      fetchContent();
    }, 2000);

    return () => clearTimeout(timer);
  }, [profileLoading, settingsLoading, fetchContent]);

  // Legacy compatibility: convert FullAIContent to AIDynamicContent
  const legacyContent: AIDynamicContent = fullToLegacyContent(fullContent);

  return {
    // Full content for all screens
    home: fullContent.home,
    planner: fullContent.planner,
    settings: fullContent.settings,
    nav: fullContent.nav,
    common: fullContent.common,

    // Legacy compatibility
    dynamicContent: legacyContent,

    // State
    contentLoading,
    aiGenerated,

    // Actions
    refreshContent: useCallback(() => fetchContent(true), [fetchContent]),
  };
}
