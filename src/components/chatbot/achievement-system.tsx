'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Flame,
  Check,
  Zap,
  Target,
  Brain,
  Sun,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { db, generateId } from '@/lib/offline-db';
import type { OfflineAchievement } from '@/lib/offline-db';

/* ─── Icon Mapping ─── */

const ICON_MAP: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>> = {
  flame: Flame,
  check: Check,
  zap: Zap,
  target: Target,
  brain: Brain,
  sun: Sun,
  sparkles: Sparkles,
};

/* ─── Achievement Stats ─── */

interface AchievementStats {
  longestStreak: number;
  totalCompletedTasks: number;
  totalFocusMinutes: number;
  longestFocusSession: number;
  hasEarlyTask: boolean;
  hasPerfectDay: boolean;
  totalGoals: number;
}

/* ─── Achievement Definition ─── */

interface AchievementDef {
  type: string;
  title: string;
  description: string;
  icon: string;
  condition: (stats: AchievementStats) => boolean;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  { type: 'streak_7', title: 'WEEK WARRIOR', description: '7-day habit streak', icon: 'flame', condition: (s) => s.longestStreak >= 7 },
  { type: 'streak_30', title: 'MONTH MASTER', description: '30-day habit streak', icon: 'flame', condition: (s) => s.longestStreak >= 30 },
  { type: 'tasks_10', title: 'GETTING STARTED', description: 'Complete 10 tasks', icon: 'check', condition: (s) => s.totalCompletedTasks >= 10 },
  { type: 'tasks_50', title: 'TASK CRUSHER', description: 'Complete 50 tasks', icon: 'zap', condition: (s) => s.totalCompletedTasks >= 50 },
  { type: 'tasks_100', title: 'CENTURION', description: 'Complete 100 tasks', icon: 'target', condition: (s) => s.totalCompletedTasks >= 100 },
  { type: 'focus_1h', title: 'DEEP WORK', description: '1 hour focus session', icon: 'brain', condition: (s) => s.longestFocusSession >= 60 },
  { type: 'focus_10h', title: 'FOCUS MASTER', description: '10 hours total focus', icon: 'brain', condition: (s) => s.totalFocusMinutes >= 600 },
  { type: 'early_bird', title: 'EARLY BIRD', description: 'Complete a task before 8 AM', icon: 'sun', condition: (s) => s.hasEarlyTask },
  { type: 'all_habits', title: 'PERFECT DAY', description: 'All habits done in one day', icon: 'sparkles', condition: (s) => s.hasPerfectDay },
  { type: 'goals_5', title: 'GOAL SETTER', description: 'Set 5 goals', icon: 'target', condition: (s) => s.totalGoals >= 5 },
];

/* ─── Compute Stats from IndexedDB ─── */

async function computeAchievementStats(): Promise<AchievementStats> {
  // Tasks: total completed across all time
  const allTasks = await db.tasks.toArray();
  const totalCompletedTasks = allTasks.filter(t => t.completed).length;

  // Early bird: any task completed before 8 AM (check createdAt hour)
  const hasEarlyTask = allTasks.some(t => {
    if (!t.completed) return false;
    const created = new Date(t.createdAt);
    return created.getHours() < 8;
  });

  // Habits: longest streak + perfect day
  const allHabits = await db.habits.toArray();
  let longestStreak = 0;
  for (const habit of allHabits) {
    if (habit.streak > longestStreak) longestStreak = habit.streak;
    // Also compute longest streak from completion history
    if (habit.completionHistory) {
      const dates = habit.completionHistory.split(',').filter(Boolean).sort();
      if (dates.length > 0) {
        let streak = 1;
        let bestStreak = 1;
        for (let i = 1; i < dates.length; i++) {
          const prev = new Date(dates[i - 1]);
          const curr = new Date(dates[i]);
          const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) {
            streak++;
            bestStreak = Math.max(bestStreak, streak);
          } else {
            streak = 1;
          }
        }
        longestStreak = Math.max(longestStreak, bestStreak);
      }
    }
  }

  // Perfect day: any date where all habits were completed
  let hasPerfectDay = false;
  if (allHabits.length > 0) {
    // Build date → set of habits completed
    const dateHabitMap = new Map<string, Set<string>>();
    for (const habit of allHabits) {
      if (!habit.completionHistory) continue;
      const dates = habit.completionHistory.split(',').filter(Boolean);
      for (const dateStr of dates) {
        if (!dateHabitMap.has(dateStr)) dateHabitMap.set(dateStr, new Set());
        dateHabitMap.get(dateStr)!.add(habit.id);
      }
    }
    for (const [, habitIds] of dateHabitMap) {
      if (habitIds.size >= allHabits.length) {
        hasPerfectDay = true;
        break;
      }
    }
  }

  // Focus sessions
  const allSessions = await db.focusSessions.toArray();
  const focusSessions = allSessions.filter(s => s.type === 'focus');
  const totalFocusMinutes = focusSessions.reduce((sum, s) => sum + s.duration, 0);
  const longestFocusSession = focusSessions.reduce((max, s) => Math.max(max, s.duration), 0);

  // Goals
  const allGoals = await db.goals.toArray();
  const totalGoals = allGoals.length;

  return {
    longestStreak,
    totalCompletedTasks,
    totalFocusMinutes,
    longestFocusSession,
    hasEarlyTask,
    hasPerfectDay,
    totalGoals,
  };
}

