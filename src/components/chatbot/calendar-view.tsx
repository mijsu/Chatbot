'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, Bell, Clock, Circle } from 'lucide-react';
import {
  useOfflineMonthTasks,
  useOfflineReminders,
  useOfflineHabits,
} from '@/hooks/use-offline-data';
import { formatTime12 } from '@/lib/offline-db';

/* ─── Types ─── */

interface CalendarViewProps {
  onNavigate?: (page: string) => void;
}

/* ─── Constants ─── */

const DAYS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

const DOT_COLORS = {
  task: '#F7931A',    // Orange
  reminder: '#FFD600', // Yellow
  habit: '#00BCD4',    // Cyan
} as const;

/* ─── Helpers ─── */

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function generateMonthGrid(year: number, month: number): (Date | null)[][] {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const weeks: (Date | null)[][] = [];
  let currentWeek: (Date | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(null);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(new Date(year, month, day));
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  return weeks;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

/* ─── Component ─── */

export default function CalendarView({ onNavigate }: CalendarViewProps) {
  const [today] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());

  // Data hooks
  const currentMonthKey = useMemo(
    () => `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
    [currentYear, currentMonth]
  );
  const { monthTasks } = useOfflineMonthTasks(currentMonthKey);
  const { reminders } = useOfflineReminders();
  const { habits } = useOfflineHabits();

  const monthGrid = useMemo(
    () => generateMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Build date → data maps for efficient lookup
  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof monthTasks>();
    for (const task of monthTasks) {
      const dateKey = task.date;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(task);
    }
    return map;
  }, [monthTasks]);

  const remindersByDate = useMemo(() => {
    // Reminders don't have a date field — they are recurring/time-based.
    // We'll show all active (non-completed) reminders as present "today" for the calendar view.
    // For recurring reminders, we show them on all days within the current month.
    const map = new Map<string, typeof reminders>();
    const activeReminders = reminders.filter(r => !r.completed);
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayReminders: typeof reminders = [];
      for (const r of activeReminders) {
        // Show recurring reminders on every day of the month
        // Show one-time reminders (no recurring) only if their time matches today
        if (r.recurring && r.recurring !== '') {
          dayReminders.push(r);
        } else if (isSameDay(new Date(r.createdAt), new Date(dateStr))) {
          dayReminders.push(r);
        }
      }
      if (dayReminders.length > 0) {
        map.set(dateStr, dayReminders);
      }
    }
    return map;
  }, [reminders, currentYear, currentMonth]);

  const habitsByDate = useMemo(() => {
    // Show habits on days where they should be completed.
    // Daily habits appear every day; weekly habits appear on the day they were created (or every 7 days).
    const map = new Map<string, typeof habits>();
    const activeHabits = habits;
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayHabits: typeof habits = [];
      for (const h of activeHabits) {
        if (h.frequency === 'weekly') {
          // Show weekly habits on the same weekday as their creation day
          const createdDate = new Date(h.createdAt);
          const cellDate = new Date(dateStr);
          if (createdDate.getDay() === cellDate.getDay()) {
            dayHabits.push(h);
          }
        } else {
          // Daily habits appear every day
          dayHabits.push(h);
        }
      }
      if (dayHabits.length > 0) {
        map.set(dateStr, dayHabits);
      }
    }
    return map;
  }, [habits, currentYear, currentMonth]);

  // Navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
    setSelectedDate(new Date(currentMonth === 0 ? currentYear - 1 : currentYear, currentMonth === 0 ? 11 : currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
    setSelectedDate(new Date(currentMonth === 11 ? currentYear + 1 : currentYear, currentMonth === 11 ? 0 : currentMonth + 1, 1));
  };

  // Selected date info
  const selectedDateStr = formatDateISO(selectedDate);
  const selectedDateTasks = tasksByDate.get(selectedDateStr) || [];
  const selectedDateReminders = remindersByDate.get(selectedDateStr) || [];
  const selectedDateHabits = habitsByDate.get(selectedDateStr) || [];
  const selectedDateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  return (
    <div className="flex flex-col gap-4">
      {/* ── Calendar Grid ── */}
      <div
        className="p-3"
        style={{
          background: 'var(--nd-surface)',
          border: '1px solid var(--nd-border)',
          borderRadius: '12px',
        }}
      >
        {/* Month/Year Header with arrows */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handlePrevMonth}
            className="w-7 h-7 flex items-center justify-center transition-colors duration-200"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
          </button>
          <span
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-primary)' }}
          >
            {MONTHS[currentMonth]} {currentYear}
          </span>
          <button
            onClick={handleNextMonth}
            className="w-7 h-7 flex items-center justify-center transition-colors duration-200"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
          </button>
        </div>

        {/* Day headers — S M T W T F S */}
        <div className="grid grid-cols-7 gap-0 mb-1">
          {DAYS_SHORT.map((day, i) => (
            <div
              key={`${day}-${i}`}
              className="text-center font-mono text-[9px] uppercase tracking-[0.08em] py-1"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Date cells — compact 40x40px */}
        {monthGrid.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-0">
            {week.map((date, di) => {
              if (!date) {
                return (
                  <div
                    key={`empty-${wi}-${di}`}
                    className="w-10 h-10 mx-auto"
                  />
                );
              }

              const dateStr = formatDateISO(date);
              const isTodayDate = isSameDay(date, today);
              const isSelectedDate = isSameDay(date, selectedDate);
              const hasTasks = (tasksByDate.get(dateStr)?.length || 0) > 0;
              const hasReminders = (remindersByDate.get(dateStr)?.length || 0) > 0;
              const hasHabits = (habitsByDate.get(dateStr)?.length || 0) > 0;
              const hasAny = hasTasks || hasReminders || hasHabits;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelectedDate(date)}
                  aria-label={`${MONTHS[date.getMonth()]} ${date.getDate()}`}
                  className="w-10 h-10 mx-auto flex flex-col items-center justify-center transition-all duration-200 relative"
                  style={{
                    background: isSelectedDate ? 'var(--nd-text-display)' : 'transparent',
                    borderRadius: '8px',
                    boxShadow: isTodayDate && !isSelectedDate
                      ? 'inset 0 0 0 1.5px var(--nd-text-display)'
                      : 'none',
                  }}
                >
                  <span
                    className="text-[11px] font-semibold leading-none"
                    style={{
                      color: isSelectedDate
                        ? 'var(--nd-black)'
                        : isTodayDate
                          ? 'var(--nd-text-display)'
                          : 'var(--nd-text-primary)',
                    }}
                  >
                    {date.getDate()}
                  </span>

                  {/* Colored dots row */}
                  {hasAny && (
                    <div className="flex items-center gap-[2px] mt-0.5">
                      {hasTasks && (
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: isSelectedDate ? 'var(--nd-black)' : DOT_COLORS.task }}
                        />
                      )}
                      {hasReminders && (
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: isSelectedDate ? 'var(--nd-black)' : DOT_COLORS.reminder }}
                        />
                      )}
                      {hasHabits && (
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ backgroundColor: isSelectedDate ? 'var(--nd-black)' : DOT_COLORS.habit }}
                        />
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-3 pt-2" style={{ borderTop: '1px solid var(--nd-border)' }}>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: DOT_COLORS.task }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
              Tasks
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: DOT_COLORS.reminder }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
              Reminders
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full" style={{ backgroundColor: DOT_COLORS.habit }} />
            <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
              Habits
            </span>
          </div>
        </div>
      </div>

      {/* ── Selected Date Detail Panel ── */}
      <div
        className="p-4"
        style={{
          background: 'var(--nd-surface)',
          border: '1px solid var(--nd-border)',
          borderRadius: '12px',
        }}
      >
        {/* Date header */}
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-primary)' }}
          >
            {selectedDateLabel}
          </h2>
          <div className="flex items-center gap-2">
            {hasTasksForSelected() && (
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: DOT_COLORS.task }}>
                {selectedDateTasks.length}T
              </span>
            )}
            {hasRemindersForSelected() && (
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: DOT_COLORS.reminder }}>
                {selectedDateReminders.length}R
              </span>
            )}
            {hasHabitsForSelected() && (
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: DOT_COLORS.habit }}>
                {selectedDateHabits.length}H
              </span>
            )}
          </div>
        </div>

        {/* Tasks */}
        {selectedDateTasks.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DOT_COLORS.task }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
                Tasks
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-hide">
              {selectedDateTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                  style={{
                    background: 'var(--nd-black)',
                    opacity: task.completed ? 0.5 : 1,
                  }}
                >
                  {task.completed ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: DOT_COLORS.task, strokeWidth: 1.5 }} />
                  ) : (
                    <Circle className="w-3 h-3 shrink-0" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  )}
                  <span
                    className="font-mono text-[10px] truncate flex-1"
                    style={{
                      color: task.completed ? 'var(--nd-text-secondary)' : 'var(--nd-text-display)',
                      textDecoration: task.completed ? 'line-through' : 'none',
                    }}
                  >
                    {task.title}
                  </span>
                  {task.time && (
                    <span className="font-mono text-[9px] shrink-0" style={{ color: 'var(--nd-text-secondary)' }}>
                      {formatTime12(task.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reminders */}
        {selectedDateReminders.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DOT_COLORS.reminder }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
                Reminders
              </span>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto scrollbar-hide">
              {selectedDateReminders.map(reminder => (
                <div
                  key={reminder.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                  style={{ background: 'var(--nd-black)' }}
                >
                  <Bell className="w-3 h-3 shrink-0" style={{ color: DOT_COLORS.reminder, strokeWidth: 1.5 }} />
                  <span
                    className="font-mono text-[10px] truncate flex-1"
                    style={{ color: 'var(--nd-text-display)' }}
                  >
                    {reminder.title}
                  </span>
                  {reminder.time && (
                    <span className="flex items-center gap-0.5 font-mono text-[9px] shrink-0" style={{ color: 'var(--nd-text-secondary)' }}>
                      <Clock className="w-2 h-2" style={{ strokeWidth: 1.5 }} />
                      {formatTime12(reminder.time)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Habits */}
        {selectedDateHabits.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: DOT_COLORS.habit }} />
              <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
                Habits
              </span>
            </div>
            <div className="space-y-1.5 max-h-28 overflow-y-auto scrollbar-hide">
              {selectedDateHabits.map(habit => {
                const isCompletedToday = habit.lastCompletedDate === selectedDateStr;
                return (
                  <div
                    key={habit.id}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg"
                    style={{ background: 'var(--nd-black)' }}
                  >
                    {isCompletedToday ? (
                      <CheckCircle2 className="w-3 h-3 shrink-0" style={{ color: DOT_COLORS.habit, strokeWidth: 1.5 }} />
                    ) : (
                      <Circle className="w-3 h-3 shrink-0" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    )}
                    <span
                      className="font-mono text-[10px] truncate flex-1"
                      style={{
                        color: isCompletedToday ? 'var(--nd-text-secondary)' : 'var(--nd-text-display)',
                        textDecoration: isCompletedToday ? 'line-through' : 'none',
                      }}
                    >
                      {habit.title}
                    </span>
                    <span className="font-mono text-[9px] shrink-0" style={{ color: 'var(--nd-text-secondary)' }}>
                      {habit.streak}d
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {selectedDateTasks.length === 0 && selectedDateReminders.length === 0 && selectedDateHabits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-6">
            <CheckCircle2 className="w-6 h-6 mb-2" style={{ color: 'var(--nd-text-disabled)', strokeWidth: 1.5 }} />
            <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
              Nothing scheduled
            </p>
          </div>
        )}
      </div>
    </div>
  );

  function hasTasksForSelected() {
    return selectedDateTasks.length > 0;
  }
  function hasRemindersForSelected() {
    return selectedDateReminders.length > 0;
  }
  function hasHabitsForSelected() {
    return selectedDateHabits.length > 0;
  }
}
