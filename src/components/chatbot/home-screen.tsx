'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import {
  MessageCircle,
  Zap,
  Sparkles,
  Brain,
  Pin,
  Trash2,
  MoreVertical,
  Bell,
  Mic,
  Plus,
  PenTool,
  BookOpen,
  Coffee,
  Code,
  CalendarDays,
  Palette,
  RefreshCw,
  Droplets,
  StretchHorizontal,
  Users,
  Phone,
  CalendarCheck,
  Sun,
  Moon,
  Target,
  Flame,
  Check,
  Pencil,
} from 'lucide-react';
import ConfirmDialog from '@/components/chatbot/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAI } from '@/hooks/use-ai';
import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';
import GradientText from '@/components/ui/gradient-text';
import NotificationDropdown from '@/components/chatbot/notification-panel';
import EmptyState from '@/components/chatbot/empty-state';
import {
  useOfflineConversations,
  useOfflineProfile,
  useOfflineStats,
  useOfflineTodayTasks,
  useOfflineMoods,
  useOfflineHabits,
  useOfflineGoals,
  useOfflineSettings,
  useOfflineReminders,
  useOfflineTasks,
  useOfflineFocusSessions,
} from '@/hooks/use-offline-data';
import type { OfflineNotification } from '@/lib/offline-db';
import { formatTime12 } from '@/lib/offline-db';
import {
  MOOD_GLYPHS,
  MOOD_STATUS_COLORS,
  MOOD_LABELS,
  MOOD_VALUES,
} from '@/components/chatbot/mood-glyphs';
import {
  FALLBACK_CONTENT,
  type ProgressItem,
  type ProgressMetric,
  type PriorityFocus,
} from '@/lib/ai-context-engine';
import { DataValidator } from '@/lib/data-validator';
import FocusTimer from '@/components/chatbot/focus-timer';
import HabitStreakGrid from '@/components/chatbot/habit-streak-grid';
import { TagPill } from '@/components/chatbot/tag-input';
import { playCompletionSound, hapticLight } from '@/lib/feedback';

/* ─── Types ─── */

interface Conversation {
  id: string;
  title: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
  pinned: boolean;
}

interface HomeScreenProps {
  onStartChat: (conversation?: Conversation, initialMessage?: string) => void;
  onNavigate?: (page: string) => void;
  onOpenVoiceModal?: () => void;
  aiContent?: any;
  notifications?: OfflineNotification[];
  notificationUnreadCount?: number;
  onMarkNotificationAsRead?: (id: string) => void;
  onMarkAllNotificationsAsRead?: () => void;
  onDeleteNotification?: (id: string) => void;
  onClearAllNotifications?: () => void;
  onNotificationAction?: (notification: OfflineNotification) => void;
}

/* ─── Helpers ─── */

function getHomePriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return '#EF4444';
    case 'low': return '#FFD600';
    default: return '#F7931A';
  }
}

const quickBotIcons: Record<string, React.ReactNode> = {
  brain: <Brain className="w-4 h-4" style={{ color: 'var(--nd-text-primary)' }} strokeWidth={1.5} />,
  palette: <Palette className="w-4 h-4" style={{ color: 'var(--nd-text-primary)' }} strokeWidth={1.5} />,
  sparkles: <Sparkles className="w-4 h-4" style={{ color: 'var(--nd-text-primary)' }} strokeWidth={1.5} />,
  bot: <DotmTriangle11 size={16} dotSize={2.5} speed={1.2} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />,
};



function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'GOOD MORNING';
  if (hour < 18) return 'GOOD AFTERNOON';
  return 'GOOD EVENING';
}

/**
 * Get the primary greeting name for the user.
 * - If user has a name: "Hey {name}" (simple, no assumptions)
 * - If no name: "Welcome to Syntra" (for new users)
 * - Never uses personality assumptions like "night owl", "early bird"
 */
function getGreetingName(userName: string): string {
  if (userName && userName.trim()) return `Hey ${userName}`;
  return 'Welcome to Syntra';
}

function formatTime(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString();
}



/* ─── AI Suggestion Icon Mapping ─── */

const iconMap: Record<string, React.ReactNode> = {
  'sparkles': <Sparkles className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'code': <Code className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'coffee': <Coffee className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'calendar': <CalendarDays className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'brain': <Brain className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'droplets': <Droplets className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'pen-tool': <PenTool className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'book-open': <BookOpen className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'bell': <Bell className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'sun': <Sun className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'moon': <Moon className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'target': <Target className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'flame': <Flame className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'stretch': <StretchHorizontal className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'users': <Users className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'phone': <Phone className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  // Legacy aliases
  'image': <Palette className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'mic': <Mic className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
  'calendar-check': <CalendarCheck className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />,
};

/* ─── Category Color Map ─── */

const CATEGORY_COLORS: Record<string, string> = {
  productivity: '#F7931A',
  wellness: '#FFD600',
  social: '#EC4899',
  creative: '#A855F7',
  focus: '#EA580C',
  learning: '#06B6D4',
  // Legacy categories
  ai: '#F7931A',
  weekly: '#06B6D4',
};

/* ─── Hero Segmented Progress (Nothing signature data viz — hero treatment) ─── */

function HeroSegmentedProgress({
  percentage,
  status,
}: {
  percentage: number;
  status: string;
}) {
  const totalSegments = 30;
  const filledSegments = Math.round((percentage / 100) * totalSegments);

  // Determine progress color based on status (used for both fill and badge)
  const getProgressColor = () => {
    const s = status.toUpperCase();
    if (s.includes('CRUSH') || s.includes('EXCELLENT') || s.includes('GREAT')) return 'var(--nd-success)';
    if (s.includes('ATTENTION') || s.includes('BEHIND') || s.includes('URGENT')) return 'var(--nd-accent)';
    if (s.includes('PICK') || s.includes('START') || s.includes('EARLY')) return 'var(--nd-interactive)';
    return 'var(--nd-text-display)';
  };

  return (
    <div className="w-full">
      {/* Row 1: Label left, Hero number right */}
      <div className="flex items-baseline justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              letterSpacing: '0.08em',
              color: 'var(--nd-text-secondary)',
            }}
          >
            COMPLETION
          </span>
          {/* Live indicator dot */}
          <span
            style={{
              width: '3px',
              height: '3px',
              borderRadius: '50%',
              background: 'var(--nd-success)',
              animation: 'pulse-dot 2s ease-in-out infinite',
            }}
          />
        </div>
        <div className="flex items-baseline gap-2">
          {/* Status tag */}
          <span
            className="font-mono uppercase px-1 py-0.5"
            style={{
              fontSize: '7px',
              letterSpacing: '0.1em',
              color: getProgressColor(),
              border: `1px solid ${getProgressColor()}`,
              borderRadius: '2px',
            }}
          >
            {status}
          </span>
          {/* Hero percentage */}
          <span
            className="font-mono leading-none"
            style={{
              fontSize: 'clamp(28px, 9vw, 44px)',
              fontWeight: 700,
              color: 'var(--nd-text-display)',
              letterSpacing: '-0.03em',
            }}
          >
            {percentage}
            <span
              style={{
                fontSize: '14px',
                color: 'var(--nd-text-secondary)',
                marginLeft: '1px',
              }}
            >
              %
            </span>
          </span>
        </div>
      </div>

      {/* Row 2: Hero segmented bar */}
      <div
        className="segmented-progress"
        style={{ height: '8px' }}
      >
        {Array.from({ length: totalSegments }, (_, i) => (
          <div
            key={i}
            className={`segment${i < filledSegments ? ' filled' : ''}`}
            style={i < filledSegments ? { background: getProgressColor() } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Stat Row (Nothing signature data row — label left, value right) ─── */

function StatRow({ metric }: { metric: ProgressMetric }) {
  const trendIcon = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '─';
  const trendColor = metric.trend === 'up' ? 'var(--nd-success)' : metric.trend === 'down' ? 'var(--nd-accent)' : 'var(--nd-text-disabled)';

  // Value color: status color override > highlight > display
  const valueColor = metric.statusColor || (metric.highlight ? 'var(--nd-accent)' : 'var(--nd-text-display)');

  // Progress bar color based on percentage
  const getBarColor = (pct?: number) => {
    if (pct === undefined) return 'var(--nd-text-display)';
    if (pct >= 80) return 'var(--nd-success)';
    if (pct >= 40) return 'var(--nd-text-display)';
    if (pct >= 20) return 'var(--nd-warning)';
    return 'var(--nd-accent)';
  };

  return (
    <div
      className="py-1.5"
      style={{
        borderBottom: '1px solid var(--nd-border)',
      }}
    >
      {/* Main row: label left, trend + value right */}
      <div className="flex items-center justify-between">
        <span
          className="font-mono uppercase"
          style={{
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: 'var(--nd-text-secondary)',
          }}
        >
          {metric.label}
        </span>
        <div className="flex items-center gap-1.5">
          {metric.trend && (
            <span
              className="font-mono"
              style={{ fontSize: '10px', color: trendColor }}
            >
              {trendIcon}
            </span>
          )}
          <span
            className="font-mono"
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: valueColor,
              letterSpacing: '-0.02em',
            }}
          >
            {metric.value}
          </span>
        </div>
      </div>

      {/* Mini progress bar — segmented Nothing style */}
      {metric.progress !== undefined && (
        <div
          className="segmented-progress mt-1.5"
          style={{ height: '3px' }}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <div
              key={i}
              className={`segment${i < Math.round(metric.progress! / 10) ? ' filled' : ''}`}
              style={i < Math.round(metric.progress! / 10) ? { background: getBarColor(metric.progress) } : undefined}
            />
          ))}
        </div>
      )}

      {/* Subtext — compact one-liner below */}
      {metric.subtext && (
        <span
          className="block mt-0.5"
          style={{
            fontSize: '10px',
            color: 'var(--nd-text-disabled)',
            lineHeight: 1.3,
          }}
        >
          {metric.subtext}
        </span>
      )}
    </div>
  );
}

