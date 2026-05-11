'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAI } from '@/hooks/use-ai';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Users,
  Plus,
  CheckCircle2,
  Circle,
  Briefcase,
  Palette,
  Coffee,
  Code,
  Trash2,
  Bell,
  Calendar,
  X,
  Search,
  CalendarClock,
  Repeat,
  Pencil,
  Link2,
} from 'lucide-react';
import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ConfirmDialog from '@/components/chatbot/confirm-dialog';
import CalendarView from '@/components/chatbot/calendar-view';
import SwipeableItem from '@/components/chatbot/swipeable-item';
import EmptyState from '@/components/chatbot/empty-state';
import { useOfflineTasks, useOfflineMonthTasks, useOfflineReminders, useOfflineProfile, useOfflineSettings, useOfflineGoals, useOfflineHabits, useOfflineMoods } from '@/hooks/use-offline-data';
import { useNotifications } from '@/hooks/use-notifications';
import { formatTime12 } from '@/lib/offline-db';
import type { OfflineTask, OfflineMoodEntry } from '@/lib/offline-db';
import SmartSchedulingPanel from '@/components/chatbot/smart-scheduling';
import TagInput, { TagPill, getTagColor } from '@/components/chatbot/tag-input';
import TagFilter from '@/components/chatbot/tag-filter';
import { playCompletionSound, playDeleteSound, hapticSuccess, hapticLight } from '@/lib/feedback';

/* ─── Types ─── */

interface PlannerScreenProps {
  onNavigate: (page: string) => void;
  onOpenVoiceModal: () => void;
  aiContent?: any;
}

/* ─── Constants ─── */

const DAYS_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

const CATEGORIES = ['general', 'meeting', 'design', 'code', 'personal'] as const;
// REMINDER_ICONS removed — unused constant
const PRIORITIES = ['high', 'medium', 'low'] as const;

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return '#EF4444';
    case 'low': return '#FFD600';
    default: return '#F7931A';
  }
}

function getPriorityBorder(priority: string, completed: boolean): string {
  if (completed) return '2px solid var(--nd-border-visible)';
  return `3px solid ${getPriorityColor(priority)}`;
}

function getCategoryIcon(category: string) {
  const iconStyle = { color: 'var(--nd-text-secondary)', strokeWidth: 1.5 } as const;
  switch (category) {
    case 'meeting':
      return <Briefcase className="w-4 h-4" style={iconStyle} />;
    case 'design':
      return <Palette className="w-4 h-4" style={iconStyle} />;
    case 'code':
      return <Code className="w-4 h-4" style={iconStyle} />;
    case 'personal':
      return <Coffee className="w-4 h-4" style={iconStyle} />;
    default:
      return <CheckCircle2 className="w-4 h-4" style={iconStyle} />;
  }
}

function getReminderIcon(icon: string) {
  const iconStyle = { color: 'var(--nd-text-secondary)', strokeWidth: 1.5 } as const;
  switch (icon) {
    case 'clock':
      return <Clock className="w-4 h-4" style={iconStyle} />;
    case 'calendar':
      return <Calendar className="w-4 h-4" style={iconStyle} />;
    default:
      return <Bell className="w-4 h-4" style={iconStyle} />;
  }
}

function formatDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function generateDateStrip(year: number, month: number, selectedDay: number, count: number) {
  const dates: Date[] = [];
  const baseDate = new Date(year, month, selectedDay);
  const start = new Date(baseDate);
  start.setDate(start.getDate() - 3);
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
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

/* ─── Task Card Skeleton ─── */

function TaskCardSkeleton() {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--nd-surface)', borderLeft: '3px solid var(--nd-border)' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-5 h-5 rounded-full nd-skeleton shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 nd-skeleton rounded" />
            <div className="h-3.5 w-2/3 nd-skeleton rounded" />
          </div>
          <div className="h-3 w-full nd-skeleton rounded" />
          <div className="h-3 w-1/2 nd-skeleton rounded" />
        </div>
      </div>
    </div>
  );
}

/* ─── Inline Status ─── */

function InlineStatus({ type, message }: { type: 'loading' | 'saved' | 'error'; message?: string }) {
  if (type === 'loading') {
    return <DotmTriangle11 size={16} color="var(--nd-text-secondary)" speed={2} />;
  }
  if (type === 'saved') {
    return (
      <span
        className="font-mono text-[11px] uppercase tracking-[0.08em]"
        style={{ color: 'var(--nd-success)' }}
      >
        [SAVED]
      </span>
    );
  }
  return (
    <span
      className="font-mono text-[11px] uppercase tracking-[0.08em]"
      style={{ color: 'var(--nd-accent)' }}
    >
      [ERROR: {message || 'FAILED'}]
    </span>
  );
}

/* ─── Component ─── */

