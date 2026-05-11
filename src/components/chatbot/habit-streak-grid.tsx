'use client';

import { useMemo } from 'react';
import { Flame, Trophy } from 'lucide-react';

/* ─── Types ─── */

interface HabitStreakGridProps {
  habits: { title: string; completionHistory: string; streak: number; frequency: string }[];
}

/* ─── Constants ─── */

const ROW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CELL_SIZE = 10; // px
const CELL_GAP = 2;   // px
const DEFAULT_WEEKS = 12;

/* ─── Color Intensity Helper ─── */

function getCellColor(count: number): string {
  if (count === 0) return 'var(--nd-border)';
  if (count === 1) return 'rgba(247, 147, 26, 0.3)';
  if (count === 2) return 'rgba(247, 147, 26, 0.5)';
  return '#F7931A'; // 3+ habits
}

/* ─── Date Helpers ─── */

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get the Sunday of the week containing the given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ─── Compute Streaks ─── */

function computeStreaks(dateMap: Map<string, number>): { current: number; longest: number } {
  if (dateMap.size === 0) return { current: 0, longest: 0 };

  // Get all dates that have at least 1 habit completed
  const completedDates = Array.from(dateMap.entries())
    .filter(([, count]) => count > 0)
    .map(([date]) => date)
    .sort();

  if (completedDates.length === 0) return { current: 0, longest: 0 };

  // Compute longest streak
  let longest = 1;
  let currentStreak = 1;
  for (let i = 1; i < completedDates.length; i++) {
    const prev = new Date(completedDates[i - 1]);
    const curr = new Date(completedDates[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
      longest = Math.max(longest, currentStreak);
    } else {
      currentStreak = 1;
    }
  }

  // Compute current streak (ending today or yesterday)
  const today = formatDateKey(new Date());
  const yesterday = formatDateKey(new Date(Date.now() - 86400000));
  let current = 0;

  if (dateMap.get(today) && dateMap.get(today)! > 0) {
    // Start from today and go backwards
    current = 1;
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 1);
    while (true) {
      const key = formatDateKey(checkDate);
      if (dateMap.get(key) && dateMap.get(key)! > 0) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else if (dateMap.get(yesterday) && dateMap.get(yesterday)! > 0) {
    // Start from yesterday
    current = 1;
    let checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - 2);
    while (true) {
      const key = formatDateKey(checkDate);
      if (dateMap.get(key) && dateMap.get(key)! > 0) {
        current++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  longest = Math.max(longest, current);

  return { current, longest };
}

/* ─── HabitStreakGrid Component ─── */

export default function HabitStreakGrid({ habits }: HabitStreakGridProps) {
  // Build date → count map from all habits' completionHistory
  const { dateMap, weeks, currentStreak, longestStreak } = useMemo(() => {
    const map = new Map<string, number>();

    // Parse all habits' completionHistory
    for (const habit of habits) {
      if (!habit.completionHistory) continue;
      const dates = habit.completionHistory.split(',').filter(Boolean);
      for (const dateStr of dates) {
        const trimmed = dateStr.trim();
        if (!trimmed) continue;
        map.set(trimmed, (map.get(trimmed) || 0) + 1);
      }
    }

    // Calculate the grid dimensions
    const today = new Date();
    const weekStart = getWeekStart(today);
    const gridStartDate = new Date(weekStart);
    gridStartDate.setDate(gridStartDate.getDate() - (DEFAULT_WEEKS - 1) * 7);

    // Build array of weeks
    const weeksData: { dateKey: string; dayOfWeek: number; count: number }[][] = [];
    let currentWeekStart = new Date(gridStartDate);

    for (let w = 0; w < DEFAULT_WEEKS; w++) {
      const week: { dateKey: string; dayOfWeek: number; count: number }[] = [];
      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(currentWeekStart);
        cellDate.setDate(cellDate.getDate() + d);
        const dateKey = formatDateKey(cellDate);
        week.push({
          dateKey,
          dayOfWeek: d,
          count: map.get(dateKey) || 0,
        });
      }
      weeksData.push(week);
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    const { current, longest } = computeStreaks(map);

    return { dateMap: map, weeks: weeksData, currentStreak: current, longestStreak: longest };
  }, [habits]);

  if (habits.length === 0) return null;

  // Month labels: detect when a new month starts in the grid
  const monthLabels: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks.length; w++) {
    // Use the Thursday of each week (ISO week convention) for the month label
    const thursday = new Date(weeks[w][0].dateKey);
    thursday.setDate(thursday.getDate() + 3);
    const month = thursday.getMonth();
    if (month !== lastMonth) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthLabels.push({ label: monthNames[month], weekIndex: w });
      lastMonth = month;
    }
  }

  const cellStep = CELL_SIZE + CELL_GAP;

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
        <span
          className="font-mono uppercase"
          style={{
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: 'var(--nd-text-secondary)',
          }}
        >
          STREAK GRID
        </span>
        <div className="flex items-center gap-3">
          {/* Current streak */}
          <div className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" style={{ color: currentStreak > 0 ? '#F7931A' : 'var(--nd-text-disabled)' }} strokeWidth={1.5} />
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: currentStreak > 0 ? 'var(--nd-text-primary)' : 'var(--nd-text-disabled)',
              }}
            >
              {currentStreak}d
            </span>
          </div>
          {/* Longest streak */}
          <div className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" style={{ color: longestStreak > 0 ? '#FFD600' : 'var(--nd-text-disabled)' }} strokeWidth={1.5} />
            <span
              className="font-mono"
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: longestStreak > 0 ? 'var(--nd-text-secondary)' : 'var(--nd-text-disabled)',
              }}
            >
              {longestStreak}d
            </span>
          </div>
        </div>
      </div>

      {/* Month labels row */}
      <div
        style={{
          marginLeft: `${20}px`, // offset for day labels
          marginBottom: '2px',
          position: 'relative',
          height: '12px',
          width: `${weeks.length * cellStep}px`,
        }}
      >
        {monthLabels.map(({ label, weekIndex }) => (
          <span
            key={`${label}-${weekIndex}`}
            className="font-mono absolute"
            style={{
              fontSize: '8px',
              color: 'var(--nd-text-disabled)',
              left: `${weekIndex * cellStep}px`,
              top: 0,
              letterSpacing: '0.04em',
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Grid with day labels */}
      <div className="flex">
        {/* Day-of-week labels column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: `${CELL_GAP}px`,
            width: '20px',
            flexShrink: 0,
          }}
        >
          {ROW_LABELS.map((label, i) => (
            <span
              key={i}
              className="font-mono flex items-center justify-end"
              style={{
                fontSize: '8px',
                color: 'var(--nd-text-disabled)',
                height: `${CELL_SIZE}px`,
                lineHeight: 1,
                letterSpacing: '0.02em',
              }}
            >
              {label}
            </span>
          ))}
        </div>

        {/* Contribution cells grid */}
        <div
          style={{
            display: 'flex',
            gap: `${CELL_GAP}px`,
          }}
        >
          {weeks.map((week, weekIdx) => (
            <div
              key={weekIdx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: `${CELL_GAP}px`,
              }}
            >
              {week.map((cell) => (
                <div
                  key={cell.dateKey}
                  title={`${cell.dateKey}: ${cell.count} habit${cell.count !== 1 ? 's' : ''}`}
                  style={{
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    borderRadius: '2px',
                    backgroundColor: getCellColor(cell.count),
                    transition: 'background-color 0.15s ease',
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-2">
        <span
          className="font-mono"
          style={{ fontSize: '8px', color: 'var(--nd-text-disabled)' }}
        >
          Less
        </span>
        {[0, 1, 2, 3].map((level) => (
          <div
            key={level}
            style={{
              width: `${CELL_SIZE}px`,
              height: `${CELL_SIZE}px`,
              borderRadius: '2px',
              backgroundColor: getCellColor(level),
            }}
          />
        ))}
        <span
          className="font-mono"
          style={{ fontSize: '8px', color: 'var(--nd-text-disabled)' }}
        >
          More
        </span>
      </div>
    </div>
  );
}