/* ─── Check & Unlock Achievements ─── */

export async function checkAndUnlockAchievements(): Promise<OfflineAchievement[]> {
  const stats = await computeAchievementStats();
  const existingAchievements = await db.achievements.toArray();
  const existingTypes = new Set(existingAchievements.map(a => a.type));

  const newlyUnlocked: OfflineAchievement[] = [];

  for (const def of ACHIEVEMENT_DEFS) {
    if (existingTypes.has(def.type)) continue;
    if (def.condition(stats)) {
      const achievement: OfflineAchievement = {
        id: generateId(),
        type: def.type,
        title: def.title,
        description: def.description,
        unlockedAt: new Date(),
        icon: def.icon,
      };
      await db.achievements.add(achievement);
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}

/* ─── AchievementBadge Component ─── */

function AchievementBadge({
  def,
  unlocked,
}: {
  def: AchievementDef;
  unlocked: boolean;
}) {
  const IconComponent = ICON_MAP[def.icon] || Target;

  return (
    <div
      className="flex flex-col items-center gap-1.5 min-w-[72px]"
      style={{ opacity: unlocked ? 1 : 0.3 }}
    >
      <div
        className="flex items-center justify-center rounded-full transition-all duration-300"
        style={{
          width: '48px',
          height: '48px',
          backgroundColor: unlocked ? 'rgba(247, 147, 26, 0.15)' : 'var(--nd-surface)',
          border: unlocked ? '1.5px solid rgba(247, 147, 26, 0.4)' : '1px solid var(--nd-border)',
          boxShadow: unlocked ? '0 0 12px rgba(247, 147, 26, 0.2)' : 'none',
        }}
      >
        <IconComponent
          className="w-5 h-5"
          style={{
            color: unlocked ? '#F7931A' : 'var(--nd-text-disabled)',
            strokeWidth: 1.5,
          }}
        />
      </div>
      <span
        className="font-mono text-center leading-tight"
        style={{
          fontSize: '7px',
          letterSpacing: '0.06em',
          color: unlocked ? 'var(--nd-text-secondary)' : 'var(--nd-text-disabled)',
          maxWidth: '72px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {def.title}
      </span>
    </div>
  );
}

/* ─── AchievementShowcase Component ─── */

export default function AchievementShowcase() {
  const [unlockedTypes, setUnlockedTypes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load achievements and check for new ones on mount
  useEffect(() => {
    let cancelled = false;
    const loadAchievements = async () => {
      try {
        // First check and unlock any new achievements
        await checkAndUnlockAchievements();
        // Then load all achievements
        const achievements = await db.achievements.toArray();
        if (!cancelled) {
          setUnlockedTypes(new Set(achievements.map(a => a.type)));
        }
      } catch {
        // Silently fail — achievements are a nice-to-have
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAchievements();
    return () => { cancelled = true; };
  }, []);

  // Sort: unlocked first, then locked
  const sortedDefs = useMemo(() => {
    return [...ACHIEVEMENT_DEFS].sort((a, b) => {
      const aUnlocked = unlockedTypes.has(a.type);
      const bUnlocked = unlockedTypes.has(b.type);
      if (aUnlocked && !bUnlocked) return -1;
      if (!aUnlocked && bUnlocked) return 1;
      return 0;
    });
  }, [unlockedTypes]);

  const unlockedCount = unlockedTypes.size;
  const totalCount = ACHIEVEMENT_DEFS.length;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: 'var(--nd-surface)',
        border: '1px solid var(--nd-border)',
        borderRadius: '10px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" style={{ color: '#FFD600', strokeWidth: 1.5 }} />
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '11px',
              letterSpacing: '0.08em',
              color: 'var(--nd-text-secondary)',
            }}
          >
            ACHIEVEMENTS
          </span>
        </div>
        <span
          className="font-mono"
          style={{
            fontSize: '10px',
            color: unlockedCount > 0 ? '#F7931A' : 'var(--nd-text-disabled)',
            fontWeight: 700,
          }}
        >
          {unlockedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full rounded-full overflow-hidden mb-3"
        style={{
          height: '3px',
          background: 'var(--nd-border-visible)',
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%`,
            background: unlockedCount > 0 ? '#F7931A' : 'var(--nd-border)',
          }}
        />
      </div>

      {/* Scrollable badge row */}
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <span
            className="font-mono uppercase"
            style={{
              fontSize: '9px',
              letterSpacing: '0.06em',
              color: 'var(--nd-text-disabled)',
            }}
          >
            [LOADING...]
          </span>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {sortedDefs.map((def) => (
            <AchievementBadge
              key={def.type}
              def={def}
              unlocked={unlockedTypes.has(def.type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