export default function PlannerScreen({ onNavigate, onOpenVoiceModal, aiContent }: PlannerScreenProps) {
  // AI-generated labels (fallback to defaults)
  const plannerAI = aiContent?.planner;
  const headerLabel = plannerAI?.headerLabel || 'PLANNER';
  const emptyTasksMessage = plannerAI?.emptyTasksMessage || 'No tasks for this day';
  const emptyTasksHint = plannerAI?.emptyTasksHint || 'Tap + to add one';
  const aiTaskButtonLabel = plannerAI?.aiTaskButtonLabel || 'SMART ADD';
  const remindersSectionLabel = plannerAI?.remindersSectionLabel || 'REMINDERS';
  const emptyRemindersMessage = plannerAI?.emptyRemindersMessage || 'No reminders';
  const searchPlaceholder = plannerAI?.searchPlaceholder || 'Search tasks...';
  const { getEndpoint, getModelName, getApiKey } = useAI();
  const [today] = useState(() => new Date());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  // Inline status
  const [statusMessage, setStatusMessage] = useState<{ type: 'saved' | 'error'; message?: string } | null>(null);

  // Add task dialog
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formParticipants, setFormParticipants] = useState('');
  const [formCategory, setFormCategory] = useState<string>('general');
  const [formPriority, setFormPriority] = useState<string>('medium');
  const [formTags, setFormTags] = useState<string>('');

  // AI task priority
  const [aiPriority, setAiPriority] = useState<string>('medium');

  // Add task: dependsOn (comma-separated task IDs)
  const [formDependsOn, setFormDependsOn] = useState<string[]>([]);

  // Edit task: dependsOn
  const [editDependsOn, setEditDependsOn] = useState<string[]>([]);

  // Quick action popup
  const [showQuickActions, setShowQuickActions] = useState(false);

  // AI task dialog
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiCreating, setAiCreating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Delete task dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [deletingTask, setDeletingTask] = useState(false);

  // AI reminder dialog
  const [showAIReminderDialog, setShowAIReminderDialog] = useState(false);
  const [aiReminderDescription, setAiReminderDescription] = useState('');
  const [aiReminderCreating, setAiReminderCreating] = useState(false);
  const [aiReminderError, setAiReminderError] = useState('');
  const [aiReminderRecurring, setAiReminderRecurring] = useState('');
  const [aiReminderRecurringEndDate, setAiReminderRecurringEndDate] = useState('');

  // Delete reminder dialog
  const [showDeleteReminderDialog, setShowDeleteReminderDialog] = useState(false);
  const [deleteReminderId, setDeleteReminderId] = useState<string | null>(null);
  const [deletingReminder, setDeletingReminder] = useState(false);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Reschedule dialog
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [rescheduleTask, setRescheduleTask] = useState<OfflineTask | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleHour, setRescheduleHour] = useState('');
  const [rescheduleMinute, setRescheduleMinute] = useState('');
  const [rescheduleAmPm, setRescheduleAmPm] = useState<'AM' | 'PM'>('AM');
  const [rescheduling, setRescheduling] = useState(false);

  // Edit task dialog
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTask, setEditTask] = useState<OfflineTask | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [editAmPm, setEditAmPm] = useState<'AM' | 'PM'>('AM');
  const [editLocation, setEditLocation] = useState('');
  const [editParticipants, setEditParticipants] = useState('');
  const [editCategory, setEditCategory] = useState<string>('general');
  const [editPriority, setEditPriority] = useState<string>('medium');
  const [editTags, setEditTags] = useState<string>('');
  const [editSaving, setEditSaving] = useState(false);

  // Tag filter
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Reminder hooks (IndexedDB via Dexie)
  const { reminders, loading: remindersLoading, addReminder, deleteReminder, toggleReminderComplete: toggleReminderHook, reload: reloadReminders } = useOfflineReminders();

  // Notification system — reschedule after any task/reminder changes
  const { scheduleAll: rescheduleNotifications } = useNotifications();

  const dateStrip = useMemo(
    () => generateDateStrip(currentYear, currentMonth, selectedDate.getDate(), 14),
    [currentYear, currentMonth, selectedDate]
  );

  const monthGrid = useMemo(
    () => generateMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  const selectedDateStr = useMemo(() => formatDateISO(selectedDate), [selectedDate]);

  const currentMonthKey = useMemo(
    () => `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`,
    [currentYear, currentMonth]
  );

  // Task hooks (IndexedDB via Dexie)
  const { tasks, loading, addTask, updateTask, deleteTask, toggleTaskComplete: toggleTaskCompleteHook, reload: reloadTasks } = useOfflineTasks(selectedDateStr);
  const { monthTasks, reload: reloadMonthTasks } = useOfflineMonthTasks(currentMonthKey);

  // User context hooks for personalized AI
  const { profile } = useOfflineProfile();
  const { settings } = useOfflineSettings();
  const { goals } = useOfflineGoals();
  const { habits } = useOfflineHabits();
  const { moods } = useOfflineMoods();

  const getUserContext = useCallback(() => {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const todayMood = moods.find(m => m.date === today);
    return {
      name: profile.name || 'User',
      aboutMe: profile.aboutMe || '',
      role: settings.role || '',
      interests: settings.interests || '',
      activeGoals: goals.filter(g => !g.completed).map(g => g.title),
      todayHabits: habits.map(h => ({
        title: h.title,
        streak: h.streak,
        done: h.lastCompletedDate === today,
      })),
      mood: todayMood?.mood,
      energy: todayMood?.energy,
    };
  }, [profile, settings, goals, habits, moods]);

  /* ─── Dependency Helpers ─── */

  function areDependenciesMet(task: OfflineTask, allTasks: OfflineTask[]): boolean {
    if (!task.dependsOn) return true;
    const depIds = task.dependsOn.split(',').filter(Boolean);
    return depIds.every(depId => {
      const dep = allTasks.find(t => t.id === depId);
      return dep?.completed === true;
    });
  }

  function getUnmetDependencyNames(task: OfflineTask, allTasks: OfflineTask[]): string[] {
    if (!task.dependsOn) return [];
    const depIds = task.dependsOn.split(',').filter(Boolean);
    return depIds
      .filter(depId => {
        const dep = allTasks.find(t => t.id === depId);
        return !dep?.completed;
      })
      .map(depId => {
        const dep = allTasks.find(t => t.id === depId);
        return dep?.title || 'Unknown task';
      });
  }

  // Available tasks for dependency selection (incomplete, not the current task)
  const availableDepTasks = useMemo(() => {
    return tasks.filter(t => !t.completed);
  }, [tasks]);

  /* ─── Helpers ─── */

  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showStatus = useCallback((type: 'saved' | 'error', message?: string) => {
    setStatusMessage({ type, message });
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    statusTimerRef.current = setTimeout(() => setStatusMessage(null), 2500);
  }, []);

  // Parse rescheduleTime into hour/minute/ampm when it changes
  useEffect(() => {
    if (rescheduleTime && /^\d{1,2}:\d{2}$/.test(rescheduleTime)) {
      const [h, m] = rescheduleTime.split(':').map(Number);
      if (h === 0) { setRescheduleHour('12'); setRescheduleAmPm('AM'); }
      else if (h === 12) { setRescheduleHour('12'); setRescheduleAmPm('PM'); }
      else if (h > 12) { setRescheduleHour(String(h - 12)); setRescheduleAmPm('PM'); }
      else { setRescheduleHour(String(h)); setRescheduleAmPm('AM'); }
      setRescheduleMinute(String(m).padStart(2, '0'));
    }
  }, [rescheduleTime]);

  // Parse editTime into hour/minute/ampm when it changes
  useEffect(() => {
    if (editTime && /^\d{1,2}:\d{2}$/.test(editTime)) {
      const [h, m] = editTime.split(':').map(Number);
      if (h === 0) { setEditHour('12'); setEditAmPm('AM'); }
      else if (h === 12) { setEditHour('12'); setEditAmPm('PM'); }
      else if (h > 12) { setEditHour(String(h - 12)); setEditAmPm('PM'); }
      else { setEditHour(String(h)); setEditAmPm('AM'); }
      setEditMinute(String(m).padStart(2, '0'));
    }
  }, [editTime]);

  // Build 24h time string from reschedule AM/PM components
  const buildRescheduleTime24 = () => {
    const h = parseInt(rescheduleHour) || 0;
    const m = parseInt(rescheduleMinute) || 0;
    let h24 = h;
    if (rescheduleAmPm === 'AM' && h === 12) h24 = 0;
    else if (rescheduleAmPm === 'PM' && h !== 12) h24 = h + 12;
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Build 24h time string from edit AM/PM components
  const buildEditTime24 = () => {
    const h = parseInt(editHour) || 0;
    const m = parseInt(editMinute) || 0;
    let h24 = h;
    if (editAmPm === 'AM' && h === 12) h24 = 0;
    else if (editAmPm === 'PM' && h !== 12) h24 = h + 12;
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // Re-schedule device notifications when tasks or reminders change
  useEffect(() => {
    const timer = setTimeout(() => {
      rescheduleNotifications().catch(() => {});
    }, 1000); // Debounce 1 second to avoid rapid re-scheduling
    return () => clearTimeout(timer);
  }, [tasks.length, reminders.length, tasks, reminders, rescheduleNotifications]);

  /* ─── Filtered Tasks ─── */

  const filteredTasks = useMemo(() => {
    let result = tasks;
    // Category filter
    if (activeCategory !== 'all') {
      result = result.filter((t) => t.category === activeCategory);
    }
    // Tag filter
    if (selectedTag) {
      result = result.filter((t) => {
        const taskTags = (t.tags || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        return taskTags.includes(selectedTag.toLowerCase());
      });
    }
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.location || '').toLowerCase().includes(q) ||
        (t.participants || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.tags || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [tasks, activeCategory, selectedTag, searchQuery]);

  const FILTER_CHIPS = ['all', ...CATEGORIES] as const;

  // Collect all unique tags from tasks for filtering
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of tasks) {
      const tTags = (t.tags || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      tTags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }, [tasks]);

  // Suggested tags for the TagInput
  const SUGGESTED_TAGS = ['urgent', 'review', 'focus', 'creative', 'team', 'deadline', 'research', 'follow-up'];

  /* ─── Smart Scheduling: Apply suggestion to form fields ─── */

  const handleApplySuggestionAdd = useCallback((hour24: number) => {
    // Convert 24h to 12h display string for the simple text input
    setFormTime(formatTime12(`${String(hour24).padStart(2, '0')}:00`));
  }, []);

  const handleApplySuggestionEdit = useCallback((hour24: number) => {
    // Set the hour/minute/AMPM fields for the edit dialog
    if (hour24 === 0) { setEditHour('12'); setEditAmPm('AM'); }
    else if (hour24 === 12) { setEditHour('12'); setEditAmPm('PM'); }
    else if (hour24 > 12) { setEditHour(String(hour24 - 12)); setEditAmPm('PM'); }
    else { setEditHour(String(hour24)); setEditAmPm('AM'); }
    setEditMinute('00');
  }, []);

  /* ─── Edit Task ─── */

  const openEditDialog = (task: OfflineTask) => {
    setEditTask(task);
    setEditTitle(task.title || '');
    setEditDescription(task.description || '');
    setEditTime(task.time || '');
    setEditLocation(task.location || '');
    setEditParticipants(task.participants || '');
    setEditCategory(task.category || 'general');
    setEditPriority(task.priority || 'medium');
    setEditTags(task.tags || '');
    setEditDependsOn((task.dependsOn || '').split(',').filter(Boolean));
    setEditSaving(false);
    setShowEditDialog(true);
  };

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setEditTask(null);
    setEditTitle('');
    setEditDescription('');
    setEditTime('');
    setEditLocation('');
    setEditParticipants('');
    setEditCategory('general');
    setEditPriority('medium');
    setEditTags('');
    setEditDependsOn([]);
    setEditSaving(false);
  };

  const handleEditTask = async () => {
    if (!editTask || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      const computedTime = (editHour && editMinute) ? buildEditTime24() : editTime.trim();
      await updateTask(editTask.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        time: computedTime,
        location: editLocation.trim(),
        participants: editParticipants.trim(),
        category: editCategory,
        priority: editPriority,
        tags: editTags,
        dependsOn: editDependsOn.join(','),
      });
      reloadMonthTasks();
      closeEditDialog();
      showStatus('saved');
    } catch {
      showStatus('error', 'EDIT FAILED');
    } finally {
      setEditSaving(false);
    }
  };

  /* ─── Reschedule Task ─── */

  const openRescheduleDialog = (task: OfflineTask) => {
    setRescheduleTask(task);
    setRescheduleDate(task.date || selectedDateStr);
    setRescheduleTime(task.time || '');
    setRescheduling(false);
    setShowRescheduleDialog(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleTask) return;
    setRescheduling(true);
    try {
      const computedTime = (rescheduleHour && rescheduleMinute) ? buildRescheduleTime24() : rescheduleTime;
      await updateTask(rescheduleTask.id, {
        date: rescheduleDate,
        time: computedTime,
      });
      reloadMonthTasks();
      setShowRescheduleDialog(false);
      setRescheduleTask(null);
      showStatus('saved');
    } catch {
      showStatus('error', 'RESCHEDULE FAILED');
    } finally {
      setRescheduling(false);
    }
  };

  /* ─── AI Reminder Create ─── */

  const handleAIReminderCreate = async () => {
    if (!aiReminderDescription.trim()) return;
    setAiReminderCreating(true);
    setAiReminderError('');
    try {
      // Step 1: Parse with AI
      const parseRes = await fetch('/api/ai/reminder-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiReminderDescription.trim(), customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext: getUserContext() }),
      });
      if (!parseRes.ok) throw new Error('AI parsing failed');
      const parseData = await parseRes.json();
      const parsed = parseData.reminder;

      // Step 2: Create the reminder via IndexedDB
      await addReminder({
        title: parsed.title || 'New Reminder',
        description: parsed.description || '',
        time: parsed.time || '',
        icon: parsed.icon || 'bell',
        completed: false,
        recurring: aiReminderRecurring || (parsed.recurring || ''),
        recurringEndDate: aiReminderRecurringEndDate || (parsed.recurringEndDate || ''),
      });

      setShowAIReminderDialog(false);
      setAiReminderDescription('');
      setAiReminderRecurring('');
      setAiReminderRecurringEndDate('');
      showStatus('saved');
    } catch {
      setAiReminderError('Failed to create reminder. Please try again.');
    } finally {
      setAiReminderCreating(false);
    }
  };

  /* ─── Toggle Reminder Completion ─── */

  const toggleReminderComplete = async (reminder: typeof reminders[number]) => {
    try {
      await toggleReminderHook(reminder.id, reminder.completed);
      if (!reminder.completed) {
        playCompletionSound();
      } else {
        playDeleteSound();
      }
      showStatus('saved');
    } catch {
      showStatus('error', 'UPDATE FAILED');
    }
  };

  /* ─── Delete Reminder ─── */

  const openDeleteReminderDialog = (reminderId: string) => {
    setDeleteReminderId(reminderId);
    setShowDeleteReminderDialog(true);
  };

  const handleDeleteReminder = async () => {
    if (!deleteReminderId) return;
    setDeletingReminder(true);
    try {
      await deleteReminder(deleteReminderId);
      playDeleteSound();
      setShowDeleteReminderDialog(false);
      setDeleteReminderId(null);
      showStatus('saved');
    } catch {
      showStatus('error', 'DELETE FAILED');
    } finally {
      setDeletingReminder(false);
    }
  };

  /* ─── Month Navigation ─── */

  const handlePrevMonth = () => {
    let newMonth = currentMonth;
    let newYear = currentYear;
    if (currentMonth === 0) {
      newMonth = 11;
      newYear = currentYear - 1;
    } else {
      newMonth = currentMonth - 1;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    const maxDays = getDaysInMonth(newYear, newMonth);
    const newDay = Math.min(selectedDate.getDate(), maxDays);
    setSelectedDate(new Date(newYear, newMonth, newDay));
  };

  const handleNextMonth = () => {
    let newMonth = currentMonth;
    let newYear = currentYear;
    if (currentMonth === 11) {
      newMonth = 0;
      newYear = currentYear + 1;
    } else {
      newMonth = currentMonth + 1;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
    const maxDays = getDaysInMonth(newYear, newMonth);
    const newDay = Math.min(selectedDate.getDate(), maxDays);
    setSelectedDate(new Date(newYear, newMonth, newDay));
  };

  /* ─── Toggle Task Completion ─── */

  const toggleTaskComplete = async (task: typeof tasks[number]) => {
    // Check dependencies — prevent completing if dependencies are unmet
    if (!task.completed && !areDependenciesMet(task, tasks)) {
      showStatus('error', 'COMPLETE DEPENDENCIES FIRST');
      return;
    }
    try {
      await toggleTaskCompleteHook(task.id, task.completed);
      if (!task.completed) {
        playCompletionSound();
        hapticSuccess();
        // Check if completing this task unblocks any other tasks
        const unblockedTasks = tasks.filter(t => {
          if (t.completed || !t.dependsOn) return false;
          const depIds = t.dependsOn.split(',').filter(Boolean);
          return depIds.includes(task.id) && areDependenciesMet(t, tasks.map(existing =>
            existing.id === task.id ? { ...existing, completed: true } : existing
          ));
        });
        for (const unblocked of unblockedTasks) {
          showStatus('saved', `🎉 '${unblocked.title}' is now unblocked!`);
        }
      }
      showStatus('saved');
    } catch {
      showStatus('error', 'UPDATE FAILED');
    }
  };

  /* ─── AI Task Create ─── */

  const handleAITaskCreate = async () => {
    if (!aiDescription.trim()) return;
    setAiCreating(true);
    setAiError('');
    try {
      // Step 1: Parse with AI
      const parseRes = await fetch('/api/ai/task-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription.trim(), date: selectedDateStr, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext: getUserContext() }),
      });
      if (!parseRes.ok) throw new Error('AI parsing failed');
      const parseData = await parseRes.json();
      const parsed = parseData.task;

      // Step 2: Create the task via IndexedDB
      await addTask({
        title: parsed.title || 'New Task',
        description: parsed.description || '',
        time: parsed.time || '',
        location: parsed.location || '',
        participants: parsed.participants || '',
        category: parsed.category || 'general',
        priority: aiPriority,
        completed: false,
        date: parsed.date || selectedDateStr,
        tags: parsed.tags || '',
      });

      reloadMonthTasks();
      setShowAIDialog(false);
      setAiDescription('');
      setAiPriority('medium');
      showStatus('saved');
    } catch {
      setAiError('Failed to create task. Please try again.');
    } finally {
      setAiCreating(false);
    }
  };

  /* ─── Add Task ─── */

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTime('');
    setFormLocation('');
    setFormParticipants('');
    setFormCategory('general');
    setFormPriority('medium');
    setFormTags('');
    setFormDependsOn([]);
  };

  const handleAddTask = async () => {
    if (!formTitle.trim()) return;
    setAddingTask(true);
    try {
      await addTask({
        title: formTitle.trim(),
        description: formDescription.trim(),
        time: formTime.trim(),
        location: formLocation.trim(),
        participants: formParticipants.trim(),
        category: formCategory,
        priority: formPriority,
        completed: false,
        date: selectedDateStr,
        tags: formTags,
        dependsOn: formDependsOn.join(','),
      });

      reloadMonthTasks();
      setShowAddDialog(false);
      resetForm();
      showStatus('saved');
    } catch {
      showStatus('error', 'ADD FAILED');
    } finally {
      setAddingTask(false);
    }
  };

  /* ─── Delete Task ─── */

  const openDeleteDialog = (taskId: string) => {
    setDeleteTaskId(taskId);
    setShowDeleteDialog(true);
  };

  const handleDeleteTask = async () => {
    if (!deleteTaskId) return;
    setDeletingTask(true);
    try {
      await deleteTask(deleteTaskId);
      playDeleteSound();
      hapticLight();
      reloadMonthTasks();
      setShowDeleteDialog(false);
      setDeleteTaskId(null);
      showStatus('saved');
    } catch {
      showStatus('error', 'DELETE FAILED');
    } finally {
      setDeletingTask(false);
    }
  };

  /* ─── Date Helpers ─── */

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const isToday = (d: Date) => isSameDay(d, today);
  const isSelected = (d: Date) => isSameDay(d, selectedDate);

  const selectedDateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).toUpperCase();

  /* ─── Render ─── */

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: 'var(--nd-black)', overflow: 'hidden' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1
            className="font-mono text-sm uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-display)' }}
          >
            {headerLabel}
          </h1>
          {/* Month Nav: < MARCH 2025 > — hidden in calendar mode (CalendarView has its own) */}
          {viewMode === 'list' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
            </button>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.08em] min-w-[120px] text-center"
              style={{ color: 'var(--nd-text-primary)' }}
            >
              {MONTHS[currentMonth]} {currentYear}
            </span>
            <button
              onClick={handleNextMonth}
              className="w-8 h-8 flex items-center justify-center transition-colors duration-200"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
            </button>
          </div>
          )}
        </div>

        {/* ── List / Calendar Toggle — Pill Buttons ── */}
        <div className="flex items-center gap-2 mb-4">
          {(['list', 'calendar'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className="px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.08em] transition-all duration-200"
              style={{
                background: viewMode === mode ? 'var(--nd-text-display)' : 'transparent',
                color: viewMode === mode ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                border: viewMode === mode ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* ── Date Strip (List View) ── */}
        {viewMode === 'list' && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {dateStrip.map((date) => {
              if (!date) return null;
              const dayAbbr = DAYS_SHORT[date.getDay()];
              const dayName = DAYS_FULL[date.getDay()];
              const dayNum = date.getDate();
              const todayHighlight = isToday(date);
              const selectedHighlight = isSelected(date);

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => {
                    setSelectedDate(date);
                    setCurrentMonth(date.getMonth());
                    setCurrentYear(date.getFullYear());
                  }}
                  aria-label={`Select ${dayName} ${dayNum}`}
                  className="flex flex-col items-center gap-1 min-w-[44px] py-2 px-1 transition-all duration-200"
                  style={{
                    background: selectedHighlight ? 'var(--nd-text-display)' : 'transparent',
                    color: selectedHighlight ? 'var(--nd-black)' : 'var(--nd-text-primary)',
                    border: todayHighlight && !selectedHighlight ? '1px solid var(--nd-border-visible)' : '1px solid transparent',
                  }}
                >
                  <span
                    className="font-mono text-[10px] uppercase tracking-[0.08em]"
                    style={{ color: selectedHighlight ? 'var(--nd-black)' : 'var(--nd-text-secondary)' }}
                  >
                    {dayAbbr}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: selectedHighlight ? 'var(--nd-black)' : todayHighlight ? 'var(--nd-text-display)' : 'var(--nd-text-primary)' }}
                  >
                    {dayNum}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Search & Filter (List View only) ── */}
      {viewMode === 'list' && (
      <div className="px-5 pb-2 flex-shrink-0">
        {/* Search bar */}
        <div className="relative flex items-center mb-3">
          <Search
            className="absolute left-3 w-3.5 h-3.5"
            style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }}
          />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent py-2.5 pl-9 pr-9 text-xs focus:outline-none"
            style={{
              color: 'var(--nd-text-primary)',
              border: '1px solid var(--nd-border-visible)',
              borderRadius: '10px',
              fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 p-0.5"
              style={{ color: 'var(--nd-text-secondary)' }}
              aria-label="Clear search"
            >
              <X className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
            </button>
          )}
        </div>

        {/* Category filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeCategory === chip;
            const label = chip === 'all' ? 'All' : chip.charAt(0).toUpperCase() + chip.slice(1);
            return (
              <button
                key={chip}
                onClick={() => setActiveCategory(chip)}
                className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] whitespace-nowrap transition-all duration-200"
                style={{
                  background: isActive ? 'var(--nd-text-display)' : 'transparent',
                  color: isActive ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                  border: isActive ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                  borderRadius: '10px',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Tag filter */}
        {availableTags.length > 0 && (
          <TagFilter
            availableTags={availableTags}
            selectedTag={selectedTag}
            onSelectTag={setSelectedTag}
          />
        )}
      </div>
      )}

      {/* ── Calendar View ── */}
      {viewMode === 'calendar' && (
        <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ minHeight: 0 }}>
          <CalendarView onNavigate={onNavigate} />
        </div>
      )}

      {/* ── Task List for Selected Date (List View only) ── */}
      {viewMode === 'list' && (
      <div className="flex-1 overflow-y-auto px-5 pb-4" style={{ minHeight: 0 }}>
        <div className="flex items-center justify-between mb-3">
          <h2
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-primary)' }}
          >
            {selectedDateLabel}
          </h2>
          <div className="flex items-center gap-2">
            {statusMessage && <InlineStatus type={statusMessage.type} message={statusMessage.message} />}
            <span
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              {filteredTasks.filter((t) => t.completed).length}/{filteredTasks.length}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <TaskCardSkeleton />
            <TaskCardSkeleton />
            <TaskCardSkeleton />
          </div>
        ) : filteredTasks.length === 0 ? (
          <EmptyState type="tasks" title={tasks.length === 0 ? emptyTasksMessage : 'No matching tasks'} />
        ) : (
          <div className="space-y-2">
            {filteredTasks.map((task) => (
              <SwipeableItem
                key={task.id}
                onSwipeRight={() => toggleTaskComplete(task)}
                onSwipeLeft={() => openDeleteDialog(task.id)}
                rightLabel={task.completed ? 'REOPEN' : 'COMPLETE'}
                disabled={false}
              >
              <div
                className="rounded-lg p-2.5 transition-colors duration-200"
                style={{
                  background: 'var(--nd-surface)',
                  borderLeft: getPriorityBorder(task.priority || 'medium', task.completed),
                  opacity: task.completed ? 0.6 : (!areDependenciesMet(task, tasks) ? 0.6 : 1),
                }}
              >
                <div className="flex items-start gap-2">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleTaskComplete(task)}
                    className="mt-0.5 shrink-0 nd-focus-ring"
                    aria-label={task.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {task.completed ? (
                      <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--nd-text-display)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--nd-black)' }} />
                      </div>
                    ) : (
                      <Circle className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    )}
                  </button>

                  {/* Task details */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => openRescheduleDialog(task)}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {/* Category Icon — monoline, no background container */}
                      {getCategoryIcon(task.category)}
                      <h3
                        className="text-xs font-medium truncate"
                        style={{
                          color: task.completed ? 'var(--nd-text-secondary)' : 'var(--nd-text-display)',
                          textDecoration: task.completed ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </h3>
                    </div>

                    {task.description && (
                      <p className="text-[10px] mb-1 line-clamp-1" style={{ color: 'var(--nd-text-disabled)' }}>
                        {task.description}
                      </p>
                    )}

                    {/* Dependency indicator — chain icon + waiting text */}
                    {!task.completed && !areDependenciesMet(task, tasks) && (
                      <div className="flex items-center gap-1 mb-1">
                        <Link2 className="w-2.5 h-2.5" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
                        <span className="font-mono text-[9px] uppercase tracking-[0.06em]" style={{ color: 'var(--nd-accent)' }}>
                          Waiting on: {getUnmetDependencyNames(task, tasks).join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Meta row — Space Mono, #999999 */}
                    <div className="flex flex-wrap items-center gap-2">
                      {task.time && (
                        <span className="flex items-center gap-0.5 font-mono text-[10px]" style={{ color: 'var(--nd-text-secondary)' }}>
                          <Clock className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                          {formatTime12(task.time)}
                        </span>
                      )}
                      {task.location && (
                        <span className="flex items-center gap-0.5 font-mono text-[10px]" style={{ color: 'var(--nd-text-secondary)' }}>
                          <MapPin className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                          {task.location}
                        </span>
                      )}
                      {task.participants && (
                        <span className="flex items-center gap-0.5 font-mono text-[10px]" style={{ color: 'var(--nd-text-secondary)' }}>
                          <Users className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                          {task.participants}
                        </span>
                      )}
                    </div>

                    {/* Tag pills */}
                    {(task.tags || '').split(',').map(t => t.trim()).filter(Boolean).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1">
                        {(task.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(tag => (
                          <TagPill key={tag} tag={tag} />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="mt-0.5 shrink-0 flex items-center gap-0.5">
                    {/* Edit button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); openEditDialog(task); }}
                      className="p-1 transition-colors duration-200"
                      style={{ color: 'var(--nd-text-secondary)' }}
                      aria-label="Edit task"
                    >
                      <Pencil className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
                    </button>
                    {/* Reschedule button */}
                    <button
                      onClick={() => openRescheduleDialog(task)}
                      className="p-1 transition-colors duration-200"
                      style={{ color: 'var(--nd-text-secondary)' }}
                      aria-label="Reschedule task"
                    >
                      <CalendarClock className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={() => openDeleteDialog(task.id)}
                      className="p-1 transition-colors duration-200"
                      style={{ color: 'var(--nd-text-secondary)' }}
                      aria-label="Delete task"
                    >
                      <Trash2 className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
                    </button>
                  </div>
                </div>
              </div>
              </SwipeableItem>
            ))}
          </div>
        )}

        {/* ── Reminders Section ── */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
          <h2
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-primary)' }}
          >
            {remindersSectionLabel}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setAiReminderDescription('');
                setAiReminderError('');
                setShowAIReminderDialog(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 transition-colors duration-200"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-secondary)',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
              aria-label="Smart add reminder"
            >
              <DotmTriangle11 size={14} dotSize={2} speed={1.2} color="var(--nd-text-secondary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />
              <span className="font-mono text-[10px] uppercase tracking-[0.06em]">{aiTaskButtonLabel}</span>
            </button>
            <span
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              {reminders.filter((r) => !r.completed).length}
            </span>
          </div>
        </div>

        {remindersLoading ? (
          <div className="flex items-center justify-center py-6">
            <InlineStatus type="loading" />
          </div>
        ) : reminders.length === 0 ? (
          <EmptyState type="reminders" title={emptyRemindersMessage} />
        ) : (
          <div className="space-y-1 max-h-44 overflow-y-auto scrollbar-hide">
            {reminders.map((reminder) => (
              <SwipeableItem
                key={reminder.id}
                onSwipeRight={() => toggleReminderComplete(reminder)}
                onSwipeLeft={() => openDeleteReminderDialog(reminder.id)}
                rightLabel={reminder.completed ? 'REOPEN' : 'DONE'}
              >
              <div
                className="rounded-lg p-2 transition-colors duration-200"
                style={{
                  background: 'var(--nd-surface)',
                  borderLeft: reminder.completed
                    ? '2px solid var(--nd-border-visible)'
                    : '2px solid var(--nd-accent)',
                  opacity: reminder.completed ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-2">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleReminderComplete(reminder)}
                    className="shrink-0"
                    aria-label={reminder.completed ? 'Mark as incomplete' : 'Mark as complete'}
                  >
                    {reminder.completed ? (
                      <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--nd-text-display)' }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--nd-black)' }} />
                      </div>
                    ) : (
                      <Circle className="w-3.5 h-3.5" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    )}
                  </button>

                  {/* Icon */}
                  {getReminderIcon(reminder.icon)}

                  {/* Reminder details */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-[11px] font-medium truncate"
                      style={{
                        color: reminder.completed ? 'var(--nd-text-secondary)' : 'var(--nd-text-display)',
                        textDecoration: reminder.completed ? 'line-through' : 'none',
                      }}
                    >
                      {reminder.title}
                    </h3>
                  </div>

                  {reminder.time && (
                    <span className="flex items-center gap-0.5 font-mono text-[10px] shrink-0" style={{ color: 'var(--nd-text-secondary)' }}>
                      <Clock className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                      {formatTime12(reminder.time)}
                    </span>
                  )}

                  {/* Delete button */}
                  <button
                    onClick={() => openDeleteReminderDialog(reminder.id)}
                    className="shrink-0 p-0.5 transition-colors duration-200"
                    style={{ color: 'var(--nd-text-secondary)' }}
                    aria-label="Delete reminder"
                  >
                    <Trash2 className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
                  </button>
                </div>
              </div>
              </SwipeableItem>
            ))}
          </div>
        )}
        </div>{/* end reminders mt-4 */}
      </div>
      )}

      {/* ── Floating Action Button with Quick Actions ── */}
      <div className="absolute bottom-3 right-5 z-10">
        {/* Quick Action Popup */}
        {showQuickActions && (
          <>
            {/* Backdrop to close popup */}
            <div
              className="fixed inset-0 z-[9]"
              onClick={() => setShowQuickActions(false)}
            />
            <div
              className="absolute bottom-16 right-0 z-10 flex flex-col gap-2 items-end animate-in fade-in-0 zoom-in-95 duration-150"
            >
              {/* Manual Task Option */}
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  resetForm();
                  setShowAddDialog(true);
                }}
                className="flex items-center gap-2 px-3 py-2 transition-colors duration-200 whitespace-nowrap"
                style={{
                  background: 'var(--nd-surface)',
                  color: 'var(--nd-text-primary)',
                  border: '1px solid var(--nd-border-visible)',
                  borderRadius: '999px',
                }}
              >
                <Plus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em]">Manual</span>
              </button>

              {/* SMART ADD Option */}
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  setAiDescription('');
                  setAiError('');
                  setShowAIDialog(true);
                }}
                className="flex items-center gap-2 px-3 py-2 transition-colors duration-200 whitespace-nowrap"
                style={{
                  background: 'var(--nd-surface)',
                  color: 'var(--nd-text-primary)',
                  border: '1px solid var(--nd-border-visible)',
                  borderRadius: '999px',
                }}
              >
                <DotmTriangle11 size={14} dotSize={2} speed={1.2} color="var(--nd-text-primary)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em]">SMART ADD</span>
              </button>
            </div>
          </>
        )}

        {/* Main FAB */}
        <button
          onClick={() => setShowQuickActions((prev) => !prev)}
          className="w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200"
          style={{
            background: showQuickActions ? 'var(--nd-surface)' : 'var(--nd-text-display)',
            color: showQuickActions ? 'var(--nd-text-display)' : 'var(--nd-black)',
            border: '1px solid var(--nd-border-visible)',
            transform: showQuickActions ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          aria-label="Add new task"
        >
          {showQuickActions ? (
            <X className="w-6 h-6" style={{ strokeWidth: 1.5 }} />
          ) : (
            <Plus className="w-6 h-6" style={{ strokeWidth: 1.5 }} />
          )}
        </button>
      </div>

      {/* Bottom Navigation is rendered at the app level in page.tsx */}

      {/* ── Add Task Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); resetForm(); } else { setShowAddDialog(true); } }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Add Task
            </DialogTitle>
            <DialogDescription
              className="font-mono text-[11px]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Create a new task for {selectedDateLabel}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-0.5 max-h-[55vh] overflow-y-auto scrollbar-hide">
            {/* Title */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title *
              </Label>
              <Input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Task title"
                className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description"
                className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Time & Location row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Time
                </Label>
                <Input
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  placeholder="3:00 PM"
                  className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Location
                </Label>
                <Input
                  value={formLocation}
                  onChange={(e) => setFormLocation(e.target.value)}
                  placeholder="Office"
                  className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Participants
              </Label>
              <Input
                value={formParticipants}
                onChange={(e) => setFormParticipants(e.target.value)}
                placeholder="Alex, Sarah"
                className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Category & Date row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Category
                </Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger
                    className="w-full font-mono text-xs h-9"
                    style={{
                      backgroundColor: 'var(--nd-black)',
                      border: '1px solid var(--nd-border)',
                      borderRadius: '8px',
                      color: 'var(--nd-text-display)',
                    }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent
                    style={{
                      backgroundColor: 'var(--nd-surface)',
                      border: '1px solid var(--nd-border-visible)',
                    }}
                  >
                    {CATEGORIES.map((cat) => (
                      <SelectItem
                        key={cat}
                        value={cat}
                        style={{ color: 'var(--nd-text-primary)' }}
                      >
                        <span className="flex items-center gap-2">
                          {getCategoryIcon(cat)}
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Date
                </Label>
                <Input
                  value={selectedDateStr}
                  readOnly
                  className="font-mono text-xs h-9"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-secondary)',
                    opacity: 0.7,
                    cursor: 'not-allowed',
                  }}
                />
              </div>
            </div>

            {/* Priority selector */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Priority
              </Label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => {
                  const isActive = formPriority === p;
                  const color = getPriorityColor(p);
                  const label = p.charAt(0).toUpperCase() + p.slice(1);
                  const dot = p === 'high' ? '\uD83D\uDD34' : p === 'medium' ? '\uD83D\uDFE1' : '\uD83D\uDFE2';
                  return (
                    <button
                      key={p}
                      onClick={() => setFormPriority(p)}
                      className="flex-1 py-2 font-mono text-[10px] uppercase tracking-[0.06em] transition-all duration-200"
                      style={{
                        background: isActive ? 'var(--nd-surface)' : 'transparent',
                        color: isActive ? color : 'var(--nd-text-secondary)',
                        border: isActive ? `1px solid ${color}` : '1px solid var(--nd-border-visible)',
                        borderRadius: '8px',
                      }}
                    >
                      {dot} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Tags
              </Label>
              <TagInput
                tags={formTags}
                onChange={setFormTags}
                suggestedTags={SUGGESTED_TAGS}
              />
            </div>

            {/* Depends On — dependency multi-select */}
            {availableDepTasks.length > 0 && (
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Depends On
                </Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {formDependsOn.map(depId => {
                    const depTask = availableDepTasks.find(t => t.id === depId);
                    if (!depTask) return null;
                    return (
                      <span
                        key={depId}
                        className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px]"
                        style={{
                          background: 'var(--nd-surface)',
                          color: 'var(--nd-text-primary)',
                          border: '1px solid var(--nd-border-visible)',
                          borderRadius: '999px',
                        }}
                      >
                        <Link2 className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                        {depTask.title}
                        <button
                          onClick={() => setFormDependsOn(prev => prev.filter(id => id !== depId))}
                          className="ml-0.5"
                          style={{ color: 'var(--nd-text-disabled)' }}
                          aria-label={`Remove dependency: ${depTask.title}`}
                        >
                          <X className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !formDependsOn.includes(val)) {
                      setFormDependsOn(prev => [...prev, val]);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-secondary)',
                  }}
                >
                  <option value="">Select a task...</option>
                  {availableDepTasks
                    .filter(t => !formDependsOn.includes(t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))
                  }
                </select>
              </div>
            )}

            {/* Smart Scheduling suggestion */}
            <SmartSchedulingPanel
              category={formCategory}
              moods={moods}
              existingTasks={tasks}
              onApplySuggestion={handleApplySuggestionAdd}
            />
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => setShowAddDialog(false)}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-primary)',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAddTask}
              disabled={addingTask || !formTitle.trim()}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {addingTask ? '[ADDING...]' : 'Add Task'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Task Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Edit Task
            </DialogTitle>
            <DialogDescription
              className="font-mono text-[11px]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Update task details
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-0.5 max-h-[55vh] overflow-y-auto scrollbar-hide">
            {/* Title */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title *
              </Label>
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Task title"
                className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Brief description"
                className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Time & Location row */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Time
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min="1"
                    max="12"
                    value={editHour}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 12)) {
                        setEditHour(v);
                      }
                    }}
                    placeholder="Hr"
                    className="font-mono text-xs h-9 w-14 text-center placeholder:text-[var(--nd-text-disabled)]"
                    style={{
                      backgroundColor: 'var(--nd-black)',
                      border: '1px solid var(--nd-border)',
                      borderRadius: '8px',
                      color: 'var(--nd-text-display)',
                    }}
                  />
                  <span className="font-mono text-xs" style={{ color: 'var(--nd-text-secondary)' }}>:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={editMinute}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= 59)) {
                        setEditMinute(v);
                      }
                    }}
                    placeholder="Min"
                    className="font-mono text-xs h-9 w-14 text-center placeholder:text-[var(--nd-text-disabled)]"
                    style={{
                      backgroundColor: 'var(--nd-black)',
                      border: '1px solid var(--nd-border)',
                      borderRadius: '8px',
                      color: 'var(--nd-text-display)',
                    }}
                  />
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => setEditAmPm('AM')}
                      className="px-1.5 py-0 font-mono text-[9px] uppercase tracking-[0.04em] transition-all duration-200"
                      style={{
                        background: editAmPm === 'AM' ? 'var(--nd-text-display)' : 'transparent',
                        color: editAmPm === 'AM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                        border: editAmPm === 'AM' ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                        borderRadius: '4px',
                        lineHeight: '16px',
                      }}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAmPm('PM')}
                      className="px-1.5 py-0 font-mono text-[9px] uppercase tracking-[0.04em] transition-all duration-200"
                      style={{
                        background: editAmPm === 'PM' ? 'var(--nd-text-display)' : 'transparent',
                        color: editAmPm === 'PM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                        border: editAmPm === 'PM' ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                        borderRadius: '4px',
                        lineHeight: '16px',
                      }}
                    >
                      PM
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Location
                </Label>
                <Input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="Office"
                  className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
              </div>
            </div>

            {/* Participants */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Participants
              </Label>
              <Input
                value={editParticipants}
                onChange={(e) => setEditParticipants(e.target.value)}
                placeholder="Alex, Sarah"
                className="font-mono text-xs h-9 placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Category */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Category
              </Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger
                  className="w-full font-mono text-xs h-9"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <SelectItem
                      key={cat}
                      value={cat}
                      style={{ color: 'var(--nd-text-primary)' }}
                    >
                      <span className="flex items-center gap-2">
                        {getCategoryIcon(cat)}
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority selector */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Priority
              </Label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => {
                  const isActive = editPriority === p;
                  const color = getPriorityColor(p);
                  const label = p.charAt(0).toUpperCase() + p.slice(1);
                  const dot = p === 'high' ? '\uD83D\uDD34' : p === 'medium' ? '\uD83D\uDFE1' : '\uD83D\uDFE2';
                  return (
                    <button
                      key={p}
                      onClick={() => setEditPriority(p)}
                      className="flex-1 py-2 font-mono text-[10px] uppercase tracking-[0.06em] transition-all duration-200"
                      style={{
                        background: isActive ? 'var(--nd-surface)' : 'transparent',
                        color: isActive ? color : 'var(--nd-text-secondary)',
                        border: isActive ? `1px solid ${color}` : '1px solid var(--nd-border-visible)',
                        borderRadius: '8px',
                      }}
                    >
                      {dot} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Tags
              </Label>
              <TagInput
                tags={editTags}
                onChange={setEditTags}
                suggestedTags={SUGGESTED_TAGS}
              />
            </div>

            {/* Depends On — dependency multi-select */}
            {availableDepTasks.filter(t => t.id !== editTask?.id).length > 0 && (
              <div className="space-y-1">
                <Label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Depends On
                </Label>
                <div className="flex flex-wrap gap-1 mb-1">
                  {editDependsOn.map(depId => {
                    const depTask = tasks.find(t => t.id === depId);
                    if (!depTask) return null;
                    return (
                      <span
                        key={depId}
                        className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px]"
                        style={{
                          background: 'var(--nd-surface)',
                          color: 'var(--nd-text-primary)',
                          border: '1px solid var(--nd-border-visible)',
                          borderRadius: '999px',
                        }}
                      >
                        <Link2 className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                        {depTask.title}
                        <button
                          onClick={() => setEditDependsOn(prev => prev.filter(id => id !== depId))}
                          className="ml-0.5"
                          style={{ color: 'var(--nd-text-disabled)' }}
                          aria-label={`Remove dependency: ${depTask.title}`}
                        >
                          <X className="w-2.5 h-2.5" style={{ strokeWidth: 1.5 }} />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <select
                  value=""
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val && !editDependsOn.includes(val) && val !== editTask?.id) {
                      setEditDependsOn(prev => [...prev, val]);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-secondary)',
                  }}
                >
                  <option value="">Select a task...</option>
                  {availableDepTasks
                    .filter(t => t.id !== editTask?.id && !editDependsOn.includes(t.id))
                    .map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))
                  }
                </select>
              </div>
            )}

            {/* Smart Scheduling suggestion */}
            <SmartSchedulingPanel
              category={editCategory}
              moods={moods}
              existingTasks={tasks}
              onApplySuggestion={handleApplySuggestionEdit}
            />

            {/* Saving status */}
            {editSaving && (
              <div className="flex items-center gap-2">
                <DotmTriangle11 size={16} color="var(--nd-text-secondary)" speed={2} />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  [SAVING...]
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={closeEditDialog}
              disabled={editSaving}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-primary)',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleEditTask}
              disabled={editSaving || !editTitle.trim()}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {editSaving ? '[SAVING...]' : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SMART ADD Dialog ── */}
      <Dialog open={showAIDialog} onOpenChange={(open) => { if (!open) { setShowAIDialog(false); setAiDescription(''); setAiError(''); setAiPriority('medium'); } else { setShowAIDialog(true); } }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              SMART ADD
            </DialogTitle>
            <DialogDescription
              className="font-mono text-[11px]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Describe your task in natural language
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <textarea
              value={aiDescription}
              onChange={(e) => {
                setAiDescription(e.target.value);
                setAiError('');
              }}
              placeholder='e.g. "Meeting with John at 3pm about project review"'
              rows={3}
              className="w-full resize-none font-mono text-xs placeholder:text-[var(--nd-text-disabled)] focus:outline-none focus:ring-0 p-2.5"
              style={{
                backgroundColor: 'var(--nd-black)',
                border: '1px solid var(--nd-border)',
                borderRadius: '8px',
                color: 'var(--nd-text-display)',
              }}
              disabled={aiCreating}
            />

            {/* Priority selector for AI task */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Priority
              </label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => {
                  const isActive = aiPriority === p;
                  const color = getPriorityColor(p);
                  const label = p.charAt(0).toUpperCase() + p.slice(1);
                  const dot = p === 'high' ? '\uD83D\uDD34' : p === 'medium' ? '\uD83D\uDFE1' : '\uD83D\uDFE2';
                  return (
                    <button
                      key={p}
                      onClick={() => setAiPriority(p)}
                      className="flex-1 py-2 font-mono text-[10px] uppercase tracking-[0.06em] transition-all duration-200"
                      style={{
                        background: isActive ? 'var(--nd-surface)' : 'transparent',
                        color: isActive ? color : 'var(--nd-text-secondary)',
                        border: isActive ? `1px solid ${color}` : '1px solid var(--nd-border-visible)',
                        borderRadius: '8px',
                      }}
                    >
                      {dot} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Inline status */}
            {aiCreating && (
              <div className="flex items-center gap-2">
                <DotmTriangle11 size={16} color="var(--nd-text-secondary)" speed={2} />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  [PARSING...]
                </span>
              </div>
            )}

            {aiError && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-accent)' }}
              >
                [ERROR: {aiError}]
              </span>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => {
                setShowAIDialog(false);
                setAiDescription('');
                setAiError('');
              }}
              disabled={aiCreating}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-primary)',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAITaskCreate}
              disabled={aiCreating || !aiDescription.trim()}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {aiCreating ? '[CREATING...]' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Task Confirmation Dialog ── */}
      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete Task?"
        description="This task will be permanently removed."
        confirmLabel={deletingTask ? 'Deleting...' : 'Delete'}
        variant="danger"
        icon="delete"
        onConfirm={handleDeleteTask}
      />

      {/* ── SMART REMINDER Dialog ── */}
      <Dialog open={showAIReminderDialog} onOpenChange={(open) => { if (!open) { setShowAIReminderDialog(false); setAiReminderDescription(''); setAiReminderError(''); setAiReminderRecurring(''); setAiReminderRecurringEndDate(''); } else { setShowAIReminderDialog(true); } }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              SMART REMINDER
            </DialogTitle>
            <DialogDescription
              className="font-mono text-[11px]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Describe your reminder in natural language
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1">
            <textarea
              value={aiReminderDescription}
              onChange={(e) => {
                setAiReminderDescription(e.target.value);
                setAiReminderError('');
              }}
              placeholder='e.g. "Remind me to take medicine every day at 8am for 30 days"'
              rows={3}
              className="w-full resize-none font-mono text-xs placeholder:text-[var(--nd-text-disabled)] focus:outline-none focus:ring-0 p-2.5"
              style={{
                backgroundColor: 'var(--nd-black)',
                border: '1px solid var(--nd-border)',
                borderRadius: '8px',
                color: 'var(--nd-text-display)',
              }}
              disabled={aiReminderCreating}
            />

            {/* Recurring Pattern */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Repeat
              </label>
              <select
                value={aiReminderRecurring}
                onChange={(e) => setAiReminderRecurring(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                  colorScheme: 'dark',
                }}
                disabled={aiReminderCreating}
              >
                <option value="">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Recurring End Date — visible when recurring is set */}
            {aiReminderRecurring && (
              <div>
                <label
                  className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  End Date <span style={{ color: 'var(--nd-text-disabled)' }}>(optional)</span>
                </label>
                <input
                  type="date"
                  value={aiReminderRecurringEndDate}
                  onChange={(e) => setAiReminderRecurringEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                    colorScheme: 'dark',
                  }}
                  disabled={aiReminderCreating}
                />
              </div>
            )}

            {/* Inline status */}
            {aiReminderCreating && (
              <div className="flex items-center gap-2">
                <DotmTriangle11 size={16} color="var(--nd-text-secondary)" speed={2} />
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  [PARSING...]
                </span>
              </div>
            )}

            {aiReminderError && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-accent)' }}
              >
                [ERROR: {aiReminderError}]
              </span>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => {
                setShowAIReminderDialog(false);
                setAiReminderDescription('');
                setAiReminderError('');
                setAiReminderRecurring('');
                setAiReminderRecurringEndDate('');
              }}
              disabled={aiReminderCreating}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-primary)',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleAIReminderCreate}
              disabled={aiReminderCreating || !aiReminderDescription.trim()}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {aiReminderCreating ? '[CREATING...]' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Reminder Confirmation Dialog ── */}
      <ConfirmDialog
        open={showDeleteReminderDialog}
        onOpenChange={setShowDeleteReminderDialog}
        title="Delete Reminder?"
        description="This reminder will be permanently removed."
        confirmLabel={deletingReminder ? 'Deleting...' : 'Delete'}
        variant="danger"
        icon="delete"
        onConfirm={handleDeleteReminder}
      />

      {/* ── Reschedule Task Dialog ── */}
      <Dialog open={showRescheduleDialog} onOpenChange={(open) => { if (!open) { setShowRescheduleDialog(false); setRescheduleTask(null); setRescheduleDate(''); setRescheduleTime(''); } else { setShowRescheduleDialog(true); } }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Reschedule
            </DialogTitle>
            <DialogDescription
              className="font-mono text-[11px]"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Pick a new date and time for this task
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-1">
            {/* Task title (readonly) */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Task
              </Label>
              <div
                className="font-mono text-xs h-9 px-3 flex items-center"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-secondary)',
                  opacity: 0.7,
                }}
              >
                {rescheduleTask?.title || ''}
              </div>
            </div>

            {/* New date picker */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                New Date
              </Label>
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="font-mono text-xs h-9"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                  colorScheme: 'dark',
                }}
              />
            </div>

            {/* New time input */}
            <div className="space-y-1">
              <Label
                className="font-mono text-[10px] uppercase tracking-[0.08em]"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                New Time
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min="1"
                  max="12"
                  value={rescheduleHour}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 12)) {
                      setRescheduleHour(v);
                    }
                  }}
                  placeholder="Hr"
                  className="font-mono text-xs h-9 w-14 text-center placeholder:text-[var(--nd-text-disabled)]"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
                <span className="font-mono text-xs" style={{ color: 'var(--nd-text-secondary)' }}>:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={rescheduleMinute}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= 59)) {
                      setRescheduleMinute(v);
                    }
                  }}
                  placeholder="Min"
                  className="font-mono text-xs h-9 w-14 text-center placeholder:text-[var(--nd-text-disabled)]"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setRescheduleAmPm('AM')}
                    className="px-1.5 py-0 font-mono text-[9px] uppercase tracking-[0.04em] transition-all duration-200"
                    style={{
                      background: rescheduleAmPm === 'AM' ? 'var(--nd-text-display)' : 'transparent',
                      color: rescheduleAmPm === 'AM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: rescheduleAmPm === 'AM' ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                      borderRadius: '4px',
                      lineHeight: '16px',
                    }}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setRescheduleAmPm('PM')}
                    className="px-1.5 py-0 font-mono text-[9px] uppercase tracking-[0.04em] transition-all duration-200"
                    style={{
                      background: rescheduleAmPm === 'PM' ? 'var(--nd-text-display)' : 'transparent',
                      color: rescheduleAmPm === 'PM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: rescheduleAmPm === 'PM' ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                      borderRadius: '4px',
                      lineHeight: '16px',
                    }}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => {
                setShowRescheduleDialog(false);
                setRescheduleTask(null);
              }}
              disabled={rescheduling}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'transparent',
                color: 'var(--nd-text-primary)',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleReschedule}
              disabled={rescheduling || !rescheduleDate}
              className="flex-1 py-2 text-sm font-medium transition-colors duration-200 font-mono uppercase tracking-[0.08em] text-[11px] disabled:opacity-40"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {rescheduling ? '[SAVING...]' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