/* ─── Stat Cell (compact grid tile for 2×2 layout) ─── */

function StatCell({ metric }: { metric: ProgressMetric }) {
  const trendIcon = metric.trend === 'up' ? '↑' : metric.trend === 'down' ? '↓' : '─';
  const trendColor = metric.trend === 'up' ? 'var(--nd-success)' : metric.trend === 'down' ? 'var(--nd-accent)' : 'var(--nd-text-disabled)';

  // Value color: status color override > highlight > display
  const valueColor = metric.statusColor || (metric.highlight ? 'var(--nd-accent)' : 'var(--nd-text-display)');

  // Progress bar color based on percentage
  const getBarColor = (pct?: number) => {
    if (pct === undefined) return 'var(--nd-text-display)';
    if (pct >= 80) return 'var(--nd-success)';
    if (pct >= 40) return 'var(--nd-text-display)';
    if (pct >= 20) return 'var(--nd-warning)';
    return 'var(--nd-accent)';
  };

  return (
    <div
      className="p-2.5"
      style={{
        background: 'var(--nd-surface-raised, rgba(255,255,255,0.03))',
        border: '1px solid var(--nd-border)',
        borderRadius: '8px',
      }}
    >
      {/* Label row */}
      <span
        className="font-mono uppercase block"
        style={{
          fontSize: '8px',
          letterSpacing: '0.08em',
          color: 'var(--nd-text-secondary)',
        }}
      >
        {metric.label}
      </span>

      {/* Trend + Value row */}
      <div className="flex items-center gap-1 mt-1">
        {metric.trend && (
          <span
            className="font-mono"
            style={{ fontSize: '10px', color: trendColor }}
          >
            {trendIcon}
          </span>
        )}
        <span
          className="font-mono"
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: valueColor,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}
        >
          {metric.value}
        </span>
      </div>

      {/* Mini progress bar — segmented Nothing style */}
      {metric.progress !== undefined && (
        <div
          className="segmented-progress mt-1.5"
          style={{ height: '2px' }}
        >
          {Array.from({ length: 8 }, (_, i) => (
            <div
              key={i}
              className={`segment${i < Math.round(metric.progress! / 12.5) ? ' filled' : ''}`}
              style={i < Math.round(metric.progress! / 12.5) ? { background: getBarColor(metric.progress) } : undefined}
            />
          ))}
        </div>
      )}

      {/* Subtext */}
      {metric.subtext && (
        <span
          className="block mt-1"
          style={{
            fontSize: '9px',
            color: 'var(--nd-text-disabled)',
            lineHeight: 1.3,
          }}
        >
          {metric.subtext}
        </span>
      )}
    </div>
  );
}

/* ─── Segmented Progress Bar (Nothing signature data viz) ─── */



/* ─── Daily Summary Skeleton ─── */

function DailySummarySkeleton() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--nd-surface)',
        border: '1px solid var(--nd-border)',
      }}
    >
      {/* Skeleton header */}
      <div
        className="px-4 pt-4 pb-2 flex items-center justify-between"
        style={{ borderBottom: '1px solid var(--nd-border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded-full" style={{ background: 'var(--nd-border-visible)', opacity: 0.2 }} />
          <div className="h-3 w-28 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.3 }} />
        </div>
        <div className="h-3 w-3 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.2 }} />
      </div>
      {/* Skeleton content */}
      <div className="px-4 pt-3 pb-4">
        <div className="space-y-2 mb-3">
          <div className="h-3 w-full rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.2 }} />
          <div className="h-3 w-4/5 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.15 }} />
        </div>
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--nd-border-visible)', opacity: 0.2 }} />
            <div className="h-2.5 w-3/4 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.15 }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--nd-border-visible)', opacity: 0.2 }} />
            <div className="h-2.5 w-2/3 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.15 }} />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--nd-border-visible)', opacity: 0.2 }} />
            <div className="h-2.5 w-1/2 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.15 }} />
          </div>
        </div>
        <div className="h-3 w-5/6 rounded" style={{ background: 'var(--nd-border-visible)', opacity: 0.15 }} />
      </div>
    </div>
  );
}

/* ─── Mood Glyphs & Constants imported from mood-glyphs.tsx ─── */

/* ─── Compute Dynamic Progress Items (fallback when AI doesn't provide) ─── */



/* ─── Compute Rich Progress Metrics (for the new Daily Pulse card) ─── */

function computeDefaultMetrics(
  stats: { tasks: number; reminders: number; percentage: number },
  goals: { id: string; title: string; completed: boolean; progress: number }[],
  habits: { id: string; title: string; lastCompletedDate: string; streak: number; frequency: string }[],
  todayMoodEntry: { mood: string; energy: number } | null,
  todayFocusMinutes?: number,
): { metrics: ProgressMetric[]; status: string; priorityFocus: PriorityFocus | undefined } {
  const metrics: ProgressMetric[] = [];
  const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const hour = new Date().getHours();

  // Tasks metric
  if (stats.tasks > 0) {
    const completed = Math.round((stats.percentage / 100) * stats.tasks);
    const pending = stats.tasks - completed;
    metrics.push({
      label: 'TASKS',
      value: `${completed}/${stats.tasks}`,
      subtext: pending > 0 ? `${pending} still pending` : 'All completed',
      progress: stats.percentage,
      highlight: pending > 0 && stats.percentage < 40,
      trend: stats.percentage >= 60 ? 'up' : stats.percentage <= 30 ? 'down' : 'stable',
    });
  }

  // Goals metric
  const activeGoals = goals.filter(g => !g.completed && g.progress < 100);
  if (activeGoals.length > 0) {
    const avgProgress = Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length);
    // Find the goal that needs most attention
    const needsAttention = activeGoals.reduce((worst, g) => g.progress < worst.progress ? g : worst, activeGoals[0]);
    metrics.push({
      label: 'GOALS',
      value: `${activeGoals.length}/${goals.length}`,
      subtext: needsAttention.progress < 30 ? `${needsAttention.title} needs attention` : `${activeGoals.length} active`,
      progress: avgProgress,
      highlight: avgProgress < 30,
      trend: avgProgress >= 50 ? 'up' : avgProgress <= 25 ? 'down' : 'stable',
    });
  }

  // Habits metric
  const dailyHabits = habits.filter(h => h.frequency === 'daily' || h.frequency === undefined);
  if (dailyHabits.length > 0) {
    const doneToday = dailyHabits.filter(h => h.lastCompletedDate === today).length;
    const habitPct = Math.round((doneToday / dailyHabits.length) * 100);
    const missed = dailyHabits.length - doneToday;
    metrics.push({
      label: 'HABITS',
      value: `${doneToday}/${dailyHabits.length}`,
      subtext: missed > 0 ? `${missed} missed yesterday` : 'All done today',
      progress: habitPct,
      highlight: doneToday < dailyHabits.length && hour > 12,
      trend: habitPct >= 50 ? 'up' : habitPct <= 25 ? 'down' : 'stable',
    });
  }

  // Research metric (derived from goals with learning/academic keywords or reminders)
  const researchGoals = goals.filter(g =>
    !g.completed && (
      (g.title || '').toLowerCase().includes('research') ||
      (g.title || '').toLowerCase().includes('thesis') ||
      (g.title || '').toLowerCase().includes('study') ||
      (g.title || '').toLowerCase().includes('paper') ||
      (g.title || '').toLowerCase().includes('article') ||
      (g.title || '').toLowerCase().includes('capstone')
    )
  );
  const researchReminders = stats.reminders;
  if (researchGoals.length > 0 || researchReminders > 0) {
    const articleCount = researchGoals.length > 0 ? researchGoals.length : 0;
    metrics.push({
      label: 'RESEARCH',
      value: articleCount > 0 ? `${articleCount} Article${articleCount > 1 ? 's' : ''}` : `${researchReminders} pending`,
      subtext: researchGoals.length > 0 && researchGoals[0].progress >= 30 ? 'Good progress' : researchGoals.length > 0 ? `${researchGoals[0].title} in progress` : 'Stay on track',
      progress: researchGoals.length > 0 ? researchGoals[0].progress : undefined,
      trend: researchGoals.length > 0 && researchGoals[0].progress >= 30 ? 'up' : researchReminders > 3 ? 'down' : 'stable',
    });
  }

  // Focus Time metric (from Pomodoro timer sessions)
  if (todayFocusMinutes && todayFocusMinutes > 0) {
    const focusHours = todayFocusMinutes / 60;
    metrics.push({
      label: 'FOCUS TIME',
      value: focusHours >= 1 ? `${focusHours.toFixed(1)}H` : `${todayFocusMinutes}MIN`,
      subtext: todayFocusMinutes >= 120 ? 'Deep work session' : todayFocusMinutes >= 60 ? 'Solid focus' : 'Keep going',
      trend: todayFocusMinutes >= 60 ? 'up' : 'stable',
    });
  }

  // Determine overall status — for empty state, use JUST STARTED
  let status = 'JUST STARTED';
  if (metrics.length > 0) {
    if (stats.percentage >= 80 || metrics.filter(m => m.trend === 'up').length >= 3) {
      status = 'CRUSHING IT';
    } else if (stats.percentage <= 20 && hour > 10) {
      status = 'NEEDS ATTENTION';
    } else if (stats.percentage <= 40 && hour > 14) {
      status = 'PICKING UP';
    } else if (stats.percentage >= 60) {
      status = 'STRONG PACE';
    } else {
      status = 'ON TRACK';
    }
  }

  // Determine priority focus
  let priorityFocus: PriorityFocus | undefined;
  // Highest priority: pending tasks in the afternoon
  if (stats.tasks > 0) {
    const pending = stats.tasks - Math.round((stats.percentage / 100) * stats.tasks);
    if (pending > 0 && hour > 12) {
      priorityFocus = {
        label: `${pending} task${pending > 1 ? 's' : ''} still on your plate`,
        reason: hour > 16 ? 'End of day approaching' : 'Clear them before the afternoon slips away',
        urgency: hour > 16 ? 'high' : 'medium',
      };
    }
  }
  // If no tasks, check habits
  if (!priorityFocus && dailyHabits.length > 0) {
    const doneToday = dailyHabits.filter(h => h.lastCompletedDate === today).length;
    if (doneToday < dailyHabits.length && hour > 14) {
      priorityFocus = {
        label: `${dailyHabits.length - doneToday} habit${dailyHabits.length - doneToday > 1 ? 's' : ''} left today`,
        reason: 'Keep your streaks alive',
        urgency: hour > 18 ? 'high' : 'low',
      };
    }
  }
  // If mood is low
  if (!priorityFocus && todayMoodEntry && todayMoodEntry.energy <= 2) {
    priorityFocus = {
      label: 'Your energy is low today',
      reason: 'Consider a short break or lighter tasks',
      urgency: 'medium',
    };
  }

  return { metrics: metrics.slice(0, 4), status, priorityFocus };
}

