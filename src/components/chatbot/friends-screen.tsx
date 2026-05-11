'use client';

import { useState, useCallback, useEffect } from 'react';
import { useOfflineReminders, useOfflineProfile, useOfflineSettings, useOfflineGoals, useOfflineHabits, useOfflineMoods } from '@/hooks/use-offline-data';
import { useAI } from '@/hooks/use-ai';
import type { OfflineReminder } from '@/lib/offline-db';
import { formatTime12, parseTime12 } from '@/lib/offline-db';
import SwipeableItem from '@/components/chatbot/swipeable-item';
import EmptyState from '@/components/chatbot/empty-state';
import {
  Search,
  Bell,
  Clock,
  Calendar,
  Plus,
  Circle,
  Trash2,
  Pencil,
  Repeat,
  X,
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
import ConfirmDialog from '@/components/chatbot/confirm-dialog';
import { playCompletionSound, playDeleteSound, hapticSuccess, hapticLight } from '@/lib/feedback';
import { scheduleAppReminder } from '@/lib/context-reminders';

/* ─── Types ─── */

interface FriendsScreenProps {
  onNavigate?: (page: string) => void;
  onOpenVoiceModal?: () => void;
}

type IconOption = 'clock' | 'bell' | 'calendar';

/* ─── Icon maps ─── */

const iconStyle = { color: 'var(--nd-text-secondary)', strokeWidth: 1.5 } as const;

const iconMap: Record<string, React.ReactNode> = {
  clock: <Clock className="w-4 h-4" style={iconStyle} />,
  bell: <Bell className="w-4 h-4" style={iconStyle} />,
  calendar: <Calendar className="w-4 h-4" style={iconStyle} />,
};

const iconOptions: { key: IconOption; icon: React.ReactNode; label: string }[] = [
  { key: 'clock', icon: <Clock className="w-5 h-5" style={{ strokeWidth: 1.5 }} />, label: 'Clock' },
  { key: 'bell', icon: <Bell className="w-5 h-5" style={{ strokeWidth: 1.5 }} />, label: 'Bell' },
  { key: 'calendar', icon: <Calendar className="w-5 h-5" style={{ strokeWidth: 1.5 }} />, label: 'Calendar' },
];

/* ─── Reminder Card Skeleton ─── */

function ReminderCardSkeleton() {
  return (
    <div
      className="py-3.5 flex items-center gap-3"
      style={{
        borderBottom: '1px solid var(--nd-border)',
        borderLeft: '2px solid var(--nd-border)',
        paddingLeft: '12px',
      }}
    >
      {/* Icon skeleton */}
      <div className="nd-skeleton w-9 h-9 rounded-full shrink-0" />
      {/* Text content skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="nd-skeleton h-4 w-3/5 rounded" />
        <div className="nd-skeleton h-3 w-2/5 rounded" />
      </div>
      {/* Actions skeleton */}
      <div className="nd-skeleton w-5 h-5 rounded-full shrink-0" />
    </div>
  );
}

/* ─── Inline Status ─── */

function InlineStatus({ type, message }: { type: 'loading' | 'saved' | 'error'; message?: string }) {
  if (type === 'loading') {
    return (
      <span
        className="font-mono text-[11px] uppercase tracking-[0.08em]"
        style={{ color: 'var(--nd-text-secondary)' }}
      >
        [LOADING...]
      </span>
    );
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

/* ─── Main Component ─── */

export default function FriendsScreen(_props: FriendsScreenProps) {
  const { reminders, loading, addReminder, updateReminder, deleteReminder, toggleReminderComplete, reload: reloadReminders } = useOfflineReminders();
  const { getEndpoint, getModelName, getApiKey } = useAI();

  // User context hooks for personalized AI
  const { profile } = useOfflineProfile();
  const { settings } = useOfflineSettings();
  const { goals } = useOfflineGoals();
  const { habits } = useOfflineHabits();
  const { moods } = useOfflineMoods();

  const getUserContext = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
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
  const [searchQuery, setSearchQuery] = useState('');

  // Inline status
  const [statusMessage, setStatusMessage] = useState<{ type: 'saved' | 'error'; message?: string } | null>(null);

  // Add Reminder dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addDescription, setAddDescription] = useState('');
  const [addTime, setAddTime] = useState('');
  const [addHour, setAddHour] = useState('');
  const [addMinute, setAddMinute] = useState('');
  const [addAmPm, setAddAmPm] = useState<'AM' | 'PM'>('AM');
  const [addIcon, setAddIcon] = useState<IconOption>('bell');
  const [addRecurring, setAddRecurring] = useState('');
  const [addRecurringEndDate, setAddRecurringEndDate] = useState('');

  // Clear recurringEndDate when recurring is set to One-time
  const handleAddRecurringChange = useCallback((value: string) => {
    setAddRecurring(value);
    if (!value) setAddRecurringEndDate('');
  }, []);
  const [adding, setAdding] = useState(false);

  // AI Reminder dialog state
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiDescription, setAiDescription] = useState('');
  const [aiCreating, setAiCreating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Edit Reminder dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<typeof reminders[number] | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editHour, setEditHour] = useState('');
  const [editMinute, setEditMinute] = useState('');
  const [editAmPm, setEditAmPm] = useState<'AM' | 'PM'>('AM');
  const [editIcon, setEditIcon] = useState<IconOption>('bell');
  const [editRecurring, setEditRecurring] = useState('');
  const [editRecurringEndDate, setEditRecurringEndDate] = useState('');

  // Parse editTime into hour/minute/ampm components when dialog opens
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

  // Clear recurringEndDate when recurring is set to One-time
  const handleEditRecurringChange = useCallback((value: string) => {
    setEditRecurring(value);
    if (!value) setEditRecurringEndDate('');
  }, []);
  const [saving, setSaving] = useState(false);

  // Quick actions FAB state
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<typeof reminders[number] | null>(null);

  /* ── Helpers ── */

  const showStatus = useCallback((type: 'saved' | 'error', message?: string) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 2500);
  }, []);

  /* ── Toggle completion ── */

  const toggleReminder = async (id: string) => {
    const reminder = reminders.find((r) => r.id === id);
    if (!reminder) return;

    try {
      await toggleReminderComplete(id, reminder.completed);
      if (!reminder.completed) {
        playCompletionSound();
        hapticSuccess();
      } else {
        playDeleteSound();
        hapticLight();
      }
      showStatus('saved');
    } catch {
      showStatus('error', 'UPDATE FAILED');
    }
  };

  /* ── Add reminder ── */

  const handleAddReminder = async () => {
    if (!addTitle.trim()) return;

    // Build 24h time from picker components
    const h = parseInt(addHour) || 0;
    const m = parseInt(addMinute) || 0;
    let h24 = h;
    if (addAmPm === 'AM' && h === 12) h24 = 0;
    else if (addAmPm === 'PM' && h !== 12) h24 = h + 12;
    const builtTime = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    setAdding(true);
    try {
      await addReminder({
        title: addTitle.trim(),
        description: addDescription.trim(),
        time: builtTime,
        icon: addIcon,
        completed: false,
        recurring: addRecurring,
        recurringEndDate: addRecurring ? addRecurringEndDate : '', // Clear end date when not recurring
      });
      showStatus('saved');
      closeAddDialog();
    } catch {
      showStatus('error', 'ADD FAILED');
    } finally {
      setAdding(false);
    }
  };

  const closeAddDialog = () => {
    setShowAddDialog(false);
    setAddTitle('');
    setAddDescription('');
    setAddTime('');
    setAddHour('');
    setAddMinute('');
    setAddAmPm('AM');
    setAddIcon('bell');
    setAddRecurring('');
    setAddRecurringEndDate('');
  };

  /* ── AI Create Reminder ── */

  const handleAIReminderCreate = async () => {
    if (!aiDescription.trim()) return;
    setAiCreating(true);
    setAiError('');
    try {
      const parseRes = await fetch('/api/ai/reminder-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiDescription.trim(), customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext: getUserContext() }),
      });
      if (!parseRes.ok) throw new Error('AI parsing failed');
      const parseData = await parseRes.json();
      const parsed = parseData.reminder;

      if (!parsed || typeof parsed !== 'object') throw new Error('AI returned invalid reminder data');

      await addReminder({
        title: parsed.title || 'New Reminder',
        description: parsed.description || '',
        time: parsed.time || '',
        icon: parsed.icon || 'bell',
        completed: false,
        recurring: parsed.recurring || '',
        recurringEndDate: parsed.recurringEndDate || '',
      });

      setShowAIDialog(false);
      setAiDescription('');
      showStatus('saved');
    } catch {
      setAiError('Failed to create reminder. Please try again.');
    } finally {
      setAiCreating(false);
    }
  };

  /* ── Delete reminder ── */

  const requestDelete = (reminder: typeof reminders[number]) => {
    setDeleteTarget(reminder);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;

    setShowDeleteConfirm(false);

    try {
      await deleteReminder(id);
      playDeleteSound();
      hapticLight();
      showStatus('saved');
    } catch {
      showStatus('error', 'DELETE FAILED');
    } finally {
      setDeleteTarget(null);
    }
  };

  /* ── Edit reminder ── */

  const openEditDialog = (reminder: typeof reminders[number]) => {
    setEditTarget(reminder);
    setEditTitle(reminder.title);
    setEditDescription(reminder.description);
    setEditTime(reminder.time);
    setEditIcon((reminder.icon as IconOption) || 'bell');
    setEditRecurring(reminder.recurring || '');
    setEditRecurringEndDate(reminder.recurringEndDate || '');
    setShowEditDialog(true);
  };

  const handleEditReminder = async () => {
    if (!editTarget || !editTitle.trim()) return;

    // Build 24h time from picker components
    const h = parseInt(editHour) || 0;
    const m = parseInt(editMinute) || 0;
    let h24 = h;
    if (editAmPm === 'AM' && h === 12) h24 = 0;
    else if (editAmPm === 'PM' && h !== 12) h24 = h + 12;
    const builtTime = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    setSaving(true);
    try {
      await updateReminder(editTarget.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        time: builtTime,
        icon: editIcon,
        recurring: editRecurring,
        recurringEndDate: editRecurring ? editRecurringEndDate : '', // Clear end date when not recurring
      });
      showStatus('saved');
      closeEditDialog();
    } catch {
      showStatus('error', 'UPDATE FAILED');
    } finally {
      setSaving(false);
    }
  };

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setEditTarget(null);
    setEditTitle('');
    setEditDescription('');
    setEditTime('');
    setEditHour('');
    setEditMinute('');
    setEditAmPm('AM');
    setEditIcon('bell');
    setEditRecurring('');
    setEditRecurringEndDate('');
  };

  /* ── Filtered lists ── */

  const upcomingReminders = reminders.filter((r) => !r.completed);
  const completedReminders = reminders.filter((r) => r.completed);

  const searchLower = searchQuery.toLowerCase();

  const filteredUpcoming = upcomingReminders.filter(
    (r) =>
      r.title.toLowerCase().includes(searchLower) ||
      (r.description || '').toLowerCase().includes(searchLower)
  );

  const filteredCompleted = completedReminders.filter(
    (r) =>
      r.title.toLowerCase().includes(searchLower) ||
      (r.description || '').toLowerCase().includes(searchLower)
  );

  /* ── Render ── */

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: 'var(--nd-black)' }}>
      {/* ── Header ── */}
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1
            className="font-mono text-sm uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-display)' }}
          >
            Alerts
          </h1>
          {statusMessage && <InlineStatus type={statusMessage.type} message={statusMessage.message} />}
        </div>

        {/* ── Search Bar — Underline style ── */}
        <div className="relative flex items-center">
          <Search
            className="absolute left-0 w-4 h-4"
            style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }}
          />
          <input
            type="text"
            placeholder="Search reminders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent pl-6 pb-2 text-sm font-mono placeholder:text-[var(--nd-text-disabled)] focus:outline-none"
            style={{
              color: 'var(--nd-text-primary)',
              borderBottom: '1px solid var(--nd-border-visible)',
            }}
          />
        </div>
      </div>

      {/* ── Reminders List ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-3 scrollbar-hide">
        {loading ? (
          <div className="space-y-0 py-2">
            <ReminderCardSkeleton />
            <ReminderCardSkeleton />
            <ReminderCardSkeleton />
          </div>
        ) : (
          <>
            {/* Upcoming Section */}
            <div className="min-h-[120px]">
              <h2
                className="font-mono text-[11px] uppercase tracking-[0.08em] mb-3 px-1"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                Upcoming
              </h2>
              {filteredUpcoming.length > 0 ? (
                <div className="space-y-0 max-h-[40vh] overflow-y-auto scrollbar-hide">
                  {filteredUpcoming.map((reminder) => (
                    <SwipeableItem
                      key={reminder.id}
                      onSwipeRight={() => toggleReminder(reminder.id)}
                      onSwipeLeft={() => requestDelete(reminder)}
                      rightLabel={reminder.completed ? 'REOPEN' : 'DONE'}
                    >
                      <ReminderItem
                        reminder={reminder}
                        onToggle={toggleReminder}
                        onDelete={requestDelete}
                        onEdit={openEditDialog}
                      />
                    </SwipeableItem>
                  ))}
                </div>
              ) : (
                <EmptyState
                  type="reminders"
                  action={{ label: 'Add Reminder', onClick: () => setShowAddDialog(true) }}
                />
              )}
            </div>

            {/* Completed Section */}
            <div className="min-h-[100px]">
              <h2
                className="font-mono text-[11px] uppercase tracking-[0.08em] mb-3 px-1"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                Completed
              </h2>
              {filteredCompleted.length > 0 ? (
                <div className="space-y-0 max-h-[30vh] overflow-y-auto scrollbar-hide">
                  {filteredCompleted.map((reminder) => (
                    <SwipeableItem
                      key={reminder.id}
                      onSwipeRight={() => toggleReminder(reminder.id)}
                      onSwipeLeft={() => requestDelete(reminder)}
                      rightLabel={reminder.completed ? 'REOPEN' : 'DONE'}
                    >
                      <ReminderItem
                        reminder={reminder}
                        onToggle={toggleReminder}
                        onDelete={requestDelete}
                        onEdit={openEditDialog}
                      />
                    </SwipeableItem>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-4 min-h-[60px]">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-disabled)' }}>
                    No completed reminders
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Floating Action Button with Quick Actions ── */}
      <div className="absolute bottom-4 right-5 z-10">
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
              {/* Manual Reminder Option */}
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  closeAddDialog();
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

              {/* Remind Me Later Option */}
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  const msg = prompt('What should I remind you?');
                  if (msg && msg.trim()) {
                    scheduleAppReminder({
                      id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
                      message: msg.trim(),
                      triggeredAt: new Date().toISOString(),
                      screen: 'friends',
                    });
                    showStatus('saved', 'REMINDER SAVED');
                  }
                }}
                className="flex items-center gap-2 px-3 py-2 transition-colors duration-200 whitespace-nowrap"
                style={{
                  background: 'var(--nd-surface)',
                  color: 'var(--nd-text-primary)',
                  border: '1px solid var(--nd-border-visible)',
                  borderRadius: '999px',
                }}
              >
                <Bell className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em]">REMIND LATER</span>
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
          aria-label="Add new reminder"
        >
          {showQuickActions ? (
            <X className="w-6 h-6" style={{ strokeWidth: 1.5 }} />
          ) : (
            <Plus className="w-6 h-6" style={{ strokeWidth: 1.5 }} />
          )}
        </button>
      </div>

      {/* Bottom Navigation is rendered at the app level in page.tsx */}

      {/* ── Add Reminder Dialog ── */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) closeAddDialog(); }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
          showCloseButton={false}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-center"
              style={{ color: 'var(--nd-text-display)' }}
            >
              New Reminder
            </DialogTitle>
            <DialogDescription
              className="text-xs text-center"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Fill in the details for your reminder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {/* Title */}
            <div>
              <label
                htmlFor="add-title"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title <span style={{ color: 'var(--nd-accent)' }}>*</span>
              </label>
              <input
                id="add-title"
                type="text"
                placeholder="e.g. Take Medicine"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="add-description"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </label>
              <input
                id="add-description"
                type="text"
                placeholder="e.g. Vitamin D supplement"
                value={addDescription}
                onChange={(e) => setAddDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Time */}
            <div>
              <label
                htmlFor="add-time"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Time
              </label>
              <div id="add-time" className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="Hr"
                  value={addHour}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 12)) setAddHour(v);
                  }}
                  className="w-14 px-2 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)] text-center"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-primary)',
                  }}
                />
                <span className="font-mono text-xs" style={{ color: 'var(--nd-text-secondary)' }}>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="Min"
                  value={addMinute}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= 59)) setAddMinute(v);
                  }}
                  className="w-14 px-2 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)] text-center"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-primary)',
                  }}
                />
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => setAddAmPm('AM')}
                    className="px-2 py-1.5 text-[10px] font-mono uppercase h-9 transition-all duration-150 cursor-pointer"
                    style={{
                      background: addAmPm === 'AM' ? 'var(--nd-text-display)' : 'transparent',
                      color: addAmPm === 'AM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: '1px solid var(--nd-border-visible)',
                      borderRadius: '6px',
                    }}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddAmPm('PM')}
                    className="px-2 py-1.5 text-[10px] font-mono uppercase h-9 transition-all duration-150 cursor-pointer"
                    style={{
                      background: addAmPm === 'PM' ? 'var(--nd-text-display)' : 'transparent',
                      color: addAmPm === 'PM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: '1px solid var(--nd-border-visible)',
                      borderRadius: '6px',
                    }}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Icon Selector — 1px solid #333333 border circle, no filled background */}
            <div>
              <label
                htmlFor="add-icon"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1.5 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Icon
              </label>
              <div id="add-icon" className="flex gap-3">
                {iconOptions.map(({ key, icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAddIcon(key)}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer bg-transparent p-0"
                    style={{
                      backgroundColor: 'transparent',
                      border: addIcon === key
                        ? '2px solid var(--nd-text-display)'
                        : '1px solid var(--nd-border-visible)',
                      color: addIcon === key ? 'var(--nd-text-display)' : 'var(--nd-text-secondary)',
                    }}
                    aria-label={label}
                    aria-pressed={addIcon === key}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurring Pattern */}
            <div>
              <label
                htmlFor="add-recurring"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Repeat
              </label>
              <select
                id="add-recurring"
                value={addRecurring}
                onChange={(e) => handleAddRecurringChange(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              >
                <option value="">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Recurring End Date — visible when recurring is set */}
            {addRecurring && (
              <div>
                <label
                  htmlFor="add-recurring-end-date"
                  className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  End Date <span style={{ color: 'var(--nd-text-disabled)' }}>(optional)</span>
                </label>
                <input
                  id="add-recurring-end-date"
                  type="date"
                  value={addRecurringEndDate}
                  onChange={(e) => setAddRecurringEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              type="button"
              onClick={closeAddDialog}
              className="flex-1 py-2 text-sm font-medium transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
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
              type="button"
              onClick={handleAddReminder}
              disabled={adding || !addTitle.trim()}
              className="flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {adding ? '[ADDING...]' : 'Add Reminder'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Reminder Dialog ── */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
          showCloseButton={false}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-center"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Edit Reminder
            </DialogTitle>
            <DialogDescription
              className="text-xs text-center"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Update the details for your reminder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {/* Title */}
            <div>
              <label
                htmlFor="edit-title"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title <span style={{ color: 'var(--nd-accent)' }}>*</span>
              </label>
              <input
                id="edit-title"
                type="text"
                placeholder="e.g. Take Medicine"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="edit-description"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </label>
              <input
                id="edit-description"
                type="text"
                placeholder="e.g. Vitamin D supplement"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              />
            </div>

            {/* Time */}
            <div>
              <label
                htmlFor="edit-time"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Time
              </label>
              <div id="edit-time" className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={12}
                  placeholder="Hr"
                  value={editHour}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || (parseInt(v) >= 1 && parseInt(v) <= 12)) setEditHour(v);
                  }}
                  className="w-14 px-2 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)] text-center"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-primary)',
                  }}
                />
                <span className="font-mono text-xs" style={{ color: 'var(--nd-text-secondary)' }}>:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  placeholder="Min"
                  value={editMinute}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || (parseInt(v) >= 0 && parseInt(v) <= 59)) setEditMinute(v);
                  }}
                  className="w-14 px-2 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)] text-center"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-primary)',
                  }}
                />
                <div className="flex gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditAmPm('AM')}
                    className="px-2 py-1.5 text-[10px] font-mono uppercase h-9 transition-all duration-150 cursor-pointer"
                    style={{
                      background: editAmPm === 'AM' ? 'var(--nd-text-display)' : 'transparent',
                      color: editAmPm === 'AM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: '1px solid var(--nd-border-visible)',
                      borderRadius: '6px',
                    }}
                  >
                    AM
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAmPm('PM')}
                    className="px-2 py-1.5 text-[10px] font-mono uppercase h-9 transition-all duration-150 cursor-pointer"
                    style={{
                      background: editAmPm === 'PM' ? 'var(--nd-text-display)' : 'transparent',
                      color: editAmPm === 'PM' ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: '1px solid var(--nd-border-visible)',
                      borderRadius: '6px',
                    }}
                  >
                    PM
                  </button>
                </div>
              </div>
            </div>

            {/* Icon Selector */}
            <div>
              <label
                htmlFor="edit-icon"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1.5 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Icon
              </label>
              <div id="edit-icon" className="flex gap-3">
                {iconOptions.map(({ key, icon, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEditIcon(key)}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer bg-transparent p-0"
                    style={{
                      backgroundColor: 'transparent',
                      border: editIcon === key
                        ? '2px solid var(--nd-text-display)'
                        : '1px solid var(--nd-border-visible)',
                      color: editIcon === key ? 'var(--nd-text-display)' : 'var(--nd-text-secondary)',
                    }}
                    aria-label={label}
                    aria-pressed={editIcon === key}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            {/* Recurring Pattern */}
            <div>
              <label
                htmlFor="edit-recurring"
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Repeat
              </label>
              <select
                id="edit-recurring"
                value={editRecurring}
                onChange={(e) => handleEditRecurringChange(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
              >
                <option value="">One-time</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {/* Recurring End Date — visible when recurring is set */}
            {editRecurring && (
              <div>
                <label
                  htmlFor="edit-recurring-end-date"
                  className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  End Date <span style={{ color: 'var(--nd-text-disabled)' }}>(optional)</span>
                </label>
                <input
                  id="edit-recurring-end-date"
                  type="date"
                  value={editRecurringEndDate}
                  onChange={(e) => setEditRecurringEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    color: 'var(--nd-text-display)',
                  }}
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              type="button"
              onClick={closeEditDialog}
              className="flex-1 py-2 text-sm font-medium transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
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
              type="button"
              onClick={handleEditReminder}
              disabled={saving || !editTitle.trim()}
              className="flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {saving ? '[SAVING...]' : 'Save Changes'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Reminder?"
        description="This reminder will be permanently removed."
        confirmLabel="Delete"
        variant="danger"
        icon="delete"
        onConfirm={handleDelete}
      />

      {/* ── AI Create Reminder Dialog ── */}
      <Dialog open={showAIDialog} onOpenChange={(open) => { if (!open) { setShowAIDialog(false); setAiDescription(''); setAiError(''); } }}>
        <DialogContent
          className="border-0 max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '16px',
          }}
          showCloseButton={false}
        >
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em] text-center flex items-center justify-center gap-2"
              style={{ color: 'var(--nd-text-display)' }}
            >
              <DotmTriangle11 size={14} dotSize={2} speed={1.2} color="var(--nd-text-display)" bloom opacityBase={0.1} opacityMid={0.4} opacityPeak={0.95} />
              SMART CREATE
            </DialogTitle>
            <DialogDescription
              className="text-xs text-center"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Describe your reminder in natural language and AI will structure it for you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-1">
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description <span style={{ color: 'var(--nd-accent)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder='e.g. "Remind me to call the dentist tomorrow at 3pm"'
                value={aiDescription}
                onChange={(e) => { setAiDescription(e.target.value); setAiError(''); }}
                className="w-full px-3 py-2 text-xs font-mono h-9 focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={{
                  backgroundColor: 'var(--nd-black)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '8px',
                  color: 'var(--nd-text-display)',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && aiDescription.trim() && !aiCreating) {
                    handleAIReminderCreate();
                  }
                }}
              />
            </div>
            {aiError && (
              <p className="font-mono text-[10px] uppercase tracking-[0.06em]" style={{ color: 'var(--nd-accent)' }}>
                {aiError}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              type="button"
              onClick={() => { setShowAIDialog(false); setAiDescription(''); setAiError(''); }}
              className="flex-1 py-2 text-sm font-medium transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
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
              type="button"
              onClick={handleAIReminderCreate}
              disabled={aiCreating || !aiDescription.trim()}
              className="flex-1 py-2 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-40 transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {aiCreating ? '[CREATING...]' : 'SMART CREATE'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Reminder Item Component ─── */

function ReminderItem({
  reminder,
  onToggle,
  onDelete,
  onEdit,
}: {
  reminder: OfflineReminder;
  onToggle: (id: string) => void;
  onDelete: (reminder: OfflineReminder) => void;
  onEdit: (reminder: OfflineReminder) => void;
}) {
  return (
    <div
      className="py-2 flex items-center gap-2 transition-all duration-200 group"
      style={{
        borderBottom: '1px solid var(--nd-border)',
        borderLeft: reminder.completed
          ? '2px solid var(--nd-border-visible)'
          : '2px solid var(--nd-text-display)',
        opacity: reminder.completed ? 0.55 : 1,
        paddingLeft: '10px',
      }}
    >
      {/* Icon container — compact */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
        style={{ border: '1px solid var(--nd-border-visible)' }}
      >
        {iconMap[reminder.icon]}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <h3
          className="text-xs font-medium truncate"
          style={{
            color: reminder.completed ? 'var(--nd-text-secondary)' : 'var(--nd-text-display)',
            textDecoration: reminder.completed ? 'line-through' : 'none',
          }}
        >
          {reminder.title}
        </h3>
        <div className="flex items-center gap-1.5 mt-0.5">
          {reminder.time && (
            <>
              <span className="font-mono text-[10px]" style={{ color: 'var(--nd-text-secondary)' }}>
                {formatTime12(reminder.time)}
              </span>
              <span style={{ color: 'var(--nd-text-disabled)' }}>&middot;</span>
            </>
          )}
          {reminder.recurring && reminder.recurring !== '' && (
            <>
              <span
                className="font-mono text-[9px] uppercase tracking-[0.04em] inline-flex items-center gap-0.5 px-1 py-0.5"
                style={{
                  color: 'var(--nd-text-primary)',
                  border: '1px solid var(--nd-border-visible)',
                  borderRadius: '3px',
                  background: 'var(--nd-surface)',
                }}
              >
                <Repeat className="w-2 h-2" style={{ strokeWidth: 1.5 }} />
                {reminder.recurring}
              </span>
              {reminder.recurringEndDate && (
                <span className="font-mono text-[9px]" style={{ color: 'var(--nd-text-disabled)' }}>
                  until {reminder.recurringEndDate}
                </span>
              )}
              <span style={{ color: 'var(--nd-text-disabled)' }}>&middot;</span>
            </>
          )}
          <span className="text-[10px] truncate" style={{ color: 'var(--nd-text-disabled)' }}>
            {reminder.description}
          </span>
        </div>
      </div>

      {/* Edit icon */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onEdit(reminder);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onEdit(reminder);
          }
        }}
        className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity duration-200 p-0.5 cursor-pointer"
        style={{ color: 'var(--nd-text-secondary)' }}
        aria-label="Edit reminder"
      >
        <Pencil className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
      </div>

      {/* Delete icon */}
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          onDelete(reminder);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onDelete(reminder);
          }
        }}
        className="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity duration-200 p-0.5 cursor-pointer"
        style={{ color: 'var(--nd-accent)' }}
        aria-label="Delete reminder"
      >
        <Trash2 className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
      </div>

      {/* Toggle checkbox */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(reminder.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onToggle(reminder.id);
        }}
        className="shrink-0 cursor-pointer"
        aria-label={reminder.completed ? 'Mark as incomplete' : 'Mark as complete'}
      >
        {reminder.completed ? (
          <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--nd-text-display)' }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--nd-black)' }} />
          </div>
        ) : (
          <Circle className="w-5 h-5" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
        )}
      </div>
    </div>
  );
}