/* ─── HomeScreen ─── */

export default function HomeScreen({ onStartChat, onNavigate, onOpenVoiceModal, aiContent, notifications = [], notificationUnreadCount = 0, onMarkNotificationAsRead, onMarkAllNotificationsAsRead, onDeleteNotification, onClearAllNotifications, onNotificationAction }: HomeScreenProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // Offline data hooks
  const {
    conversations: offlineConversations,
    loading: conversationsLoading,
    addConversation,
    updateConversation,
    deleteConversation: deleteOfflineConversation,
    getConversationPreview,
    reload: reloadConversations,
  } = useOfflineConversations();

  const { profile, loading: profileLoading } = useOfflineProfile();
  const { stats, loading: statsLoading, reload: reloadStats } = useOfflineStats();
  const { todayTasks } = useOfflineTodayTasks();

  // New hooks for enhanced features
  const { moods, addMood, getTodayMood } = useOfflineMoods();
  const { habits, toggleHabitToday, loading: habitsLoading } = useOfflineHabits();
  const { goals, loading: goalsLoading } = useOfflineGoals();
  const { settings } = useOfflineSettings();
  const { reminders, addReminder } = useOfflineReminders();
  const { focusSessions, getTodayFocusMinutes, addSession } = useOfflineFocusSessions();
  const { addTask } = useOfflineTasks();

  // Quick-add state
  const [quickAddText, setQuickAddText] = useState('');

  // Mood/Energy state
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<number>(0);
  const [todayMoodEntry, setTodayMoodEntry] = useState<{ mood: string; energy: number } | null>(null);
  const [moodSaving, setMoodSaving] = useState(false);

  // ── Dynamic Content State ──
  // Use dynamic content from props (page-level useAIContent hook)
  const dynamicContent = aiContent?.dynamicContent || FALLBACK_CONTENT;
  const homeAI = aiContent?.home;
  const contentLoading = aiContent?.contentLoading || false;

  // Daily Insight state — single localStorage read for all three states
  const [dailySummary, setDailySummary] = useState<{
    greeting: string;
    overview: string;
    highlights: string[];
    tip: string;
    tomorrowPreview: string;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryRefreshing, setSummaryRefreshing] = useState(false);
  const [summaryKey, setSummaryKey] = useState(0); // Key to trigger refresh animation
  const [summaryAiGenerated, setSummaryAiGenerated] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  // ── Daily Briefing dismiss state (persists per day in localStorage) ──
  const getBriefingDismissKey = useCallback(() => {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    return `syntra_briefing_dismissed_${today}`;
  }, []);

  const [briefingDismissed, setBriefingDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(getBriefingDismissKey()) === 'true';
    } catch {
      return false;
    }
  });

  const [briefingManuallyToggled, setBriefingManuallyToggled] = useState(false);

  // Time-based auto-show: expanded before 10 AM if not dismissed
  const isBeforeTenAM = new Date().getHours() < 10;
  const briefingExpanded = briefingManuallyToggled ? !briefingDismissed : (isBeforeTenAM && !briefingDismissed);

  const handleDismissBriefing = useCallback(() => {
    setBriefingDismissed(true);
    setBriefingManuallyToggled(true);
    try {
      localStorage.setItem(getBriefingDismissKey(), 'true');
    } catch { /* ignore */ }
  }, [getBriefingDismissKey]);

  const handleExpandBriefing = useCallback(() => {
    setBriefingDismissed(false);
    setBriefingManuallyToggled(true);
    try {
      localStorage.removeItem(getBriefingDismissKey());
    } catch { /* ignore */ }
  }, [getBriefingDismissKey]);

  // Compute suggested first task from pending tasks by priority
  const suggestedFirstTask = useMemo(() => {
    const pending = todayTasks.filter(t => !t.completed);
    if (pending.length === 0) return null;
    // Sort by priority: high > medium > low
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const sorted = [...pending].sort((a, b) =>
      (priorityOrder[b.priority] || 2) - (priorityOrder[a.priority] || 2)
    );
    return sorted[0];
  }, [todayTasks]);

  // Classify highlight items by urgency for colored dots
  const classifyHighlight = useCallback((text: string): 'urgent' | 'pending' | 'completed' => {
    const lower = text.toLowerCase();
    if (/\b(overdue|missed|urgent|critical|deadline|late|behind|fail|expired)\b/.test(lower)) return 'urgent';
    if (/\b(done|completed|finished|achieved|crushed|accomplished|checked\s*off)\b/.test(lower)) return 'completed';
    return 'pending';
  }, []);

  // Initialize daily summary from cache (single read)
  // ── Reload stats when home screen mounts (data may have changed on other screens) ──
  useEffect(() => {
    reloadStats();
  }, [reloadStats]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('syntra_daily_summary_cache');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      if (parsed.date === today && parsed.summary) {
        setDailySummary(parsed.summary);
        setSummaryLoading(false);
        setSummaryAiGenerated(parsed.aiGenerated === true);
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  // ── Daily Summary Cache (localStorage) ──
  const SUMMARY_CACHE_KEY = 'syntra_daily_summary_cache';

  function getCachedSummary(): { summary: typeof dailySummary; aiGenerated: boolean; date: string } | null {
    try {
      const raw = localStorage.getItem(SUMMARY_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed.date || !parsed.summary) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function setCachedSummary(summary: typeof dailySummary, aiGenerated: boolean) {
    try {
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      localStorage.setItem(SUMMARY_CACHE_KEY, JSON.stringify({ summary, aiGenerated, date: today }));
    } catch {
      /* localStorage full or unavailable */
    }
  }

  // Derived state
  const loading = conversationsLoading;
  const userName = profile.name && profile.name.trim() ? profile.name.split(' ')[0] : '';

  // ── Data Availability Report ──
  // Determines what to show based on actual data existence (Scenario A/B/C)
  const dataReport = useMemo(() =>
    DataValidator.generateAvailabilityReport(
      todayTasks, // Use today's tasks for tasks count
      reminders,
      goals,
      habits,
      moods,
      profile,
      settings,
      offlineConversations,
    ),
    [todayTasks, reminders, goals, habits, moods, profile, settings, offlineConversations]
  );

  // Enrich offline conversations with preview and time for UI
  const conversations: Conversation[] = offlineConversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    botName: conv.botName,
    preview: previews[conv.id] || '',
    time: formatTime(conv.updatedAt),
    icon: conv.icon,
    pinned: conv.pinned,
  }));

  const { getDailySummary } = useAI();

  // ── Compute data scenario for conditional rendering ──
  // Scenario A (Fresh Start): new user, minimal data
  // Scenario B (Partial): some data but gaps exist
  // Scenario C (Rich): lots of data across categories
  const scenario = useMemo(() => DataValidator.determineScenario(dataReport), [dataReport]);
  const isNewUser = scenario === 'A';
  const hasAnyTrackingData = scenario !== 'A';

  // Check today's mood entry
  useEffect(() => {
    let cancelled = false;
    const checkMood = async () => {
      const entry = await getTodayMood();
      if (!cancelled && entry) {
        setTodayMoodEntry({ mood: entry.mood, energy: entry.energy });
        setSelectedMood(entry.mood);
        setSelectedEnergy(entry.energy);
      }
    };
    checkMood();
    return () => { cancelled = true; };
  }, [getTodayMood, moods]);

  // Content refresh is now handled at the page level via useAIContent hook
  const handleContentRefresh = useCallback(() => {
    if (aiContent?.refreshContent) {
      aiContent.refreshContent();
    }
  }, [aiContent]);

  // Fetch daily insight
  const fetchDailySummary = useCallback(async (isRefresh = false) => {
    // Check cache first (skip if this is an explicit refresh)
    if (!isRefresh) {
      const cached = getCachedSummary();
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      if (cached && cached.date === today && cached.summary) {
        setDailySummary((prev) => {
          if (prev && prev.greeting === cached.summary!.greeting) return prev;
          return cached.summary!;
        });
        setSummaryAiGenerated(cached.aiGenerated);
        setSummaryLoading(false);
        return;
      }
    }

    // If the user has NO meaningful tracking data, skip the AI call to prevent hallucinated content.
    // A fresh user should not see AI-invented "5 tasks carried over" etc.
    const hasTrackingData =
      stats.tasks > 0 ||
      stats.reminders > 0 ||
      goals.length > 0 ||
      habits.length > 0 ||
      todayMoodEntry !== null;

    if (!hasTrackingData && !isRefresh) {
      // Show a fresh-start message instead of hallucinated content
      setDailySummary(null);
      setSummaryLoading(false);
      return;
    }

    if (isRefresh) {
      setSummaryRefreshing(true);
    } else {
      setSummaryLoading(true);
    }

    try {
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      const completedTasks = stats.tasks > 0 ? Math.round((stats.percentage / 100) * stats.tasks) : 0;
      const pendingTasks = stats.tasks - completedTasks;
      const todayHabitsData = habits.map(h => ({
        title: h.title,
        streak: h.streak,
        done: h.lastCompletedDate === today,
      }));
      const activeGoalTitles = goals.filter(g => !g.completed).map(g => g.title);
      const currentMood = todayMoodEntry?.mood;
      const currentEnergy = todayMoodEntry?.energy;

      const refreshId = `refresh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const result = await getDailySummary({
        userName,
        timeOfDay: getGreeting(),
        completedTasks,
        pendingTasks,
        totalTasks: stats.tasks,
        upcomingReminders: stats.reminders,
        activeGoals: activeGoalTitles,
        todayHabits: todayHabitsData,
        mood: currentMood,
        energy: currentEnergy,
        aboutMe: profile.aboutMe,
        role: settings.role,
        interests: settings.interests,
      }, refreshId);

      if (result.summary) {
        setDailySummary(result.summary);
        setSummaryKey((k) => k + 1);
        setCachedSummary(result.summary, result.aiGenerated === true);
      }
      setSummaryAiGenerated(result.aiGenerated === true);
    } catch {
      setSummaryAiGenerated(false);
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
      setSummaryRefreshing(false);
    }
  }, [getDailySummary, userName, stats, habits, goals, todayMoodEntry, profile.aboutMe, settings.role, settings.interests]);

  // Load conversation previews when conversations change
  useEffect(() => {
    let cancelled = false;
    const loadPreviews = async () => {
      const newPreviews: Record<string, string> = {};
      for (const conv of offlineConversations) {
        newPreviews[conv.id] = await getConversationPreview(conv.id);
      }
      if (!cancelled) setPreviews(newPreviews);
    };
    loadPreviews();
    return () => { cancelled = true; };
  }, [offlineConversations, getConversationPreview]);

  const handleMenuToggle = (convId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (openMenuId === convId) {
      setOpenMenuId(null);
      setMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      const top = rect.bottom + 4;
      const right = window.innerWidth - rect.right;
      setMenuPos({ top, right });
      setOpenMenuId(convId);
    }
  };

  // Close context menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-context-menu]')) return;
      setOpenMenuId(null);
      setMenuPos(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  // Dynamic content is now fetched at the page level via useAIContent hook

  // Fetch daily summary once data stabilizes (ref guards against double-fetch)
  const summaryFetched = useRef(false);
  useEffect(() => {
    if (profileLoading || statsLoading || habitsLoading || goalsLoading) return;
    if (summaryFetched.current) return;
    summaryFetched.current = true;
    fetchDailySummary();
  }, [profileLoading, statsLoading, habitsLoading, goalsLoading, fetchDailySummary]);

  // Refresh handlers
  const handleSummaryRefresh = useCallback(() => {
    summaryFetched.current = false;
    setSummaryError(false);
    fetchDailySummary(true);
  }, [fetchDailySummary]);

  // Content refresh is now handled at the page level

  // Handle mood save
  const handleMoodSave = useCallback(async () => {
    if (!selectedMood || selectedEnergy === 0 || moodSaving) return;
    setMoodSaving(true);
    try {
      const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
      await addMood({
        mood: selectedMood,
        energy: selectedEnergy,
        note: '',
        date: today,
      });
      setTodayMoodEntry({ mood: selectedMood, energy: selectedEnergy });
      toast.success('Mood checked in!');
    } catch {
      toast.error('Failed to save mood');
    } finally {
      setMoodSaving(false);
    }
  }, [selectedMood, selectedEnergy, moodSaving, addMood]);

  const handleNewChat = async () => {
    try {
      const newConv = await addConversation({ title: 'New Chat', botName: 'Syntra', icon: 'bot', pinned: false });
      onStartChat({
        id: newConv.id,
        title: newConv.title,
        botName: newConv.botName,
        preview: '',
        time: 'Just now',
        icon: newConv.icon,
        pinned: newConv.pinned,
      });
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteOfflineConversation(id);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const pinConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const conv = offlineConversations.find((c) => c.id === id);
    if (!conv) return;
    try {
      await updateConversation(id, { pinned: !conv.pinned });
    } catch (error) {
      console.error('Failed to pin conversation:', error);
    }
  };

  const openRenameDialog = (convId: string) => {
    const conv = offlineConversations.find((c) => c.id === convId);
    if (!conv) return;
    setRenameTarget(convId);
    setRenameValue(conv.title);
    setOpenMenuId(null);
    setMenuPos(null);
  };

  const handleRenameSave = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    setRenameSaving(true);
    try {
      await updateConversation(renameTarget, { title: renameValue.trim() });
      toast.success('Conversation renamed');
    } catch (error) {
      console.error('Failed to rename conversation:', error);
      toast.error('Failed to rename');
    } finally {
      setRenameSaving(false);
      setRenameTarget(null);
      setRenameValue('');
    }
  };



  // ── Quick Add Handler ──
  const handleQuickAdd = useCallback(async () => {
    const text = quickAddText.trim();
    if (!text) return;

    // Detect time-related words to decide task vs reminder
    const timePattern = /\b(at|pm|am|remind|o'clock|:\d{2})\b/i;
    const isReminder = timePattern.test(text);

    try {
      if (isReminder) {
        await addReminder({
          title: text,
          description: '',
          time: '',
          icon: 'bell',
          completed: false,
          recurring: '',
          recurringEndDate: '',
        });
        toast.success('Reminder added');
      } else {
        const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
        await addTask({
          title: text,
          description: '',
          time: '',
          location: '',
          participants: '',
          category: 'general',
          priority: 'medium',
          completed: false,
          date: today,
        });
        toast.success('Task added');
      }
      setQuickAddText('');
    } catch {
      toast.error('Failed to add');
    }
  }, [quickAddText, addTask, addReminder]);

  const handleSuggestionClick = async (prompt: string) => {
    try {
      const newConv = await addConversation({ title: prompt.slice(0, 40), botName: 'Syntra', icon: 'bot', pinned: false });
      onStartChat(
        {
          id: newConv.id,
          title: newConv.title,
          botName: newConv.botName,
          preview: '',
          time: 'Just now',
          icon: newConv.icon,
          pinned: newConv.pinned,
        },
        prompt
      );
    } catch (error) {
      console.error('Failed to create conversation:', error);
      toast.error('Failed to start chat');
    }
  };

  // Filter active (incomplete) goals
  const activeGoals = goals.filter(g => !g.completed && g.progress < 100);
  // Get habits that are daily frequency or have streaks
  const dailyHabits = habits.filter(h => h.frequency === 'daily' || h.frequency === undefined);

  // Split suggestions into 2 rows of 3
  const suggestions = dynamicContent.suggestions;
  const row1 = suggestions.slice(0, 3);
  const row2 = suggestions.slice(3, 6);

  // Syntra-generated labels (fallback to defaults)
  const moodCheckLabel = homeAI?.moodCheckLabel || 'HOW ARE YOU';
  const goalsSectionLabel = homeAI?.goalsSectionLabel || 'YOUR GOALS';
  const habitsSectionLabel = homeAI?.habitsSectionLabel || 'DAILY HABITS';

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--nd-black)' }}>
      {/* ── Top Header Bar ── */}
      <div className="px-5 pt-6 pb-3 flex justify-between items-center">
        {/* Left: Brand label */}
        <GradientText
          className="font-mono uppercase"
          style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
          }}
          gradient="bg-gradient-to-r from-[#EA580C] via-[#F7931A] to-[#FFD600]"
          animationDuration={6}
        >
          SYNTRA
        </GradientText>
        {/* Right: Notification */}
        <div className="flex items-center gap-2">
          <NotificationDropdown
            notifications={notifications}
            unreadCount={notificationUnreadCount}
            onMarkAsRead={onMarkNotificationAsRead || (() => {})}
            onMarkAllAsRead={onMarkAllNotificationsAsRead || (() => {})}
            onDeleteNotification={onDeleteNotification || (() => {})}
            onClearAll={onClearAllNotifications || (() => {})}
            onNotificationAction={onNotificationAction}
          />
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6 scrollbar-hide">
        {/* ── Greeting Section ── */}
        <div>
          <p
            className="font-mono uppercase mb-1"
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: 'var(--nd-text-secondary)',
            }}
          >
            {getGreeting()}
          </p>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--nd-text-display)',
              letterSpacing: '-0.02em',
            }}
          >
            {getGreetingName(userName)}
          </h1>
          {/* ── Quick Add ── */}
          <div className="relative flex items-center mt-3">
            <Plus className="absolute left-0 w-4 h-4" style={{ color: 'var(--nd-text-disabled)', strokeWidth: 1.5 }} />
            <input
              type="text"
              placeholder="Quick add task, reminder, or note..."
              value={quickAddText}
              onChange={(e) => setQuickAddText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
              className="w-full bg-transparent pl-6 pb-2 text-sm font-mono placeholder:text-[var(--nd-text-disabled)] focus:outline-none"
              style={{
                color: 'var(--nd-text-primary)',
                borderBottom: '1px solid var(--nd-border-visible)',
              }}
            />
          </div>

          {/* Context-aware status line — only show if user has data or AI generated one */}
          {isNewUser ? (
            <div className="mt-2">
              <EmptyState type="tasks" />
            </div>
          ) : dynamicContent.statusLine ? (
            <p
              className="font-mono mt-1"
              style={{
                fontSize: '11px',
                letterSpacing: '0.04em',
                color: 'var(--nd-text-disabled)',
              }}
            >
              {dynamicContent.statusLine}
            </p>
          ) : null}
        </div>

        {/* ── New Chat Button ── */}
        <button
          onClick={handleNewChat}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl transition-colors duration-150"
          style={{
            background: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            color: 'var(--nd-text-primary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface-raised)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface)';
            (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border-visible)';
          }}
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            {dynamicContent.quickActionLabel}
          </span>
        </button>

        {/* ── Suggestions: 2-Row Horizontal Layout ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span
              className="font-mono uppercase"
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              {dynamicContent.suggestionSectionLabel}
            </span>
            <button
              onClick={handleContentRefresh}
              disabled={contentLoading}
              className="p-1.5 rounded-lg transition-colors duration-150"
              style={{ color: 'var(--nd-text-disabled)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
              }}
              aria-label="Refresh suggestions"
            >
              <RefreshCw
                className="w-3.5 h-3.5"
                strokeWidth={1.5}
                style={contentLoading ? { animation: 'spin 1s linear infinite' } : {}}
              />
            </button>
          </div>

          {/* Row 1 - horizontal scroll on mobile, equal width on desktop */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
            {row1.map((suggestion, idx) => {
              const categoryColor = CATEGORY_COLORS[suggestion.category || ''] || 'var(--nd-text-disabled)';
              return (
                <button
                  key={`r1-${suggestion.text}-${idx}`}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  aria-label={`Ask Syntra: ${suggestion.text}`}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 shrink-0 snap-start min-w-[max-content] sm:min-w-0 sm:flex-1"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--nd-border-visible)',
                    color: 'var(--nd-text-primary)',
                    borderRadius: '10px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border-visible)';
                  }}
                >
                  <span className="shrink-0">{iconMap[suggestion.icon] || iconMap['sparkles']}</span>
                  <span className="whitespace-nowrap font-mono uppercase text-[10px] sm:text-[11px]" style={{ letterSpacing: '0.04em' }}>
                    {suggestion.text}
                  </span>
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: categoryColor,
                      flexShrink: 0,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Row 2 */}
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1 snap-x snap-mandatory">
            {row2.map((suggestion, idx) => {
              const categoryColor = CATEGORY_COLORS[suggestion.category || ''] || 'var(--nd-text-disabled)';
              return (
                <button
                  key={`r2-${suggestion.text}-${idx}`}
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  aria-label={`Ask Syntra: ${suggestion.text}`}
                  className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors duration-150 shrink-0 snap-start min-w-[max-content] sm:min-w-0 sm:flex-1"
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--nd-border-visible)',
                    color: 'var(--nd-text-primary)',
                    borderRadius: '10px',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border-visible)';
                  }}
                >
                  <span className="shrink-0">{iconMap[suggestion.icon] || iconMap['sparkles']}</span>
                  <span className="whitespace-nowrap font-mono uppercase" style={{ fontSize: '10px', letterSpacing: '0.04em' }}>
                    {suggestion.text}
                  </span>
                  <span
                    style={{
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      background: categoryColor,
                      flexShrink: 0,
                    }}
                  />
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Daily Pulse Card ── */}
        {isNewUser ? (
          /* Scenario C: New user — show "Get started" cards */
          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--nd-surface)',
              border: '1px solid var(--nd-border)',
            }}
          >
            <span
              className="font-mono uppercase block mb-4"
              style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              GET STARTED
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onNavigate?.('planner')}
                className="p-3 text-left transition-colors duration-150"
                style={{
                  background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
                }}
              >
                <Plus className="w-4 h-4 mb-2" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />
                <span
                  className="block font-mono uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--nd-text-primary)' }}
                >
                  ADD TASK
                </span>
                <span
                  className="block mt-1"
                  style={{ fontSize: '10px', color: 'var(--nd-text-disabled)', lineHeight: 1.3 }}
                >
                  Plan your day
                </span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="p-3 text-left transition-colors duration-150"
                style={{
                  background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
                }}
              >
                <Target className="w-4 h-4 mb-2" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />
                <span
                  className="block font-mono uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--nd-text-primary)' }}
                >
                  SET GOAL
                </span>
                <span
                  className="block mt-1"
                  style={{ fontSize: '10px', color: 'var(--nd-text-disabled)', lineHeight: 1.3 }}
                >
                  Track progress
                </span>
              </button>
              <button
                onClick={() => onNavigate?.('profile')}
                className="p-3 text-left transition-colors duration-150"
                style={{
                  background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
                }}
              >
                <Flame className="w-4 h-4 mb-2" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />
                <span
                  className="block font-mono uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--nd-text-primary)' }}
                >
                  ADD HABIT
                </span>
                <span
                  className="block mt-1"
                  style={{ fontSize: '10px', color: 'var(--nd-text-disabled)', lineHeight: 1.3 }}
                >
                  Build streaks
                </span>
              </button>
              <button
                onClick={() => onNavigate?.('friends')}
                className="p-3 text-left transition-colors duration-150"
                style={{
                  background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
                }}
              >
                <Bell className="w-4 h-4 mb-2" strokeWidth={1.5} style={{ color: 'var(--nd-text-primary)' }} />
                <span
                  className="block font-mono uppercase"
                  style={{ fontSize: '10px', letterSpacing: '0.06em', color: 'var(--nd-text-primary)' }}
                >
                  REMINDER
                </span>
                <span
                  className="block mt-1"
                  style={{ fontSize: '10px', color: 'var(--nd-text-disabled)', lineHeight: 1.3 }}
                >
                  Never forget
                </span>
              </button>
            </div>
          </div>
        ) : (() => {
          // Scenario A/B: Has data — show Daily Pulse with real metrics
          const defaultMetrics = computeDefaultMetrics(stats, goals, habits, todayMoodEntry, getTodayFocusMinutes());
          const displayMetrics = (homeAI?.progressMetrics && homeAI.progressMetrics.length > 0)
            ? homeAI.progressMetrics
            : defaultMetrics.metrics;
          const displayStatus = homeAI?.progressStatus || defaultMetrics.status;
          const displayPriorityFocus = homeAI?.priorityFocus || defaultMetrics.priorityFocus;

          // ── Compute overall percentage from ALL visible metrics ──
          // Weighted: metrics with progress values contribute, tasks weighted heavier
          const metricsWithProgress = displayMetrics.filter(m => m.progress !== undefined);
          let overallPct: number;
          if (metricsWithProgress.length > 0) {
            // Weight tasks 3x, everything else 1x — tasks are most actionable
            const weighted = metricsWithProgress.map(m => ({
              pct: m.progress!,
              weight: m.label.toUpperCase().includes('TASK') || m.label.toUpperCase().includes('COMPLETION') ? 3 : 1,
            }));
            overallPct = Math.round(
              weighted.reduce((sum, w) => sum + w.pct * w.weight, 0) /
              weighted.reduce((sum, w) => sum + w.weight, 0)
            );
          } else {
            // Fallback to raw task stats if no metric has progress
            overallPct = stats.percentage;
          }

          return (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
              }}
            >
              {/* Section label — Space Mono ALL CAPS */}
              <div className="px-3 pt-3 pb-0">
                <span
                  className="font-mono uppercase"
                  style={{
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    color: 'var(--nd-text-secondary)',
                  }}
                >
                  DAILY PULSE
                </span>
              </div>
              {/* Hero segmented progress bar — the Nothing signature */}
              <div className="px-3 pt-2">
                <HeroSegmentedProgress percentage={overallPct} status={displayStatus} />
              </div>

              {/* Stat Grid — 2×2 instrument panel */}
              {displayMetrics.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 px-3 pt-3">
                  {displayMetrics.map((metric, idx) => (
                    <StatCell key={idx} metric={metric} />
                  ))}
                </div>
              )}

              {/* Priority Focus — Smart callout */}
              {displayPriorityFocus && (
                <div
                  className="mx-3 mt-2 mb-3 p-2.5"
                  style={{
                    background: displayPriorityFocus.urgency === 'high'
                      ? 'rgba(215, 25, 33, 0.06)'
                      : 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                    border: `1px solid ${displayPriorityFocus.urgency === 'high' ? 'var(--nd-accent)' : 'var(--nd-border)'}`,
                    borderLeft: `3px solid ${displayPriorityFocus.urgency === 'high' ? 'var(--nd-accent)' : 'var(--nd-text-display)'}`,
                    borderRadius: '4px',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Zap
                      className="w-3.5 h-3.5 shrink-0 mt-0.5"
                      strokeWidth={1.5}
                      style={{ color: displayPriorityFocus.urgency === 'high' ? 'var(--nd-accent)' : 'var(--nd-text-secondary)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: displayPriorityFocus.urgency === 'high' ? 'var(--nd-accent)' : 'var(--nd-text-primary)',
                          display: 'block',
                          lineHeight: 1.3,
                        }}
                      >
                        {displayPriorityFocus.label}
                      </span>
                      {displayPriorityFocus.reason && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--nd-text-disabled)',
                            display: 'block',
                            marginTop: '2px',
                            lineHeight: 1.3,
                          }}
                        >
                          {displayPriorityFocus.reason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom spacer if no priority focus */}
              {!displayPriorityFocus && <div className="pb-3" />}
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════
            DAILY BRIEFING CARD — AI-generated intelligence report
            Auto-expands before 10 AM if not dismissed; collapses after
            ══════════════════════════════════════════════════════════════ */}
        {hasAnyTrackingData && (summaryLoading || (summaryRefreshing && !dailySummary) ? (
          <DailySummarySkeleton />
        ) : summaryError ? (
          <div
            className="rounded-xl p-4"
            style={{
              background: 'var(--nd-surface)',
              border: '1px solid var(--nd-border)',
              borderRadius: '12px',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <DotmTriangle11 size={14} dotSize={2} speed={1.2} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: 'var(--nd-text-secondary)',
                }}
              >
                DAILY BRIEFING
              </span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--nd-accent)',
                marginBottom: '12px',
              }}
            >
              Failed to load daily briefing
            </p>
            <button
              onClick={handleSummaryRefresh}
              disabled={summaryRefreshing}
              className="font-mono uppercase px-3 py-1.5 transition-colors duration-150"
              style={{
                fontSize: '10px',
                letterSpacing: '0.06em',
                background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                border: '1px solid var(--nd-border-visible)',
                color: 'var(--nd-text-primary)',
                borderRadius: '4px',
                cursor: summaryRefreshing ? 'not-allowed' : 'pointer',
                opacity: summaryRefreshing ? 0.5 : 1,
              }}
            >
              Retry
            </button>
          </div>
        ) : dailySummary ? (
          briefingExpanded ? (
            /* ── EXPANDED: Full Daily Briefing card ── */
            <div
              key={summaryKey}
              className={`rounded-xl overflow-hidden ${summaryRefreshing ? '' : 'nd-insight-refresh'}`}
              style={{
                background: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '12px',
                opacity: summaryRefreshing ? 0.5 : 1,
                transition: 'opacity 200ms ease',
              }}
            >
              {/* ── Header: DAILY BRIEFING with DotmTriangle11 ── */}
              <div
                className="px-4 pt-4 pb-2 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--nd-border)' }}
              >
                <div className="flex items-center gap-2">
                  <DotmTriangle11 size={16} dotSize={2.5} speed={1.2} color="var(--nd-text-display)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: '11px',
                      letterSpacing: '0.12em',
                      color: 'var(--nd-text-display)',
                      fontWeight: 700,
                    }}
                  >
                    DAILY BRIEFING
                  </span>
                  {isBeforeTenAM && (
                    <span
                      className="font-mono uppercase px-1.5 py-0.5"
                      style={{
                        fontSize: '7px',
                        letterSpacing: '0.06em',
                        background: 'var(--nd-accent)',
                        color: 'var(--nd-black)',
                        borderRadius: '2px',
                      }}
                    >
                      MORNING
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleSummaryRefresh}
                    disabled={summaryRefreshing}
                    className="p-1.5 rounded-lg transition-colors duration-150"
                    style={{ color: 'var(--nd-text-disabled)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
                    }}
                    aria-label="Refresh briefing"
                  >
                    <RefreshCw
                      className="w-3.5 h-3.5"
                      strokeWidth={1.5}
                      style={summaryRefreshing ? { animation: 'spin 1s linear infinite' } : {}}
                    />
                  </button>
                  <button
                    onClick={handleDismissBriefing}
                    className="font-mono uppercase px-2.5 py-1 transition-colors duration-150 flex items-center gap-1"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.06em',
                      background: 'transparent',
                      border: '1px solid var(--nd-border-visible)',
                      color: 'var(--nd-text-secondary)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border-visible)';
                      (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-secondary)';
                    }}
                    aria-label="Mark briefing as read"
                  >
                    <Check className="w-3 h-3" strokeWidth={2} />
                    MARK AS READ
                  </button>
                </div>
              </div>

              {/* ── Content body ── */}
              <div className="px-4 pt-3 pb-4">
                {/* Greeting */}
                <p
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'var(--nd-text-display)',
                    marginBottom: '6px',
                  }}
                >
                  {dailySummary.greeting}
                </p>

                {/* Overview */}
                <p
                  style={{
                    fontSize: '13px',
                    lineHeight: 1.5,
                    color: 'var(--nd-text-secondary)',
                    marginBottom: '14px',
                  }}
                >
                  {dailySummary.overview}
                </p>

                {/* Highlights with colored indicator dots */}
                {dailySummary.highlights && dailySummary.highlights.length > 0 && dailySummary.highlights.some(h => h && h.trim()) && (
                <div className="mb-4">
                  <span
                    className="font-mono uppercase block mb-2"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    KEY HIGHLIGHTS
                  </span>
                  <div className="space-y-1.5">
                    {dailySummary.highlights.filter(h => h && h.trim()).map((h, i) => {
                      const category = classifyHighlight(h);
                      const dotColor = category === 'urgent' ? '#EF4444' : category === 'completed' ? '#22C55E' : '#F97316';
                      const dotLabel = category === 'urgent' ? 'URGENT' : category === 'completed' ? 'DONE' : 'PENDING';
                      return (
                        <div key={i} className="flex items-start gap-2">
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: dotColor,
                              marginTop: '6px',
                              flexShrink: 0,
                              boxShadow: `0 0 4px ${dotColor}40`,
                            }}
                          />
                          <span
                            className="flex-1"
                            style={{
                              fontSize: '12px',
                              color: 'var(--nd-text-primary)',
                              lineHeight: 1.4,
                            }}
                          >
                            {h}
                          </span>
                          <span
                            className="font-mono uppercase shrink-0"
                            style={{
                              fontSize: '7px',
                              letterSpacing: '0.06em',
                              color: dotColor,
                              marginTop: '3px',
                              opacity: 0.7,
                            }}
                          >
                            {dotLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {/* Today's tip */}
                <div
                  className="rounded-lg p-2.5 mb-4"
                  style={{
                    background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
                    border: '1px solid var(--nd-border)',
                  }}
                >
                  <span
                    className="font-mono uppercase block mb-1"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.08em',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    {summaryAiGenerated ? 'WELLNESS TIP' : 'GENERAL TIP'}
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--nd-text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {dailySummary.tip}
                  </span>
                </div>

                {/* SUGGESTED FIRST TASK — computed from pending tasks by priority */}
                {suggestedFirstTask && (
                <div
                  className="rounded-lg p-3 mb-4"
                  style={{
                    background: suggestedFirstTask.priority === 'high'
                      ? 'rgba(215, 25, 33, 0.06)'
                      : 'rgba(249, 115, 22, 0.06)',
                    border: `1px solid ${suggestedFirstTask.priority === 'high' ? 'var(--nd-accent)' : '#F9731640'}`,
                    borderLeft: `3px solid ${suggestedFirstTask.priority === 'high' ? '#EF4444' : '#F97316'}`,
                    borderRadius: '4px',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Target
                      className="w-3 h-3 shrink-0"
                      strokeWidth={1.5}
                      style={{ color: suggestedFirstTask.priority === 'high' ? '#EF4444' : '#F97316' }}
                    />
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: '9px',
                        letterSpacing: '0.08em',
                        color: 'var(--nd-text-disabled)',
                      }}
                    >
                      SUGGESTED FIRST TASK
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--nd-text-primary)',
                      lineHeight: 1.3,
                    }}
                  >
                    {suggestedFirstTask.title}
                  </p>
                  {suggestedFirstTask.description && (
                    <p
                      style={{
                        fontSize: '11px',
                        color: 'var(--nd-text-disabled)',
                        marginTop: '2px',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {suggestedFirstTask.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    {suggestedFirstTask.time && (
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '10px',
                          color: 'var(--nd-text-secondary)',
                        }}
                      >
                        AT {formatTime12(suggestedFirstTask.time)}
                      </span>
                    )}
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: '9px',
                        letterSpacing: '0.06em',
                        color: suggestedFirstTask.priority === 'high' ? '#EF4444' : suggestedFirstTask.priority === 'low' ? '#FFD600' : '#F97316',
                      }}
                    >
                      {suggestedFirstTask.priority?.toUpperCase() || 'MEDIUM'}
                    </span>
                  </div>
                </div>
                )}

                {/* Tomorrow preview — only show if there's actual content */}
                {dailySummary.tomorrowPreview && dailySummary.tomorrowPreview.trim() && dailySummary.tomorrowPreview.toLowerCase() !== 'no upcoming events' && (
                <div
                  className="pt-3"
                  style={{ borderTop: '1px solid var(--nd-border)' }}
                >
                  <span
                    className="font-mono uppercase block mb-1"
                    style={{
                      fontSize: '9px',
                      letterSpacing: '0.08em',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    TOMORROW
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: 'var(--nd-text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {dailySummary.tomorrowPreview}
                  </span>
                </div>
                )}
              </div>
            </div>
          ) : (
            /* ── COLLAPSED: Compact one-liner briefing ── */
            <button
              onClick={handleExpandBriefing}
              className="w-full rounded-xl px-4 py-3 text-left transition-colors duration-150"
              style={{
                background: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '12px',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
              }}
              aria-label="Expand daily briefing"
            >
              <div className="flex items-center gap-2 min-w-0">
                <DotmTriangle11 size={12} dotSize={2} speed={0.8} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.3} opacityPeak={0.7} />
                <span
                  className="font-mono uppercase shrink-0"
                  style={{
                    fontSize: '9px',
                    letterSpacing: '0.08em',
                    color: 'var(--nd-text-secondary)',
                  }}
                >
                  TODAY&apos;S BRIEFING
                </span>
                <span style={{ color: 'var(--nd-text-disabled)', fontSize: '10px' }} className="shrink-0">─</span>
                <span
                  className="truncate"
                  style={{
                    fontSize: '12px',
                    color: 'var(--nd-text-primary)',
                    lineHeight: 1.3,
                  }}
                >
                  {dailySummary.overview.length > 50
                    ? `${dailySummary.overview.slice(0, 50)}...`
                    : dailySummary.overview}
                </span>
              </div>
            </button>
          )
        ) : null)}

        {/* ══════════════════════════════════════════════════════════════
            MOOD + FOCUS TIMER — Side by side (Mood left, Focus right)
            ══════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 gap-2">
          {/* ── Left: Mood Check-In (compact) ── */}
          <div
            className="rounded-xl p-3"
            style={{
              background: 'var(--nd-surface)',
              border: '1px solid var(--nd-border)',
              borderRadius: '12px',
            }}
          >
            <span
              className="font-mono uppercase block mb-2"
              style={{
                fontSize: '8px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              {moodCheckLabel}
            </span>

            {todayMoodEntry ? (
              /* Already checked in — compact display */
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {(() => {
                    const Glyph = MOOD_GLYPHS[todayMoodEntry.mood];
                    const statusColor = MOOD_STATUS_COLORS[todayMoodEntry.mood] || 'var(--nd-text-primary)';
                    return (
                      <>
                        {Glyph && <Glyph size={24} color={statusColor} />}
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-mono truncate"
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: statusColor,
                              letterSpacing: '-0.02em',
                            }}
                          >
                            {MOOD_LABELS[todayMoodEntry.mood] || 'CHECKED IN'}
                          </p>
                        </div>
                        <span
                          className="font-mono uppercase px-1.5 py-0.5 shrink-0"
                          style={{
                            fontSize: '7px',
                            letterSpacing: '0.06em',
                            color: 'var(--nd-black)',
                            background: 'var(--nd-text-display)',
                            borderRadius: '0px',
                          }}
                        >
                          DONE
                        </span>
                      </>
                    );
                  })()}
                </div>
                {/* Energy segmented bar — compact read only */}
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono uppercase shrink-0"
                    style={{
                      fontSize: '7px',
                      letterSpacing: '0.08em',
                      color: 'var(--nd-text-secondary)',
                    }}
                  >
                    NRG
                  </span>
                  <div className="flex items-center gap-[1px] flex-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        style={{
                          flex: 1,
                          height: '4px',
                          background: todayMoodEntry.energy >= level
                            ? 'var(--nd-text-display)'
                            : 'var(--nd-border)',
                          borderRadius: '0px',
                        }}
                      />
                    ))}
                  </div>
                  <span
                    className="font-mono shrink-0"
                    style={{
                      fontSize: '9px',
                      color: 'var(--nd-text-secondary)',
                    }}
                  >
                    {todayMoodEntry.energy}/5
                  </span>
                </div>
              </div>
            ) : (
              /* Mood selection UI — compact */
              <>
                {/* Segmented mood selector: 5 blocks compact */}
                <div className="flex gap-[1px] mb-2">
                  {MOOD_VALUES.map((moodValue) => {
                    const Glyph = MOOD_GLYPHS[moodValue];
                    const isActive = selectedMood === moodValue;
                    return (
                      <button
                        key={moodValue}
                        onClick={() => setSelectedMood(moodValue)}
                        className="flex flex-col items-center gap-1 py-1.5 px-0.5 transition-colors duration-150"
                        style={{
                          flex: 1,
                          background: isActive ? 'var(--nd-text-display)' : 'transparent',
                          border: isActive ? 'none' : '1px solid var(--nd-border-visible)',
                          borderRadius: '0px',
                          cursor: 'pointer',
                        }}
                        aria-label={`Mood: ${MOOD_LABELS[moodValue]}`}
                      >
                        {Glyph && (
                          <Glyph
                            size={16}
                            color={isActive ? 'var(--nd-black)' : 'var(--nd-text-secondary)'}
                          />
                        )}
                        <span
                          className="font-mono uppercase"
                          style={{
                            fontSize: '6px',
                            letterSpacing: '0.06em',
                            color: isActive ? 'var(--nd-black)' : 'var(--nd-text-disabled)',
                          }}
                        >
                          {MOOD_LABELS[moodValue]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected mood text */}
                {selectedMood && (
                  <p
                    className="font-mono mb-2"
                    style={{
                      fontSize: '14px',
                      fontWeight: 700,
                      color: MOOD_STATUS_COLORS[selectedMood] || 'var(--nd-text-primary)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {MOOD_LABELS[selectedMood]}
                  </p>
                )}

                {/* Energy segmented bar — compact */}
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="font-mono uppercase shrink-0"
                    style={{
                      fontSize: '7px',
                      letterSpacing: '0.08em',
                      color: 'var(--nd-text-secondary)',
                    }}
                  >
                    NRG
                  </span>
                  <div className="flex items-center gap-[1px] flex-1">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <button
                        key={level}
                        onClick={() => setSelectedEnergy(level)}
                        className="transition-colors duration-150"
                        style={{
                          flex: 1,
                          height: '4px',
                          background: selectedEnergy >= level
                            ? 'var(--nd-text-display)'
                            : 'var(--nd-border)',
                          borderRadius: '0px',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                        aria-label={`Energy level ${level}`}
                      />
                    ))}
                  </div>
                  {selectedEnergy > 0 && (
                    <span
                      className="font-mono shrink-0"
                      style={{
                        fontSize: '9px',
                        color: 'var(--nd-text-secondary)',
                      }}
                    >
                      {selectedEnergy}/5
                    </span>
                  )}
                </div>

                {/* Save button — compact */}
                {selectedMood && selectedEnergy > 0 && (
                  <button
                    onClick={handleMoodSave}
                    disabled={moodSaving}
                    className="w-full py-1.5 font-mono uppercase transition-colors duration-150"
                    style={{
                      fontSize: '8px',
                      letterSpacing: '0.08em',
                      background: 'var(--nd-text-display)',
                      color: 'var(--nd-black)',
                      border: 'none',
                      borderRadius: '0px',
                      opacity: moodSaving ? 0.6 : 1,
                    }}
                  >
                    {moodSaving ? 'SAVING...' : 'CHECK IN'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* ── Right: Focus Timer (compact) ── */}
          <FocusTimer compact />
        </div>

        {/* ══════════════════════════════════════════════════════════════
            {habitsSectionLabel}
            ══════════════════════════════════════════════════════════════ */}
        {dailyHabits.length > 0 && (
          <div>
            <span
              className="font-mono uppercase block mb-3"
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              {habitsSectionLabel}
            </span>
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
              {dailyHabits.map((habit) => {
                const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
                const doneToday = habit.lastCompletedDate === today;
                return (
                  <div
                    key={habit.id}
                    className="min-w-[120px] max-w-[150px] shrink-0 rounded-xl p-3"
                    style={{
                      background: 'var(--nd-surface)',
                      border: '1px solid var(--nd-border)',
                      borderRadius: '10px',
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: doneToday ? 'var(--nd-text-disabled)' : 'var(--nd-text-primary)',
                          textDecoration: doneToday ? 'line-through' : 'none',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '70px',
                        }}
                      >
                        {habit.title}
                      </span>
                      <button
                        onClick={() => {
                          const wasDone = habit.lastCompletedDate === today;
                          toggleHabitToday(habit.id, habit.lastCompletedDate);
                          if (!wasDone) {
                            playCompletionSound();
                            hapticLight();
                          }
                        }}
                        className="flex items-center justify-center rounded-md transition-colors duration-150"
                        style={{
                          width: '24px',
                          height: '24px',
                          background: doneToday ? 'var(--nd-success)' : 'transparent',
                          border: doneToday ? 'none' : '1px solid var(--nd-border-visible)',
                          color: doneToday ? 'var(--nd-black)' : 'var(--nd-text-disabled)',
                          flexShrink: 0,
                        }}
                        aria-label={doneToday ? 'Undo habit' : 'Complete habit'}
                      >
                        {doneToday ? (
                          <Check className="w-3.5 h-3.5" strokeWidth={2} />
                        ) : null}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <Flame
                        className="w-3 h-3"
                        strokeWidth={1.5}
                        style={{ color: habit.streak > 0 ? 'var(--nd-accent)' : 'var(--nd-text-disabled)' }}
                      />
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '10px',
                          color: habit.streak > 0 ? 'var(--nd-text-secondary)' : 'var(--nd-text-disabled)',
                        }}
                      >
                        {habit.streak}d
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            Habit Streak Grid
            ══════════════════════════════════════════════════════════════ */}
        {dailyHabits.length > 0 && (
          <HabitStreakGrid habits={dailyHabits} />
        )}

        {/* ══════════════════════════════════════════════════════════════
            {goalsSectionLabel}
            ══════════════════════════════════════════════════════════════ */}
        {activeGoals.length > 0 && (
          <div>
            <span
              className="font-mono uppercase block mb-3"
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              {goalsSectionLabel}
            </span>
            <div className="space-y-2">
              {activeGoals.slice(0, 4).map((goal) => (
                <div
                  key={goal.id}
                  className="rounded-xl p-3"
                  style={{
                    background: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '10px',
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Target
                        className="w-3.5 h-3.5 shrink-0"
                        strokeWidth={1.5}
                        style={{ color: 'var(--nd-text-secondary)' }}
                      />
                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--nd-text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {goal.title}
                      </span>
                    </div>
                    <span
                      className="font-mono shrink-0"
                      style={{
                        fontSize: '10px',
                        color: 'var(--nd-text-secondary)',
                      }}
                    >
                      {goal.progress}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div
                    className="w-full rounded-full overflow-hidden"
                    style={{
                      height: '3px',
                      background: 'var(--nd-border-visible)',
                    }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${goal.progress}%`,
                        background: goal.progress >= 80 ? 'var(--nd-success)' : 'var(--nd-text-display)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tasks For Today ── */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3
              className="font-mono uppercase"
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              TASKS FOR TODAY
            </h3>
            <button
              onClick={() => onNavigate?.('planner')}
              className="nd-btn-secondary flex items-center gap-1.5"
              style={{ padding: '6px 12px', fontSize: '10px', minHeight: '32px' }}
            >
              <Plus className="w-3 h-3" strokeWidth={1.5} />
              ADD TASK
            </button>
          </div>
          {/* Horizontal scrollable row */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {todayTasks.length === 0 ? (
              <div
                className="min-w-[160px] shrink-0 rounded-xl p-4 text-center"
                style={{
                  background: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border)',
                }}
              >
                <p
                  style={{
                    fontSize: '14px',
                    color: 'var(--nd-text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  No tasks today
                </p>
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--nd-text-disabled)',
                  }}
                >
                  Tap + to add one
                </p>
              </div>
            ) : (
              todayTasks.map((task) => (
                <div
                  key={task.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onNavigate?.('planner')}
                  onKeyDown={(e) => { if (e.key === 'Enter') onNavigate?.('planner'); }}
                  className="min-w-[160px] shrink-0 rounded-xl p-4 text-left cursor-pointer transition-colors duration-150"
                  style={{
                    background: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border)',
                    borderLeft: `3px solid ${task.completed ? 'var(--nd-border-visible)' : getHomePriorityColor(task.priority || 'medium')}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface-raised)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface)';
                  }}
                >
                  <p
                    className="font-medium text-sm mb-1"
                    style={{ color: 'var(--nd-text-primary)' }}
                  >
                    {task.title}
                  </p>
                  <p
                    className="text-xs mb-2"
                    style={{ color: 'var(--nd-text-secondary)' }}
                  >
                    {task.location || task.description}
                  </p>
                  {task.time && (
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.06em',
                        color: 'var(--nd-text-disabled)',
                      }}
                    >
                      AT {formatTime12(task.time)}
                    </span>
                  )}
                  {/* Tag pills */}
                  {(task.tags || '').split(',').map(t => t.trim()).filter(Boolean).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                      {(task.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                        <TagPill key={tag} tag={tag} />
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Recent Chats Section ── */}
        <div className="min-h-[200px]">
          <div className="flex justify-between items-center mb-4">
            <h3
              className="font-mono uppercase flex items-center gap-2"
              style={{
                fontSize: '11px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              <MessageCircle className="w-4 h-4" strokeWidth={1.5} />
              RECENT CHATS
            </h3>
            <button
              onClick={() => onNavigate?.('chats')}
              className="font-mono uppercase transition-colors duration-150"
              style={{
                fontSize: '11px',
                letterSpacing: '0.06em',
                color: 'var(--nd-text-disabled)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
              }}
            >
              SEE ALL
            </button>
          </div>

          {loading ? (
            /* Loading state — bracket text style */
            <div
              className="rounded-xl p-6 flex items-center justify-center"
              style={{
                background: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
              }}
            >
              <DotmTriangle11 size={20} color="var(--nd-text-secondary)" speed={1.75} />
            </div>
          ) : conversations.length === 0 ? (
            /* Empty state — headline in #999999, description in #666666 */
            <div
              className="rounded-xl p-6 text-center"
              style={{
                background: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  color: 'var(--nd-text-secondary)',
                  marginBottom: '4px',
                }}
              >
                No conversations yet
              </p>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--nd-text-disabled)',
                  marginBottom: '12px',
                }}
              >
                Start a new chat to begin
              </p>
              <button
                onClick={() => onStartChat()}
                className="font-mono uppercase px-4 py-2 transition-colors duration-150"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  background: 'var(--nd-text-display)',
                  color: 'var(--nd-black)',
                  border: 'none',
                  borderRadius: '0px',
                  cursor: 'pointer',
                }}
              >
                Start a Chat
              </button>
            </div>
          ) : (
            /* Chat list items with border dividers */
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
              }}
            >
              {conversations.map((conv, index) => (
                <div key={conv.id} className="relative">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onStartChat(conv)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStartChat(conv); }}
                    className="w-full px-4 py-3.5 flex items-center gap-2 cursor-pointer transition-colors duration-150 group overflow-hidden"
                    style={{
                      borderBottom: index < conversations.length - 1
                        ? '1px solid var(--nd-border)'
                        : 'none',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface-raised)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }}
                  >
                    {/* Left: Avatar + Text — shrinks to fit */}
                    <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
                      {/* Flat circle avatar with border */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'var(--nd-surface-raised)',
                          border: '1px solid var(--nd-border-visible)',
                        }}
                      >
                        {quickBotIcons[conv.icon] || quickBotIcons.bot}
                      </div>
                      <div className="flex-1 text-left min-w-0 overflow-hidden">
                        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                          <p
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--nd-text-primary)' }}
                          >
                            {conv.title}
                          </p>
                          {conv.pinned && (
                            <Pin className="w-3 h-3 shrink-0" style={{ color: 'var(--nd-text-secondary)' }} strokeWidth={1.5} />
                          )}
                        </div>
                        <p
                          className="text-xs line-clamp-1"
                          style={{ color: 'var(--nd-text-disabled)' }}
                        >
                          {conv.preview || 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    {/* Right: Timestamp + Menu — always visible, never shrinks */}
                    <div className="flex items-center gap-1.5 shrink-0 pl-2">
                      <span
                        className="font-mono uppercase whitespace-nowrap"
                        style={{
                          fontSize: '10px',
                          letterSpacing: '0.04em',
                          color: 'var(--nd-text-disabled)',
                        }}
                      >
                        {conv.time}
                      </span>
                      {/* Context menu trigger — visible on hover (desktop) and always on touch */}
                      <button
                        onClick={(e) => handleMenuToggle(conv.id, e)}
                        className="p-1 rounded opacity-0 group-hover:opacity-100 touch-show transition-opacity duration-150 shrink-0"
                        style={{ color: 'var(--nd-text-disabled)' }}
                        aria-label="More options"
                      >
                        <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Fixed-position Context Menu ── */}
      {openMenuId && menuPos && (
        <div
          data-context-menu
          className="fixed rounded-xl overflow-hidden z-50 w-36"
          style={{
            top: menuPos.top,
            right: menuPos.right,
            background: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              pinConversation(openMenuId, e);
              setOpenMenuId(null);
              setMenuPos(null);
            }}
            className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-colors duration-150"
            style={{
              color: 'var(--nd-text-primary)',
              borderBottom: '1px solid var(--nd-border)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface-raised)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <Pin className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-secondary)' }} />
            {conversations.find((c) => c.id === openMenuId)?.pinned ? 'Unpin' : 'Pin Chat'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openRenameDialog(openMenuId);
            }}
            className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-colors duration-150"
            style={{
              color: 'var(--nd-text-primary)',
              borderBottom: '1px solid var(--nd-border)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface-raised)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <Pencil className="w-4 h-4" strokeWidth={1.5} style={{ color: 'var(--nd-text-secondary)' }} />
            Rename
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(openMenuId);
              setOpenMenuId(null);
              setMenuPos(null);
            }}
            className="w-full text-left px-4 py-2.5 flex items-center gap-2 text-sm transition-colors duration-150"
            style={{ color: 'var(--nd-accent)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(215, 25, 33, 0.08)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
            Delete
          </button>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Conversation?"
        description="This action cannot be undone. All messages in this conversation will be permanently deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        icon="delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteConversation(deleteTarget, { stopPropagation: () => {} } as React.MouseEvent);
          }
          setDeleteTarget(null);
        }}
      />

      {/* ── Rename Conversation Dialog ── */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenameTarget(null);
            setRenameValue('');
          }
        }}
      >
        <DialogContent
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader>
            <DialogTitle
              className="font-mono uppercase"
              style={{ color: 'var(--nd-text-display)', fontSize: '13px', letterSpacing: '0.06em' }}
            >
              Rename Conversation
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)', fontSize: '12px' }}>
              Enter a new name for this conversation.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSave();
            }}
            placeholder="Conversation name"
            autoFocus
            style={{
              backgroundColor: 'var(--nd-black)',
              border: '1px solid var(--nd-border-visible)',
              borderRadius: '8px',
              color: 'var(--nd-text-display)',
            }}
          />
          <DialogFooter className="gap-2">
            <button
              onClick={() => { setRenameTarget(null); setRenameValue(''); }}
              className="font-mono uppercase px-4 py-2 rounded-full text-xs"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-secondary)',
                border: '1px solid var(--nd-border-visible)',
                letterSpacing: '0.06em',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleRenameSave}
              disabled={renameSaving || !renameValue.trim()}
              className="font-mono uppercase px-4 py-2 rounded-full text-xs"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                border: 'none',
                letterSpacing: '0.06em',
                opacity: renameSaving || !renameValue.trim() ? 0.5 : 1,
              }}
            >
              {renameSaving ? 'Saving...' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bottom Navigation is rendered at the app level in page.tsx */}

      {/* ── Spin animation for refresh icon ── */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
      `}</style>
    </div>
  );
}
