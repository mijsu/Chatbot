'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useTheme } from 'next-themes';
import {
  Bell,
  Moon,
  Lock,
  HelpCircle,
  LogOut,
  ChevronRight,
  MapPin,
  User,
  Shield,
  Info,
  Pencil,
  Globe,
  FileText,
  Eye,
  EyeOff,
  Check,
  Mail,
  ChevronDown,
  Trash2,
  Database,
  AlertTriangle,
  MessageSquare,
  Target,
  Flame,
  Plus,
  Minus,
  CalendarDays,
  TrendingUp,
  MoreVertical,
  Clock,
  RefreshCw,
  Pin,
  CheckCircle2,
  Download,
  Upload,
} from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import ApiConnectionSettings from '@/components/chatbot/api-connection-settings';
import { useApiConfig, getProviderPreset } from '@/lib/api-config';
import ConfirmDialog from '@/components/chatbot/confirm-dialog';
import { useOfflineProfile, useOfflineSettings, useOfflineTasks, useOfflineReminders, useOfflineConversations, useOfflineGoals, useOfflineHabits, useOfflineMoods, factoryReset } from '@/hooks/use-offline-data';
import {
  MOOD_GLYPHS,
  MOOD_STATUS_COLORS,
  MOOD_LABELS,
} from '@/components/chatbot/mood-glyphs';
import { setPassword, removePassword, verifyPassword, type OfflineGoal, type OfflineHabit, type OfflineMoodEntry } from '@/lib/offline-db';
import { exportAllData, importAllData } from '@/lib/data-export';
import AchievementShowcase from '@/components/chatbot/achievement-system';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface SettingsScreenProps {
  onNavigate: (page: string) => void;
  onLogout?: () => void;
  onOpenVoiceModal?: () => void;
  notificationPermission?: 'granted' | 'denied' | 'default' | 'unsupported';
  onRequestNotificationPermission?: () => Promise<'granted' | 'denied' | 'default' | 'unsupported'>;
  aiContent?: any;
}

const LANGUAGES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'zh', name: 'Chinese' },
];

const VOICE_TONES: { code: string; name: string; desc: string }[] = [
  { code: 'friendly', name: 'Friendly', desc: 'Warm, approachable, conversational' },
  { code: 'professional', name: 'Professional', desc: 'Clear, concise, business-like' },
  { code: 'fun', name: 'Fun', desc: 'Playful, creative, energetic' },
];

const GOAL_CATEGORIES: { code: string; name: string }[] = [
  { code: 'health', name: 'Health' },
  { code: 'career', name: 'Career' },
  { code: 'personal', name: 'Personal' },
  { code: 'social', name: 'Social' },
  { code: 'learning', name: 'Learning' },
];

const HABIT_FREQUENCIES: { code: string; name: string }[] = [
  { code: 'daily', name: 'Daily' },
  { code: 'weekly', name: 'Weekly' },
];

function getLanguageName(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? 'English';
}

function getVoiceToneName(code: string): string {
  return VOICE_TONES.find((t) => t.code === code)?.name ?? 'Friendly';
}

function getGoalCategoryName(code: string): string {
  return GOAL_CATEGORIES.find((c) => c.code === code)?.name ?? code;
}

function getHabitFrequencyName(code: string): string {
  return HABIT_FREQUENCIES.find((f) => f.code === code)?.name ?? code;
}

/* ------------------------------------------------------------------ */
/*  ToggleSwitch — nd-toggle style                                     */
/* ------------------------------------------------------------------ */
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="switch"
      aria-checked={checked}
      tabIndex={disabled ? -1 : 0}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer select-none'
      }`}
      style={{
        width: '38px',
        height: '20px',
        backgroundColor: checked ? 'var(--nd-text-display)' : 'var(--nd-border-visible)',
      }}
    >
      <span
        className="inline-block rounded-full transition-transform duration-200"
        style={{
          width: '14px',
          height: '14px',
          backgroundColor: checked ? 'var(--nd-black)' : 'var(--nd-text-disabled)',
          transform: checked ? 'translateX(20px)' : 'translateX(3px)',
          marginTop: '3px',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SettingItem — Nothing style                                        */
/* ------------------------------------------------------------------ */
function SettingItem({
  icon: Icon,
  label,
  description,
  toggle,
  checked,
  onChange,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties; strokeWidth?: number }>;
  label: string;
  description?: string;
  toggle?: boolean;
  checked?: boolean;
  onChange?: (value: boolean) => void;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        {/* Icon container — 1px solid #333333 border circle */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid var(--nd-border-visible)' }}
        >
          <Icon className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
        </div>
        <div className="text-left min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>{label}</p>
          {description && (
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
      </div>
      {toggle ? (
        <ToggleSwitch
          checked={checked || false}
          onChange={onChange || (() => {})}
          disabled={disabled}
        />
      ) : (
        <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
      )}
    </>
  );

  if (toggle) {
    return (
      <div
        className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
        style={{
          backgroundColor: 'var(--nd-surface)',
          border: '1px solid var(--nd-border)',
          borderRadius: '10px',
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className="w-full px-3 py-2.5 flex items-center justify-between text-left transition-colors duration-200"
      style={{
        backgroundColor: 'var(--nd-surface)',
        border: '1px solid var(--nd-border)',
        borderRadius: '10px',
      }}
    >
      {content}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SectionHeader — Space Mono ALL CAPS #666666                        */
/* ------------------------------------------------------------------ */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-mono text-[10px] uppercase tracking-[0.08em] px-1 mb-2"
      style={{ color: 'var(--nd-text-disabled)' }}
    >
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/*  FAQ Item — #000000 bg, 1px solid #222222, chevron in #999999       */
/* ------------------------------------------------------------------ */
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: 'var(--nd-black)',
        border: '1px solid var(--nd-border)',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-full flex items-center justify-between p-3.5 text-left"
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(!open);
          }
        }}
      >
        <p className="text-sm font-medium pr-2" style={{ color: 'var(--nd-text-display)' }}>{question}</p>
        <ChevronDown
          className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
          style={{
            color: 'var(--nd-text-secondary)',
            strokeWidth: 1.5,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>
      {open && (
        <div className="px-3.5 pb-3.5">
          <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-text-secondary)' }}>
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Status                                                      */
/* ------------------------------------------------------------------ */
function InlineStatus({ type, message }: { type: 'loading' | 'saved' | 'error'; message?: string }) {
  if (type === 'loading') {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
        [LOADING...]
      </span>
    );
  }
  if (type === 'saved') {
    return (
      <span className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-success)' }}>
        [SAVED]
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-accent)' }}>
      [ERROR: {message || 'FAILED'}]
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Mood Glyphs & Constants imported from mood-glyphs.tsx              */
/* ------------------------------------------------------------------ */

/* ── PWA Install Button ── */

function PWAInstallButton() {
  const { canInstall, isInstalled, promptInstall } = usePWAInstall();
  const [installing, setInstalling] = useState(false);

  if (isInstalled) {
    return (
      <div
        className="w-full px-3 py-2.5 flex items-center justify-between"
        style={{
          backgroundColor: 'var(--nd-surface)',
          border: '1px solid var(--nd-border)',
          borderRadius: '10px',
        }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ border: '1px solid var(--nd-border-visible)' }}
          >
            <Download className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
          </div>
          <div className="text-left min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>
              Install App
            </p>
            <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
              Installed — runs as standalone app
            </p>
          </div>
        </div>
        <Check className="w-4 h-4" style={{ color: 'var(--nd-success)', strokeWidth: 2 }} />
      </div>
    );
  }

  if (!canInstall) return null;

  return (
    <div
      className="w-full px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors duration-200 nd-focus-ring"
      style={{
        backgroundColor: 'var(--nd-surface)',
        border: '1px solid var(--nd-border-visible)',
        borderRadius: '10px',
      }}
      onClick={async () => {
        setInstalling(true);
        await promptInstall();
        setInstalling(false);
      }}
    >
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ border: '1px solid var(--nd-border-visible)' }}
        >
          <Download className="w-4 h-4" style={{ color: 'var(--nd-text-display)', strokeWidth: 1.5 }} />
        </div>
        <div className="text-left min-w-0">
          <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>
            Install App
          </p>
          <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
            Add to home screen for quick access
          </p>
        </div>
      </div>
      <span
        className="font-mono text-[9px] uppercase tracking-[0.06em] px-3 py-1 rounded-full flex-shrink-0 transition-colors duration-200"
        style={{
          color: 'var(--nd-black)',
          backgroundColor: 'var(--nd-text-display)',
          border: 'none',
          borderRadius: '999px',
        }}
      >
        {installing ? 'Installing...' : 'Install'}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main SettingsScreen component                                      */
/* ------------------------------------------------------------------ */
export default function SettingsScreen({
  onNavigate,
  onLogout,
  onOpenVoiceModal,
  notificationPermission,
  onRequestNotificationPermission,
  aiContent,
}: SettingsScreenProps) {
  /* ── AI-generated labels ── */
  const settingsAI = aiContent?.settings;
  const profileSectionLabel = settingsAI?.profileSectionLabel || 'PROFILE';
  const accountSectionLabel = settingsAI?.accountSectionLabel || 'ACCOUNT';
  const preferencesSectionLabel = settingsAI?.preferencesSectionLabel || 'PREFERENCES';
  const goalsSectionLabel = settingsAI?.goalsSectionLabel || 'GOALS';
  const habitsSectionLabel = settingsAI?.habitsSectionLabel || 'HABITS';
  const dataSectionLabel = settingsAI?.dataSectionLabel || 'DATA';
  const editProfileLabel = settingsAI?.editProfileLabel || 'Edit Profile';
  const aboutMePlaceholder = settingsAI?.aboutMePlaceholder || 'Tell Syntra about yourself so it can personalize your experience...';
  const moodHistoryLabel = settingsAI?.moodHistoryLabel || 'MOOD HISTORY';
  const noGoalsMessage = settingsAI?.noGoalsMessage || 'No goals yet. Add one to get started!';
  const noHabitsMessage = settingsAI?.noHabitsMessage || 'No habits yet. Start building streaks!';

  /* ── Theme ── */
  const { theme, setTheme } = useTheme();

  /* ── Settings state (via IndexedDB) ── */
  const { settings, loading: settingsLoading, updateSettings } = useOfflineSettings();

  /* ── Profile state (via IndexedDB) ── */
  const { profile, loading: profileLoading, updateProfile } = useOfflineProfile();

  /* ── Data hooks for data management ── */
  const { tasks, clearAllTasks, deleteCompletedTasks, deleteTodayTasks, deletePastTasks, reload: reloadTasks } = useOfflineTasks();
  const { reminders, clearAllReminders, deleteCompletedReminders, deleteRecurringReminders, deleteOneTimeReminders, reload: reloadReminders } = useOfflineReminders();
  const { conversations, clearAllConversations, deleteUnpinnedConversations, reload: reloadConversations } = useOfflineConversations();

  /* ── Goals & Habits hooks ── */
  const { goals, loading: goalsLoading, addGoal, updateGoal, deleteGoal } = useOfflineGoals();
  const { habits, loading: habitsLoading, addHabit, toggleHabitToday, deleteHabit } = useOfflineHabits();

  /* ── Moods hook ── */
  const { moods, loading: moodsLoading, addMood } = useOfflineMoods();

  /* ── Mood form state ── */
  const [showLogMood, setShowLogMood] = useState(false);
  const [moodType, setMoodType] = useState<string>('good');
  const [moodEnergy, setMoodEnergy] = useState(3);
  const [moodNote, setMoodNote] = useState('');
  const [moodSaving, setMoodSaving] = useState(false);

  /* ── API config ── */
  const apiConfig = useApiConfig();

  /* ── API Connection collapsible state ── */
  const [connectionExpanded, setConnectionExpanded] = useState(
    apiConfig.status !== 'connected',
  );

  /* ── Dialog states ── */
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showLanguage, setShowLanguage] = useState(false);
  const [showVoiceTone, setShowVoiceTone] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ── Data management states ── */
  const [showFactoryReset, setShowFactoryReset] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  /* ── Backup/Export states ── */
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  /* ── Unified data deletion confirm dialog ── */
  const [dataConfirm, setDataConfirm] = useState<{
    open: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    description: '',
    confirmLabel: 'Delete',
    onConfirm: async () => {},
  });

  const openDataConfirm = useCallback((
    title: string,
    description: string,
    confirmLabel: string,
    onConfirm: () => Promise<void>,
  ) => {
    setDataConfirm({ open: true, title, description, confirmLabel, onConfirm });
  }, []);

  const closeDataConfirm = useCallback(() => {
    setDataConfirm(prev => ({ ...prev, open: false }));
  }, []);

  /* ── Edit profile form ── */
  const [editName, setEditName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editAboutMe, setEditAboutMe] = useState('');
  const [editProfileSaving, setEditProfileSaving] = useState(false);

  /* ── Password form ── */
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  /* ── Language saving ── */
  const [languageSaving, setLanguageSaving] = useState(false);

  /* ── Voice tone saving ── */
  const [voiceToneSaving, setVoiceToneSaving] = useState(false);

  /* ── Goal form states ── */
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showEditGoal, setShowEditGoal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<OfflineGoal | null>(null);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDescription, setGoalDescription] = useState('');
  const [goalCategory, setGoalCategory] = useState('personal');
  const [goalProgress, setGoalProgress] = useState(0);
  const [goalSaving, setGoalSaving] = useState(false);
  const [showDeleteGoal, setShowDeleteGoal] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  /* ── Habit form states ── */
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [habitTitle, setHabitTitle] = useState('');
  const [habitDescription, setHabitDescription] = useState('');
  const [habitFrequency, setHabitFrequency] = useState('daily');
  const [habitSaving, setHabitSaving] = useState(false);
  const [showDeleteHabit, setShowDeleteHabit] = useState(false);
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);

  /* ── Inline status ── */
  const [statusMessage, setStatusMessage] = useState<{ type: 'saved' | 'error'; message?: string } | null>(null);

  const showStatus = useCallback((type: 'saved' | 'error', message?: string) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 2500);
  }, []);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Sync theme with settings                                        */
  /* ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!settingsLoading) {
      setTheme(settings.darkMode ? 'dark' : 'light');
    }
  }, [settings.darkMode, settingsLoading, setTheme]);

  /* ── Auto-collapse API section on connect, auto-expand on disconnect ── */
  const prevStatusRef = useRef(apiConfig.status);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = apiConfig.status;
    // Only auto-toggle on status change, not on initial mount
    if (prev !== apiConfig.status) {
      if (apiConfig.status === 'connected') {
        setConnectionExpanded(false);
      } else if (apiConfig.status === 'disconnected' || apiConfig.status === 'error') {
        setConnectionExpanded(true);
      }
    }
  }, [apiConfig.status]);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Toggle handler – persists via IndexedDB                          */
  /* ────────────────────────────────────────────────────────────────── */
  const handleToggle = useCallback(
    async (
      field: 'notifications' | 'darkMode' | 'privateMode' | 'locationServices' | 'deepContextMode',
      currentValue: boolean,
    ) => {
      const nextValue = !currentValue;
      if (field === 'darkMode') setTheme(nextValue ? 'dark' : 'light');
      try {
        await updateSettings({ [field]: nextValue });
        showStatus('saved');
      } catch {
        showStatus('error', 'SAVE FAILED');
      }
    },
    [updateSettings, setTheme, showStatus],
  );

  /* ────────────────────────────────────────────────────────────────── */
  /*  Edit profile handler                                            */
  /* ────────────────────────────────────────────────────────────────── */
  const handleOpenEditProfile = useCallback(() => {
    setEditName(profile.name);
    setEditStatus(profile.status);
    setEditAboutMe(profile.aboutMe || '');
    setShowEditProfile(true);
  }, [profile.name, profile.status, profile.aboutMe]);

  const handleSaveProfile = useCallback(async () => {
    const trimmedName = editName.trim();
    const trimmedStatus = editStatus.trim();
    const trimmedAboutMe = editAboutMe.trim();
    if (!trimmedName) {
      showStatus('error', 'NAME IS REQUIRED');
      return;
    }
    setEditProfileSaving(true);
    try {
      await updateProfile({ name: trimmedName, status: trimmedStatus, aboutMe: trimmedAboutMe });
      showStatus('saved');
      setShowEditProfile(false);
    } catch {
      showStatus('error', 'SAVE FAILED');
    } finally {
      setEditProfileSaving(false);
    }
  }, [editName, editStatus, editAboutMe, updateProfile, showStatus]);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Language handler                                                */
  /* ────────────────────────────────────────────────────────────────── */
  const handleSelectLanguage = useCallback(
    async (code: string) => {
      if (code === profile.language) return;
      setLanguageSaving(true);
      try {
        await updateProfile({ language: code });
        showStatus('saved');
        setShowLanguage(false);
      } catch {
        showStatus('error', 'LANGUAGE SAVE FAILED');
      } finally {
        setLanguageSaving(false);
      }
    },
    [profile.language, updateProfile, showStatus],
  );

  /* ────────────────────────────────────────────────────────────────── */
  /*  Voice Tone handler                                              */
  /* ────────────────────────────────────────────────────────────────── */
  const handleSelectVoiceTone = useCallback(
    async (code: string) => {
      if (code === settings.voiceTone) return;
      setVoiceToneSaving(true);
      try {
        await updateSettings({ voiceTone: code });
        showStatus('saved');
        setShowVoiceTone(false);
      } catch {
        showStatus('error', 'VOICE TONE SAVE FAILED');
      } finally {
        setVoiceToneSaving(false);
      }
    },
    [settings.voiceTone, updateSettings, showStatus],
  );

  /* ────────────────────────────────────────────────────────────────── */
  /*  Password handler                                                */
  /* ────────────────────────────────────────────────────────────────── */
  const handleSavePassword = useCallback(async () => {
    const hasExistingPassword = !!(settings.passwordHash && settings.passwordHash.length > 0);

    // If user has an existing password, verify current password
    if (hasExistingPassword) {
      if (!currentPassword) {
        showStatus('error', 'ENTER CURRENT PASSWORD');
        return;
      }
      const isCurrentValid = await verifyPassword(currentPassword, settings.passwordHash);
      if (!isCurrentValid) {
        showStatus('error', 'CURRENT PASSWORD WRONG');
        return;
      }
    }

    if (!newPassword) {
      showStatus('error', 'ENTER NEW PASSWORD');
      return;
    }
    if (newPassword.length < 4) {
      showStatus('error', 'PASSWORD TOO SHORT (MIN 4)');
      return;
    }
    if (newPassword !== confirmPassword) {
      showStatus('error', 'PASSWORDS DO NOT MATCH');
      return;
    }

    setPasswordSaving(true);
    try {
      await setPassword(newPassword);
      showStatus('saved');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setShowPassword(false);
    } catch {
      showStatus('error', 'PASSWORD SAVE FAILED');
    } finally {
      setPasswordSaving(false);
    }
  }, [currentPassword, newPassword, confirmPassword, settings.passwordHash, showStatus]);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Goal handlers                                                   */
  /* ────────────────────────────────────────────────────────────────── */
  const handleOpenAddGoal = useCallback(() => {
    setGoalTitle('');
    setGoalDescription('');
    setGoalCategory('personal');
    setGoalProgress(0);
    setShowAddGoal(true);
  }, []);

  const handleOpenEditGoal = useCallback((goal: OfflineGoal) => {
    setEditingGoal(goal);
    setGoalTitle(goal.title);
    setGoalDescription(goal.description);
    setGoalCategory(goal.category);
    setGoalProgress(goal.progress);
    setShowEditGoal(true);
  }, []);

  const handleSaveNewGoal = useCallback(async () => {
    const trimmedTitle = goalTitle.trim();
    if (!trimmedTitle) return;
    setGoalSaving(true);
    try {
      await addGoal({
        title: trimmedTitle,
        description: goalDescription.trim(),
        category: goalCategory,
        progress: goalProgress,
        completed: goalProgress >= 100,
      });
      showStatus('saved');
      setShowAddGoal(false);
      setGoalTitle('');
      setGoalDescription('');
      setGoalCategory('personal');
      setGoalProgress(0);
    } catch {
      showStatus('error', 'GOAL SAVE FAILED');
    } finally {
      setGoalSaving(false);
    }
  }, [goalTitle, goalDescription, goalCategory, goalProgress, addGoal, showStatus]);

  const handleSaveEditGoal = useCallback(async () => {
    if (!editingGoal) return;
    const trimmedTitle = goalTitle.trim();
    if (!trimmedTitle) return;
    setGoalSaving(true);
    try {
      await updateGoal(editingGoal.id, {
        title: trimmedTitle,
        description: goalDescription.trim(),
        category: goalCategory,
        progress: goalProgress,
        completed: goalProgress >= 100,
      });
      showStatus('saved');
      setShowEditGoal(false);
      setEditingGoal(null);
    } catch {
      showStatus('error', 'GOAL UPDATE FAILED');
    } finally {
      setGoalSaving(false);
    }
  }, [editingGoal, goalTitle, goalDescription, goalCategory, goalProgress, updateGoal, showStatus]);

  const handleDeleteGoal = useCallback(async () => {
    if (!deletingGoalId) return;
    try {
      await deleteGoal(deletingGoalId);
      showStatus('saved');
    } catch {
      showStatus('error', 'GOAL DELETE FAILED');
    } finally {
      setShowDeleteGoal(false);
      setDeletingGoalId(null);
      setShowEditGoal(false);
      setEditingGoal(null);
    }
  }, [deletingGoalId, deleteGoal, showStatus]);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Habit handlers                                                  */
  /* ────────────────────────────────────────────────────────────────── */
  const handleOpenAddHabit = useCallback(() => {
    setHabitTitle('');
    setHabitDescription('');
    setHabitFrequency('daily');
    setShowAddHabit(true);
  }, []);

  const handleSaveNewHabit = useCallback(async () => {
    const trimmedTitle = habitTitle.trim();
    if (!trimmedTitle) return;
    setHabitSaving(true);
    try {
      await addHabit({
        title: trimmedTitle,
        description: habitDescription.trim(),
        frequency: habitFrequency,
        streak: 0,
        lastCompletedDate: '',
        completionHistory: '',
      });
      showStatus('saved');
      setShowAddHabit(false);
      setHabitTitle('');
      setHabitDescription('');
      setHabitFrequency('daily');
    } catch {
      showStatus('error', 'HABIT SAVE FAILED');
    } finally {
      setHabitSaving(false);
    }
  }, [habitTitle, habitDescription, habitFrequency, addHabit, showStatus]);

  const handleDeleteHabit = useCallback(async () => {
    if (!deletingHabitId) return;
    try {
      await deleteHabit(deletingHabitId);
      showStatus('saved');
    } catch {
      showStatus('error', 'HABIT DELETE FAILED');
    } finally {
      setShowDeleteHabit(false);
      setDeletingHabitId(null);
    }
  }, [deletingHabitId, deleteHabit, showStatus]);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Mood handler                                                    */
  /* ────────────────────────────────────────────────────────────────── */
  const handleSaveMood = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    setMoodSaving(true);
    try {
      await addMood({
        mood: moodType,
        energy: moodEnergy,
        note: moodNote.trim(),
        date: today,
      });
      showStatus('saved');
      setShowLogMood(false);
      setMoodNote('');
    } catch {
      showStatus('error', 'MOOD SAVE FAILED');
    } finally {
      setMoodSaving(false);
    }
  }, [moodType, moodEnergy, moodNote, addMood, showStatus]);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Export / Import handlers                                        */
  /* ────────────────────────────────────────────────────────────────── */
  const handleExportData = useCallback(async () => {
    setExporting(true);
    try {
      const json = await exportAllData();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const date = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `syntra-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('saved');
    } catch {
      showStatus('error', 'EXPORT FAILED');
    } finally {
      setExporting(false);
    }
  }, [showStatus]);

  const handleImportData = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportStatus(null);
    try {
      const text = await file.text();
      const result = await importAllData(text);
      if (result.success) {
        setImportStatus({ type: 'success', message: result.message });
        showStatus('saved');
        // Reload all data hooks
        await reloadTasks();
        await reloadReminders();
        await reloadConversations();
      } else {
        setImportStatus({ type: 'error', message: result.message });
        showStatus('error', result.message);
      }
    } catch {
      setImportStatus({ type: 'error', message: 'Failed to read backup file' });
      showStatus('error', 'IMPORT FAILED');
    } finally {
      setImporting(false);
      // Reset file input so same file can be re-imported
      if (importInputRef.current) importInputRef.current.value = '';
    }
  }, [showStatus, reloadTasks, reloadReminders, reloadConversations]);

  /* ─── Nothing Design System dialog style ─── */
  const ndDialogStyle: React.CSSProperties = {
    backgroundColor: 'var(--nd-surface)',
    border: '1px solid var(--nd-border-visible)',
    borderRadius: '16px',
  };

  const ndInputStyle: React.CSSProperties = {
    backgroundColor: 'var(--nd-black)',
    border: '1px solid var(--nd-border)',
    borderRadius: '8px',
    color: 'var(--nd-text-display)',
  };

  /* ─── Category color mapping ─── */
  const categoryColors: Record<string, string> = {
    health: 'var(--nd-success)',
    career: 'var(--nd-warning)',
    personal: 'var(--nd-accent)',
    social: 'var(--nd-interactive)',
    learning: 'var(--nd-interactive)',
  };

  const frequencyColors: Record<string, string> = {
    daily: 'var(--nd-success)',
    weekly: 'var(--nd-warning)',
  };

  /* ─── Mood helpers ─── */
  const MOOD_NUMERIC_VALUES: Record<string, number> = { great: 5, good: 4, okay: 3, low: 2, bad: 1 };
  const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const last7DaysMoods = useMemo(() => {
    const today = new Date();
    const days: { date: string; dayAbbr: string; mood: OfflineMoodEntry | null; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = moods.find((m: OfflineMoodEntry) => m.date === dateStr) || null;
      days.push({
        date: dateStr,
        dayAbbr: DAY_ABBR[d.getDay()],
        mood: entry,
        isToday: i === 0,
      });
    }
    return days;
  }, [moods]);

  const moodStats = useMemo(() => {
    const weekMoods = last7DaysMoods.filter((d) => d.mood !== null);
    if (weekMoods.length === 0) return { avgMood: 0, avgEnergy: 0, streak: 0 };
    const avgMood = weekMoods.reduce((sum, d) => sum + (MOOD_NUMERIC_VALUES[d.mood!.mood] || 0), 0) / weekMoods.length;
    const avgEnergy = weekMoods.reduce((sum, d) => sum + (d.mood!.energy || 0), 0) / weekMoods.length;
    // Check-in streak: consecutive days ending today with mood entries
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      if (moods.some((m: OfflineMoodEntry) => m.date === dateStr)) {
        streak++;
      } else {
        break;
      }
    }
    return { avgMood: Math.round(avgMood * 10) / 10, avgEnergy: Math.round(avgEnergy * 10) / 10, streak };
  }, [last7DaysMoods, moods]);

  /* ─── Habit calendar helpers ─── */
  const getCalendarDays = useCallback((habit: OfflineHabit) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = today.toISOString().split('T')[0];
    const completedDates = habit.completionHistory ? habit.completionHistory.split(',').filter(Boolean) : [];
    const days: { date: string; day: number; isCompleted: boolean; isToday: boolean; isFuture: boolean; isEmpty: boolean }[] = [];
    // Padding for first day of week
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: '', day: 0, isCompleted: false, isToday: false, isFuture: false, isEmpty: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isFuture = dateStr > todayStr;
      days.push({
        date: dateStr,
        day: d,
        isCompleted: completedDates.includes(dateStr),
        isToday: dateStr === todayStr,
        isFuture,
        isEmpty: false,
      });
    }
    return { days, monthName: today.toLocaleString('default', { month: 'long', year: 'numeric' }) };
  }, []);

  /* ────────────────────────────────────────────────────────────────── */
  /*  Render                                                          */
  /* ────────────────────────────────────────────────────────────────── */

  /* ── Loading guard: show skeleton until initial data is available ── */
  if (settingsLoading && profileLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--nd-black)' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--nd-border-visible)', borderTopColor: 'transparent' }} />
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] mt-3" style={{ color: 'var(--nd-text-disabled)' }}>Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--nd-black)' }}>
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 pt-4 pb-2 scrollbar-hide">
        {/* ── Profile Card — #111111 bg, 1px solid #333333, 16px radius ── */}
        <div
          className="p-4"
          style={{
            backgroundColor: 'var(--nd-surface)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '12px',
          }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar — circle with 1px solid #333333 border, no gradient ring */}
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                border: '1px solid var(--nd-border-visible)',
                backgroundColor: 'var(--nd-surface)',
              }}
            >
              <User className="w-6 h-6" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
            </div>

            {/* Name + status */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-base truncate" style={{ color: profile.name ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)' }}>
                {profileLoading ? '[LOADING...]' : (profile.name || 'Tap to set name')}
              </p>
              <p className="text-[12px] mt-0.5 truncate" style={{ color: profile.status ? 'var(--nd-text-secondary)' : 'var(--nd-text-disabled)' }}>
                {profileLoading ? '' : (profile.status || 'Tap to set status')}
              </p>
            </div>
          </div>

          {/* About Me preview */}
          {!profileLoading && profile.aboutMe && profile.aboutMe.trim() && (
            <div className="mt-3">
              <p
                className="font-mono text-[9px] uppercase tracking-[0.08em] mb-1"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                {profileSectionLabel}
              </p>
              <p
                className="text-[12px] leading-[1.4] overflow-hidden"
                style={{
                  color: 'var(--nd-text-secondary)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {profile.aboutMe.trim()}
              </p>
            </div>
          )}

          {/* Edit Profile — Space Mono underline link */}
          <div
            role="button"
            tabIndex={0}
            className="mt-3 flex items-center gap-1.5 cursor-pointer"
            onClick={handleOpenEditProfile}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpenEditProfile();
              }
            }}
          >
            <Pencil className="w-3.5 h-3.5" style={{ color: 'var(--nd-text-primary)', strokeWidth: 1.5 }} />
            <span
              className="font-mono text-[11px] uppercase tracking-[0.08em] underline"
              style={{ color: 'var(--nd-text-primary)' }}
            >
              {editProfileLabel}
            </span>
          </div>

          {/* Inline status */}
          {statusMessage && (
            <div className="mt-3">
              <InlineStatus type={statusMessage.type} message={statusMessage.message} />
            </div>
          )}
        </div>

        {/* ── Achievements ── */}
        <AchievementShowcase />

        {/* ── Account ── */}
        <div>
          <SectionHeader>{accountSectionLabel}</SectionHeader>
          <div className="space-y-1.5">
            <SettingItem
              icon={Bell}
              label="Notifications"
              toggle
              checked={settings.notifications}
              onChange={(v) => handleToggle('notifications', settings.notifications)}
              disabled={settingsLoading}
            />
            {/* Notification Permission (Works with both Capacitor native & browser) */}
            {notificationPermission !== undefined && (
              <div
                className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '10px',
                }}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ border: '1px solid var(--nd-border-visible)' }}
                  >
                    <Bell className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  </div>
                  <div className="text-left min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>
                      Device Notifications
                    </p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                      {notificationPermission === 'granted'
                        ? 'Reminders & tasks will notify you'
                        : notificationPermission === 'denied'
                          ? 'Blocked — enable in device settings'
                          : notificationPermission === 'unsupported'
                            ? 'Not available on this device'
                            : 'Allow reminders & task notifications'}
                    </p>
                  </div>
                </div>
                {notificationPermission === 'granted' ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Check className="w-4 h-4" style={{ color: 'var(--nd-success)', strokeWidth: 2 }} />
                  </div>
                ) : notificationPermission === 'denied' || notificationPermission === 'unsupported' ? (
                  <span
                    className="font-mono text-[9px] uppercase tracking-[0.06em] px-2 py-1 rounded-full flex-shrink-0"
                    style={{
                      color: 'var(--nd-text-disabled)',
                      border: '1px solid var(--nd-border)',
                    }}
                  >
                    {notificationPermission === 'denied' ? 'BLOCKED' : 'N/A'}
                  </span>
                ) : (
                  <button
                    onClick={async () => {
                      if (onRequestNotificationPermission) {
                        await onRequestNotificationPermission();
                      }
                    }}
                    className="font-mono text-[9px] uppercase tracking-[0.06em] px-3 py-1 rounded-full flex-shrink-0 transition-colors duration-200"
                    style={{
                      color: 'var(--nd-black)',
                      backgroundColor: 'var(--nd-text-display)',
                      border: 'none',
                      cursor: 'pointer',
                      borderRadius: '999px',
                    }}
                  >
                    Enable
                  </button>
                )}
              </div>
            )}
            {/* PWA Install Button */}
            <PWAInstallButton />
            <SettingItem
              icon={Globe}
              label="Language"
              description={getLanguageName(profile.language)}
              onClick={() => setShowLanguage(true)}
            />
          </div>
        </div>

        {/* ── Preferences ── */}
        <div>
          <SectionHeader>{preferencesSectionLabel}</SectionHeader>
          <div className="space-y-1.5">
            <SettingItem
              icon={Moon}
              label="Dark Mode"
              description={settings.darkMode ? 'On' : 'Off'}
              toggle
              checked={settings.darkMode}
              onChange={(v) => handleToggle('darkMode', settings.darkMode)}
              disabled={settingsLoading}
            />
            <SettingItem
              icon={MapPin}
              label="Location Services"
              toggle
              checked={settings.locationServices}
              onChange={(v) => handleToggle('locationServices', settings.locationServices)}
              disabled={settingsLoading}
            />
            <SettingItem
              icon={MessageSquare}
              label="AI Voice Tone"
              description={getVoiceToneName(settings.voiceTone)}
              onClick={() => setShowVoiceTone(true)}
            />
            <SettingItem
              icon={Shield}
              label="Deep Context Mode"
              description={settings.deepContextMode !== false ? 'Full awareness' : 'Basic context only'}
              toggle
              checked={settings.deepContextMode !== false}
              onChange={(v) => handleToggle('deepContextMode', settings.deepContextMode !== false)}
              disabled={settingsLoading}
            />
          </div>
        </div>

        {/* ── Goals ── */}
        <div>
          <SectionHeader>{goalsSectionLabel}</SectionHeader>
          <div className="space-y-1.5">
            {goalsLoading ? (
              <div
                className="px-3 py-3 text-center"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '10px',
                }}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
                  [LOADING...]
                </span>
              </div>
            ) : goals.length === 0 ? (
              <div
                className="px-3 py-3 text-center"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '10px',
                }}
              >
                <p className="text-[12px]" style={{ color: 'var(--nd-text-secondary)' }}>{noGoalsMessage}</p>
              </div>
            ) : (
              goals.map((goal) => (
                <div
                  key={goal.id}
                  role="button"
                  tabIndex={0}
                  className="w-full px-3 py-2.5 text-left transition-colors duration-200 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '10px',
                  }}
                  onClick={() => handleOpenEditGoal(goal)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenEditGoal(goal);
                    }
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ border: `1px solid ${categoryColors[goal.category] || 'var(--nd-border-visible)'}` }}
                    >
                      <Target className="w-4 h-4" style={{ color: categoryColors[goal.category] || 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium truncate" style={{ color: goal.completed ? 'var(--nd-text-disabled)' : 'var(--nd-text-display)', textDecoration: goal.completed ? 'line-through' : 'none' }}>
                          {goal.title}
                        </p>
                        <span
                          className="font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            color: categoryColors[goal.category] || 'var(--nd-text-secondary)',
                            border: `1px solid ${categoryColors[goal.category] || 'var(--nd-border)'}`,
                            backgroundColor: 'transparent',
                          }}
                        >
                          {getGoalCategoryName(goal.category)}
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div
                          className="flex-1 h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: 'var(--nd-border)' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${goal.progress}%`,
                              backgroundColor: goal.completed ? 'var(--nd-success)' : (categoryColors[goal.category] || 'var(--nd-text-display)'),
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] flex-shrink-0" style={{ color: 'var(--nd-text-secondary)' }}>
                          {goal.progress}%
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  </div>
                </div>
              ))
            )}
            {/* Add Goal button */}
            <button
              onClick={handleOpenAddGoal}
              className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
                border: '1px dashed var(--nd-border-visible)',
                borderRadius: '10px',
                color: 'var(--nd-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Plus className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">Add Goal</span>
            </button>
          </div>
        </div>

        {/* ── Habits ── */}
        <div>
          <SectionHeader>{habitsSectionLabel}</SectionHeader>
          <div className="space-y-1.5">
            {habitsLoading ? (
              <div
                className="px-3 py-3 text-center"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '10px',
                }}
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--nd-text-secondary)' }}>
                  [LOADING...]
                </span>
              </div>
            ) : habits.length === 0 ? (
              <div
                className="px-3 py-3 text-center"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '10px',
                }}
              >
                <p className="text-[12px]" style={{ color: 'var(--nd-text-secondary)' }}>{noHabitsMessage}</p>
              </div>
            ) : (
              habits.map((habit) => {
                  const isExpanded = expandedHabitId === habit.id;
                  const calData = isExpanded ? getCalendarDays(habit) : null;
                  return (
                    <div
                      key={habit.id}
                      className="w-full px-3 py-2.5 text-left transition-colors duration-200"
                      style={{
                        backgroundColor: 'var(--nd-surface)',
                        border: '1px solid var(--nd-border)',
                        borderRadius: '10px',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ border: '1px solid var(--nd-border-visible)' }}
                        >
                          <Flame className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>
                              {habit.title}
                            </p>
                            <span
                              className="font-mono text-[9px] uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{
                                color: frequencyColors[habit.frequency] || 'var(--nd-text-secondary)',
                                border: `1px solid ${frequencyColors[habit.frequency] || 'var(--nd-border)'}`,
                                backgroundColor: 'transparent',
                              }}
                            >
                              {getHabitFrequencyName(habit.frequency)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Flame className="w-3 h-3" style={{ color: habit.streak > 0 ? 'var(--nd-warning)' : 'var(--nd-text-disabled)', strokeWidth: 1.5 }} />
                            <span className="font-mono text-[10px]" style={{ color: habit.streak > 0 ? 'var(--nd-warning)' : 'var(--nd-text-secondary)' }}>
                              {habit.streak} {habit.frequency === 'weekly' ? 'week' : 'day'}{habit.streak !== 1 ? 's' : ''} streak
                            </span>
                          </div>
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingHabitId(habit.id);
                            setShowDeleteHabit(true);
                          }}
                          className="w-7 h-7 flex items-center justify-center flex-shrink-0 rounded-full transition-colors"
                          style={{
                            border: '1px solid var(--nd-border)',
                            backgroundColor: 'transparent',
                            cursor: 'pointer',
                          }}
                          aria-label={`Delete ${habit.title}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                        </button>
                      </div>
                      {/* View History button */}
                      <div className="flex items-center gap-2 mt-1.5">
                        <button
                          onClick={() => toggleHabitToday(habit.id, habit.lastCompletedDate)}
                          className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.06em] transition-colors"
                          style={{
                            color: habit.lastCompletedDate === new Date().toISOString().split('T')[0] ? 'var(--nd-success)' : 'var(--nd-text-secondary)',
                            background: 'none',
                            border: habit.lastCompletedDate === new Date().toISOString().split('T')[0] ? '1px solid var(--nd-success)' : '1px solid var(--nd-border)',
                            cursor: 'pointer',
                            padding: '2px 8px',
                            borderRadius: '999px',
                          }}
                        >
                          <CheckCircle2 className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
                          {habit.lastCompletedDate === new Date().toISOString().split('T')[0] ? 'Done Today' : 'Mark Done'}
                        </button>
                        <button
                          onClick={() => setExpandedHabitId(isExpanded ? null : habit.id)}
                          className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-[0.06em] transition-colors"
                          style={{ color: 'var(--nd-text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          <CalendarDays className="w-3 h-3" style={{ strokeWidth: 1.5 }} />
                          {isExpanded ? 'Hide History' : 'View History'}
                        </button>
                      </div>
                      {/* Expandable Calendar */}
                      {isExpanded && calData && (
                        <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--nd-border)' }}>
                          <p className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--nd-text-secondary)' }}>
                            {calData.monthName}
                          </p>
                          {/* Day of week headers */}
                          <div className="grid grid-cols-7 gap-1 mb-1">
                            {DAY_ABBR.map((d) => (
                              <div key={d} className="text-center font-mono text-[8px] uppercase" style={{ color: 'var(--nd-text-disabled)' }}>
                                {d.charAt(0)}
                              </div>
                            ))}
                          </div>
                          {/* Calendar grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {calData.days.map((cell, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-center"
                                style={{ width: '16px', height: '16px', margin: '0 auto' }}
                              >
                                {cell.isEmpty ? null : (
                                  <div
                                    style={{
                                      width: '14px',
                                      height: '14px',
                                      borderRadius: '3px',
                                      backgroundColor: cell.isFuture
                                        ? 'transparent'
                                        : cell.isCompleted
                                          ? 'var(--nd-success)'
                                          : 'var(--nd-border)',
                                      border: cell.isToday ? '1.5px solid var(--nd-text-display)' : 'none',
                                    }}
                                    title={cell.date}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-2">
                            <div className="flex items-center gap-1">
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--nd-success)' }} />
                              <span className="font-mono text-[9px]" style={{ color: 'var(--nd-text-secondary)' }}>Done</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'var(--nd-border)' }} />
                              <span className="font-mono text-[9px]" style={{ color: 'var(--nd-text-secondary)' }}>Missed</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div style={{ width: '8px', height: '8px', borderRadius: '2px', border: '1px solid var(--nd-text-display)' }} />
                              <span className="font-mono text-[9px]" style={{ color: 'var(--nd-text-secondary)' }}>Today</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
            {/* Add Habit button */}
            <button
              onClick={handleOpenAddHabit}
              className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
                border: '1px dashed var(--nd-border-visible)',
                borderRadius: '10px',
                color: 'var(--nd-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Plus className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">Add Habit</span>
            </button>
          </div>
        </div>

        {/* ── Mood History ── */}
        {!moodsLoading && (
          <div>
            <SectionHeader>{moodHistoryLabel}</SectionHeader>
            {/* Last 7 days strip */}
            {moods.length > 0 && (
            <div
              className="p-3 mb-1.5"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
              }}
            >
              <div className="flex gap-1.5 justify-between">
                {last7DaysMoods.map((day) => {
                  const statusColor = day.mood ? MOOD_STATUS_COLORS[day.mood.mood] : undefined;
                  const Glyph = day.mood ? MOOD_GLYPHS[day.mood.mood] : null;
                  return (
                    <div
                      key={day.date}
                      className="flex flex-col items-center gap-1"
                      style={{
                        width: '48px',
                        padding: '6px 0',
                        backgroundColor: 'var(--nd-surface)',
                        border: day.isToday
                          ? '1px solid var(--nd-text-display)'
                          : '1px solid var(--nd-border)',
                        borderRadius: '0px',
                      }}
                    >
                      <span
                        className="font-mono text-[9px] uppercase"
                        style={{ color: day.isToday ? 'var(--nd-text-display)' : 'var(--nd-text-secondary)' }}
                      >
                        {day.dayAbbr}
                      </span>
                      {day.mood && Glyph ? (
                        <Glyph size={16} color={statusColor || 'var(--nd-text-secondary)'} />
                      ) : (
                        <span
                          className="font-mono text-[12px]"
                          style={{ color: 'var(--nd-text-disabled)' }}
                        >
                          —
                        </span>
                      )}
                      {day.mood && (
                        <span
                          className="font-mono uppercase"
                          style={{
                            fontSize: '7px',
                            letterSpacing: '0.04em',
                            color: statusColor || 'var(--nd-text-disabled)',
                          }}
                        >
                          {MOOD_LABELS[day.mood.mood] || ''}
                        </span>
                      )}
                      {/* Energy mini segmented bar */}
                      <div className="flex gap-[1px]">
                        {[1, 2, 3, 4, 5].map((lvl) => (
                          <div
                            key={lvl}
                            style={{
                              width: '4px',
                              height: '4px',
                              background: day.mood && day.mood.energy >= lvl
                                ? 'var(--nd-text-display)'
                                : 'var(--nd-border)',
                              borderRadius: '0px',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Summary stats */}
              <div className="flex gap-2 mt-3">
                <div
                  className="flex-1 p-2 text-center"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                  }}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <TrendingUp className="w-3 h-3" style={{ color: 'var(--nd-success)', strokeWidth: 1.5 }} />
                    <span className="font-mono text-[8px] uppercase" style={{ color: 'var(--nd-text-secondary)' }}>Avg Mood</span>
                  </div>
                  <span className="font-mono text-[14px] font-semibold" style={{ color: 'var(--nd-text-display)' }}>
                    {moodStats.avgMood || '—'}
                  </span>
                </div>
                <div
                  className="flex-1 p-2 text-center"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                  }}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Flame className="w-3 h-3" style={{ color: 'var(--nd-warning)', strokeWidth: 1.5 }} />
                    <span className="font-mono text-[8px] uppercase" style={{ color: 'var(--nd-text-secondary)' }}>Avg Energy</span>
                  </div>
                  <span className="font-mono text-[14px] font-semibold" style={{ color: 'var(--nd-text-display)' }}>
                    {moodStats.avgEnergy || '—'}
                  </span>
                </div>
                <div
                  className="flex-1 p-2 text-center"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                  }}
                >
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    <Check className="w-3 h-3" style={{ color: 'var(--nd-success)', strokeWidth: 1.5 }} />
                    <span className="font-mono text-[8px] uppercase" style={{ color: 'var(--nd-text-secondary)' }}>Streak</span>
                  </div>
                  <span className="font-mono text-[14px] font-semibold" style={{ color: 'var(--nd-text-display)' }}>
                    {moodStats.streak}
                  </span>
                </div>
              </div>
            </div>
            )}
            {/* Log Mood button */}
            <button
              onClick={() => {
                setMoodType('good');
                setMoodEnergy(3);
                setMoodNote('');
                setShowLogMood(true);
              }}
              className="w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors duration-200"
              style={{
                backgroundColor: 'transparent',
                border: '1px dashed var(--nd-border-visible)',
                borderRadius: '10px',
                color: 'var(--nd-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Plus className="w-4 h-4" style={{ strokeWidth: 1.5 }} />
              <span className="font-mono text-[11px] uppercase tracking-[0.08em]">Log Today's Mood</span>
            </button>
          </div>
        )}

        {/* ── Privacy & Security ── */}
        <div>
          <SectionHeader>Privacy &amp; Security</SectionHeader>
          <div className="space-y-1.5">
            <SettingItem
              icon={Shield}
              label="Private Mode"
              description="Encrypt conversations"
              toggle
              checked={settings.privateMode}
              onChange={(v) => handleToggle('privateMode', settings.privateMode)}
              disabled={settingsLoading}
            />
            <SettingItem
              icon={Lock}
              label="Password"
              description={settings.passwordHash ? 'Protected' : 'Not set'}
              onClick={() => setShowPassword(true)}
            />
            <SettingItem
              icon={FileText}
              label="Privacy Policy"
              onClick={() => setShowPrivacy(true)}
            />
            <SettingItem
              icon={FileText}
              label="Terms & Conditions"
              onClick={() => setShowTerms(true)}
            />
          </div>
        </div>

        {/* ── Data Management ── */}
        <div>
          <SectionHeader>{dataSectionLabel}</SectionHeader>
          <div className="space-y-1.5">
            {/* ── Tasks ── */}
            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-border-visible)' }}
                >
                  <Trash2 className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>Tasks</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    {tasks.length} task{tasks.length !== 1 ? 's' : ''} stored
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
                    style={{
                      border: '1px solid var(--nd-border-visible)',
                      background: 'transparent',
                      color: 'var(--nd-text-secondary)',
                      cursor: 'pointer',
                    }}
                    aria-label="Task deletion options"
                  >
                    <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="border-0 shadow-none outline-none"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '12px',
                    minWidth: '200px',
                    padding: '4px',
                  }}
                >
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      openDataConfirm(
                        'Delete All Tasks?',
                        `This will permanently delete all ${tasks.length} task${tasks.length !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete All',
                        async () => { await clearAllTasks(); },
                      );
                    }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
                    <span>Delete All</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ backgroundColor: 'var(--nd-border)', margin: '2px 8px' }} />
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const count = tasks.filter(t => t.completed).length;
                      openDataConfirm(
                        'Delete Completed Tasks?',
                        `This will permanently delete ${count} completed task${count !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete Completed',
                        async () => { await deleteCompletedTasks(); },
                      );
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--nd-success)', strokeWidth: 1.5 }} />
                    <span>Delete Completed</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const count = tasks.filter(t => t.date === today).length;
                      openDataConfirm(
                        "Delete Today's Tasks?",
                        `This will permanently delete ${count} task${count !== 1 ? 's' : ''} from today. This action cannot be undone.`,
                        'Delete Today',
                        async () => { await deleteTodayTasks(); },
                      );
                    }}
                  >
                    <Clock className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    <span>Delete Today</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const today = new Date().toISOString().split('T')[0];
                      const count = tasks.filter(t => t.date < today).length;
                      openDataConfirm(
                        'Delete Past Tasks?',
                        `This will permanently delete ${count} past task${count !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete Past',
                        async () => { await deletePastTasks(); },
                      );
                    }}
                  >
                    <CalendarDays className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    <span>Delete Past</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Reminders ── */}
            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-border-visible)' }}
                >
                  <Bell className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>Reminders</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    {reminders.length} reminder{reminders.length !== 1 ? 's' : ''} stored
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
                    style={{
                      border: '1px solid var(--nd-border-visible)',
                      background: 'transparent',
                      color: 'var(--nd-text-secondary)',
                      cursor: 'pointer',
                    }}
                    aria-label="Reminder deletion options"
                  >
                    <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="border-0 shadow-none outline-none"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '12px',
                    minWidth: '200px',
                    padding: '4px',
                  }}
                >
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      openDataConfirm(
                        'Delete All Reminders?',
                        `This will permanently delete all ${reminders.length} reminder${reminders.length !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete All',
                        async () => { await clearAllReminders(); },
                      );
                    }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
                    <span>Delete All</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ backgroundColor: 'var(--nd-border)', margin: '2px 8px' }} />
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const count = reminders.filter(r => r.completed).length;
                      openDataConfirm(
                        'Delete Completed Reminders?',
                        `This will permanently delete ${count} completed reminder${count !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete Completed',
                        async () => { await deleteCompletedReminders(); },
                      );
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--nd-success)', strokeWidth: 1.5 }} />
                    <span>Delete Completed</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const count = reminders.filter(r => r.recurring && r.recurring !== '').length;
                      openDataConfirm(
                        'Delete Recurring Reminders?',
                        `This will permanently delete ${count} recurring reminder${count !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete Recurring',
                        async () => { await deleteRecurringReminders(); },
                      );
                    }}
                  >
                    <RefreshCw className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    <span>Delete Recurring</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const count = reminders.filter(r => !r.recurring || r.recurring === '').length;
                      openDataConfirm(
                        'Delete One-time Reminders?',
                        `This will permanently delete ${count} one-time reminder${count !== 1 ? 's' : ''}. This action cannot be undone.`,
                        'Delete One-time',
                        async () => { await deleteOneTimeReminders(); },
                      );
                    }}
                  >
                    <Clock className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    <span>Delete One-time</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Chats ── */}
            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-border-visible)' }}
                >
                  <MessageSquare className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>Chats</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} stored
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="flex items-center justify-center w-8 h-8 rounded-full transition-colors duration-200"
                    style={{
                      border: '1px solid var(--nd-border-visible)',
                      background: 'transparent',
                      color: 'var(--nd-text-secondary)',
                      cursor: 'pointer',
                    }}
                    aria-label="Chat deletion options"
                  >
                    <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="border-0 shadow-none outline-none"
                  style={{
                    backgroundColor: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '12px',
                    minWidth: '200px',
                    padding: '4px',
                  }}
                >
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      openDataConfirm(
                        'Delete All Chats?',
                        `This will permanently delete all ${conversations.length} conversation${conversations.length !== 1 ? 's' : ''} and their messages. This action cannot be undone.`,
                        'Delete All',
                        async () => { await clearAllConversations(); },
                      );
                    }}
                  >
                    <Trash2 className="w-4 h-4" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
                    <span>Delete All</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator style={{ backgroundColor: 'var(--nd-border)', margin: '2px 8px' }} />
                  <DropdownMenuItem
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
                    style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
                    onSelect={() => {
                      const count = conversations.filter(c => !c.pinned).length;
                      openDataConfirm(
                        'Delete Unpinned Chats?',
                        `This will permanently delete ${count} unpinned conversation${count !== 1 ? 's' : ''} and their messages. Pinned chats will be kept. This action cannot be undone.`,
                        'Delete Unpinned',
                        async () => { await deleteUnpinnedConversations(); },
                      );
                    }}
                  >
                    <Pin className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    <span>Delete Unpinned</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* ── Clear AI Memory (Phase 2) ── */}
            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
              role="button"
              tabIndex={0}
              onClick={async () => {
                try {
                  const { clearAllMemoryData } = await import('@/hooks/use-offline-memory');
                  await clearAllMemoryData();
                  // Also clear AI content caches
                  try {
                    localStorage.removeItem('syntra_daily_summary_cache');
                    localStorage.removeItem('syntra_ai_suggestions_cache');
                    localStorage.removeItem('syntra_ai_dynamic_content');
                    localStorage.removeItem('syntra_ai_full_content');
                  } catch { /* ignore */ }
                  showStatus('saved');
                } catch {
                  showStatus('error', 'CLEAR MEMORY FAILED');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (e.target as HTMLElement).click();
                }
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-border-visible)' }}
                >
                  <Database className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>Clear Memory</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    Reset conversation memory & learned preferences
                  </p>
                </div>
              </div>
            </div>

            {/* ── Backup / Export / Import ── */}
            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
              role="button"
              tabIndex={0}
              onClick={handleExportData}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleExportData();
                }
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-border-visible)' }}
                >
                  <Download className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>
                    {exporting ? 'Exporting…' : 'Export Data'}
                  </p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    Download all data as JSON backup
                  </p>
                </div>
              </div>
            </div>

            {/* Hidden file input for import */}
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportData}
              aria-label="Import backup file"
            />

            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border)',
                borderRadius: '10px',
                cursor: importing ? 'not-allowed' : 'pointer',
              }}
              role="button"
              tabIndex={importing ? -1 : 0}
              onClick={() => {
                if (!importing) importInputRef.current?.click();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!importing) importInputRef.current?.click();
                }
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-border-visible)' }}
                >
                  <Upload className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-text-display)' }}>
                    {importing ? 'Importing…' : 'Import Data'}
                  </p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    Restore from a JSON backup file
                  </p>
                  {importStatus && (
                    <p
                      className="font-mono text-[10px] uppercase tracking-[0.08em] mt-1"
                      style={{ color: importStatus.type === 'success' ? 'var(--nd-success)' : 'var(--nd-accent)' }}
                    >
                      {importStatus.type === 'success' ? '[RESTORED] ' : '[ERROR] '}{importStatus.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Factory Reset ── */}
            <div
              className="w-full px-3 py-2.5 flex items-center justify-between transition-colors duration-200"
              style={{
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-accent)',
                borderRadius: '10px',
                cursor: 'pointer',
              }}
              role="button"
              tabIndex={0}
              onClick={() => setShowFactoryReset(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setShowFactoryReset(true);
                }
              }}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ border: '1px solid var(--nd-accent)' }}
                >
                  <AlertTriangle className="w-4 h-4" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
                </div>
                <div className="text-left min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--nd-accent)' }}>Factory Reset</p>
                  <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
                    Delete all data and start fresh
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
            </div>
          </div>
        </div>

        {/* ── Support ── */}
        <div>
          <SectionHeader>Support</SectionHeader>
          <div className="space-y-1.5">
            <SettingItem
              icon={HelpCircle}
              label="Help & Support"
              onClick={() => setShowHelp(true)}
            />
            <SettingItem
              icon={Info}
              label="About"
              description="Version 1.0.0"
              onClick={() => setShowAbout(true)}
            />
          </div>
        </div>

        {/* ── API Connection (Collapsible) ── */}
        <div>
          {/* Collapsible header row */}
          <div
            role="button"
            tabIndex={0}
            className="w-full flex items-center justify-between px-3 py-2.5 cursor-pointer select-none transition-colors duration-200"
            style={{
              backgroundColor: 'var(--nd-surface)',
              border: '1px solid var(--nd-border-visible)',
              borderRadius: connectionExpanded ? '10px 10px 0 0' : '10px',
            }}
            onClick={() => setConnectionExpanded(prev => !prev)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setConnectionExpanded(prev => !prev);
              }
            }}
          >
            {/* Left: status dot */}
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  backgroundColor:
                    apiConfig.status === 'connected'
                      ? 'var(--nd-success)'
                      : apiConfig.status === 'error'
                        ? 'var(--nd-accent)'
                        : apiConfig.status === 'testing'
                          ? 'var(--nd-text-secondary)'
                          : 'var(--nd-text-disabled)',
                  boxShadow:
                    apiConfig.status === 'connected'
                      ? '0 0 6px var(--nd-success)'
                      : 'none',
                }}
              />
              {/* Label + brief status */}
              <div className="min-w-0">
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  API CONNECTION
                </span>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.06em] ml-2"
                  style={{
                    color:
                      apiConfig.status === 'connected'
                        ? 'var(--nd-success)'
                        : apiConfig.status === 'error'
                          ? 'var(--nd-accent)'
                          : 'var(--nd-text-disabled)',
                  }}
                >
                  {apiConfig.status === 'connected'
                    ? (() => {
                        const preset = getProviderPreset(apiConfig.provider);
                        const providerLabel = preset?.label || apiConfig.provider;
                        return `● ${providerLabel}${apiConfig.modelName ? ` · ${apiConfig.modelName}` : ''}`;
                      })()
                    : apiConfig.status === 'error'
                      ? 'ERROR'
                      : apiConfig.status === 'testing'
                        ? 'TESTING...'
                        : 'NOT CONFIGURED'}
                </span>
              </div>
            </div>

            {/* Right: Chevron */}
            <ChevronDown
              className="w-4 h-4 flex-shrink-0 transition-transform duration-300 ease-in-out"
              style={{
                color: 'var(--nd-text-secondary)',
                strokeWidth: 1.5,
                transform: connectionExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </div>

          {/* Collapsible content with smooth animation */}
          <div
            className="overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out"
            style={{
              maxHeight: connectionExpanded ? '2000px' : '0px',
              opacity: connectionExpanded ? 1 : 0,
            }}
          >
            <div
              style={{
                borderLeft: '1px solid var(--nd-border-visible)',
                borderRight: '1px solid var(--nd-border-visible)',
                borderBottom: '1px solid var(--nd-border-visible)',
                borderRadius: '0 0 10px 10px',
              }}
            >
              <ApiConnectionSettings />
            </div>
          </div>
        </div>

        {/* ── Sign Out — compact pill button ── */}
        <div className="pb-2 flex justify-center">
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="inline-flex items-center justify-center gap-2 px-6 py-2.5 transition-colors duration-200"
            style={{
              background: 'transparent',
              border: '1px solid var(--nd-accent)',
              borderRadius: '999px',
              color: 'var(--nd-accent)',
              fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}
          >
            <LogOut className="w-4 h-4" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
            Sign Out
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/*  DIALOGS — Nothing modal style                                  */}
      {/* ──────────────────────────────────────────────────────────────── */}

      {/* ── Edit Profile Dialog ── */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              {editProfileLabel}
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
              Update your name and status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-1 max-h-[45vh] overflow-y-auto scrollbar-hide">
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Name
              </label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Your name"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Status
              </label>
              <input
                type="text"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Your status"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  About Me
                </label>
                <span
                  className="font-mono text-[10px]"
                  style={{ color: 'var(--nd-text-disabled)' }}
                >
                  {editAboutMe.length}/1000
                </span>
              </div>
              <textarea
                value={editAboutMe}
                onChange={(e) => setEditAboutMe(e.target.value.slice(0, 1000))}
                className="w-full px-3 py-2 text-xs font-mono outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)] resize-none"
                style={{
                  ...ndInputStyle,
                  minHeight: '120px',
                }}
                placeholder={aboutMePlaceholder}
                rows={5}
              />
              <p className="text-[10px] mt-1" style={{ color: 'var(--nd-text-disabled)' }}>
                Syntra uses this to personalize your AI experience — suggestions, insights, and conversations.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => setShowEditProfile(false)}
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
              onClick={handleSaveProfile}
              disabled={editProfileSaving}
              className="flex-1 py-2 text-sm font-medium transition-opacity disabled:opacity-40 font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {editProfileSaving ? '[SAVING...]' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Language Dialog — #000000 bg, 1px solid #222222, selected = 2px left #FFFFFF border ── */}
      <Dialog open={showLanguage} onOpenChange={setShowLanguage}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader>
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Language
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)' }}>
              Select your preferred language.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Select language" className="space-y-1 py-2 max-h-[45vh] sm:max-h-72 overflow-y-auto scrollbar-hide">
            {LANGUAGES.map((lang) => {
              const isSelected = lang.code === profile.language;
              return (
                <div
                  key={lang.code}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className="flex items-center justify-between px-4 py-3 transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: isSelected
                      ? '2px solid var(--nd-text-display)'
                      : '1px solid var(--nd-border)',
                    borderLeft: isSelected
                      ? '2px solid var(--nd-text-display)'
                      : '1px solid var(--nd-border)',
                    borderRadius: '10px',
                  }}
                  onClick={() => handleSelectLanguage(lang.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectLanguage(lang.code);
                    }
                  }}
                >
                  <span
                    className="text-sm font-medium"
                    style={{ color: isSelected ? 'var(--nd-text-display)' : 'var(--nd-text-primary)' }}
                  >
                    {lang.name}
                  </span>
                  {isSelected && (
                    <Check className="w-4 h-4" style={{ color: 'var(--nd-text-display)', strokeWidth: 1.5 }} />
                  )}
                </div>
              );
            })}
          </div>
          {languageSaving && (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-center" style={{ color: 'var(--nd-text-secondary)' }}>
              [SAVING...]
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Voice Tone Dialog — selectable cards similar to Language ── */}
      <Dialog open={showVoiceTone} onOpenChange={setShowVoiceTone}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader>
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              AI Voice Tone
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)' }}>
              Choose how the AI speaks to you.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Select voice tone" className="space-y-1.5 py-2 max-h-[45vh] sm:max-h-72 overflow-y-auto scrollbar-hide">
            {VOICE_TONES.map((tone) => {
              const isSelected = tone.code === settings.voiceTone;
              return (
                <div
                  key={tone.code}
                  role="radio"
                  aria-checked={isSelected}
                  tabIndex={isSelected ? 0 : -1}
                  className="px-4 py-3 transition-colors cursor-pointer"
                  style={{
                    backgroundColor: 'var(--nd-black)',
                    border: isSelected
                      ? '2px solid var(--nd-text-display)'
                      : '1px solid var(--nd-border)',
                    borderRadius: '10px',
                  }}
                  onClick={() => handleSelectVoiceTone(tone.code)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectVoiceTone(tone.code);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-sm font-medium"
                      style={{ color: isSelected ? 'var(--nd-text-display)' : 'var(--nd-text-primary)' }}
                    >
                      {tone.name}
                    </span>
                    {isSelected && (
                      <Check className="w-4 h-4" style={{ color: 'var(--nd-text-display)', strokeWidth: 1.5 }} />
                    )}
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--nd-text-secondary)' }}>
                    {tone.desc}
                  </p>
                </div>
              );
            })}
          </div>
          {voiceToneSaving && (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-center" style={{ color: 'var(--nd-text-secondary)' }}>
              [SAVING...]
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Add Goal Dialog ── */}
      <Dialog open={showAddGoal} onOpenChange={setShowAddGoal}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Add Goal
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
              Set a new personal goal to track.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title
              </label>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Goal title"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </label>
              <input
                type="text"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Category
              </label>
              <div className="relative">
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none appearance-none"
                  style={{
                    ...ndInputStyle,
                    paddingRight: '32px',
                  }}
                >
                  {GOAL_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              </div>
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Initial Progress — {goalProgress}%
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGoalProgress(Math.max(0, goalProgress - 10))}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--nd-black)',
                    cursor: 'pointer',
                    color: 'var(--nd-text-primary)',
                  }}
                >
                  <Minus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                </button>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--nd-border)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${goalProgress}%`,
                      backgroundColor: categoryColors[goalCategory] || 'var(--nd-text-display)',
                    }}
                  />
                </div>
                <button
                  onClick={() => setGoalProgress(Math.min(100, goalProgress + 10))}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--nd-black)',
                    cursor: 'pointer',
                    color: 'var(--nd-text-primary)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => setShowAddGoal(false)}
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
              onClick={handleSaveNewGoal}
              disabled={goalSaving || !goalTitle.trim()}
              className="flex-1 py-2 text-sm font-medium transition-opacity disabled:opacity-40 font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {goalSaving ? '[SAVING...]' : 'Add Goal'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Goal Dialog ── */}
      <Dialog open={showEditGoal} onOpenChange={(open) => {
        setShowEditGoal(open);
        if (!open) setEditingGoal(null);
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Edit Goal
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
              Update progress or modify this goal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title
              </label>
              <input
                type="text"
                value={goalTitle}
                onChange={(e) => setGoalTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Goal title"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </label>
              <input
                type="text"
                value={goalDescription}
                onChange={(e) => setGoalDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Category
              </label>
              <div className="relative">
                <select
                  value={goalCategory}
                  onChange={(e) => setGoalCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none appearance-none"
                  style={{
                    ...ndInputStyle,
                    paddingRight: '32px',
                  }}
                >
                  {GOAL_CATEGORIES.map((cat) => (
                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              </div>
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Progress — {goalProgress}%
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setGoalProgress(Math.max(0, goalProgress - 10))}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--nd-black)',
                    cursor: 'pointer',
                    color: 'var(--nd-text-primary)',
                  }}
                >
                  <Minus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                </button>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--nd-border)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${goalProgress}%`,
                      backgroundColor: categoryColors[goalCategory] || 'var(--nd-text-display)',
                    }}
                  />
                </div>
                <button
                  onClick={() => setGoalProgress(Math.min(100, goalProgress + 10))}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--nd-black)',
                    cursor: 'pointer',
                    color: 'var(--nd-text-primary)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                </button>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 mt-1">
            <div className="flex gap-2 w-full">
              <button
                onClick={() => { setShowEditGoal(false); setEditingGoal(null); }}
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
                onClick={handleSaveEditGoal}
                disabled={goalSaving || !goalTitle.trim()}
                className="flex-1 py-2 text-sm font-medium transition-opacity disabled:opacity-40 font-mono uppercase tracking-[0.08em] text-[11px]"
                style={{
                  background: 'var(--nd-text-display)',
                  color: 'var(--nd-black)',
                  borderRadius: '999px',
                }}
              >
                {goalSaving ? '[SAVING...]' : 'Save'}
              </button>
            </div>
            {/* Delete goal button */}
            <button
              onClick={() => {
                if (editingGoal) {
                  setDeletingGoalId(editingGoal.id);
                  setShowDeleteGoal(true);
                }
              }}
              className="w-full py-2 text-sm font-medium transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'transparent',
                color: 'var(--nd-accent)',
                border: '1px solid var(--nd-accent)',
                borderRadius: '999px',
                cursor: 'pointer',
              }}
            >
              Delete Goal
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Goal Confirmation ── */}
      <ConfirmDialog
        open={showDeleteGoal}
        onOpenChange={setShowDeleteGoal}
        title="Delete Goal?"
        description="This will permanently delete this goal. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        icon="delete"
        onConfirm={handleDeleteGoal}
      />

      {/* ── Add Habit Dialog ── */}
      <Dialog open={showAddHabit} onOpenChange={setShowAddHabit}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Add Habit
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
              Start tracking a new daily or weekly habit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Title
              </label>
              <input
                type="text"
                value={habitTitle}
                onChange={(e) => setHabitTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Habit title"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Description
              </label>
              <input
                type="text"
                value={habitDescription}
                onChange={(e) => setHabitDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="Optional description"
              />
            </div>
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Frequency
              </label>
              <div className="relative">
                <select
                  value={habitFrequency}
                  onChange={(e) => setHabitFrequency(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none appearance-none"
                  style={{
                    ...ndInputStyle,
                    paddingRight: '32px',
                  }}
                >
                  {HABIT_FREQUENCIES.map((freq) => (
                    <option key={freq.code} value={freq.code}>{freq.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              </div>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => setShowAddHabit(false)}
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
              onClick={handleSaveNewHabit}
              disabled={habitSaving || !habitTitle.trim()}
              className="flex-1 py-2 text-sm font-medium transition-opacity disabled:opacity-40 font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {habitSaving ? '[SAVING...]' : 'Add Habit'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Habit Confirmation ── */}
      <ConfirmDialog
        open={showDeleteHabit}
        onOpenChange={setShowDeleteHabit}
        title="Delete Habit?"
        description="This will permanently delete this habit and its streak. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        icon="delete"
        onConfirm={handleDeleteHabit}
      />

      {/* ── Log Mood Dialog ── */}
      <Dialog open={showLogMood} onOpenChange={setShowLogMood}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Log Today&apos;s Mood
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
              How are you feeling today?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {/* Mood type selection */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1.5 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Mood
              </label>
              <div className="flex gap-1.5">
                {(['great', 'good', 'okay', 'low', 'bad'] as const).map((m) => {
                  const Glyph = MOOD_GLYPHS[m];
                  const color = MOOD_STATUS_COLORS[m];
                  const isSelected = moodType === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMoodType(m)}
                      className="flex flex-col items-center gap-1 py-2 flex-1 transition-colors"
                      style={{
                        border: isSelected ? `1px solid ${color}` : '1px solid var(--nd-border)',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? `${color}15` : 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {Glyph && <Glyph size={18} color={isSelected ? color : 'var(--nd-text-disabled)'} />}
                      <span className="font-mono text-[8px] uppercase tracking-[0.04em]" style={{ color: isSelected ? color : 'var(--nd-text-disabled)' }}>
                        {MOOD_LABELS[m]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Energy level */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1.5 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Energy Level — {moodEnergy}/5
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMoodEnergy(Math.max(1, moodEnergy - 1))}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--nd-black)',
                    cursor: 'pointer',
                    color: 'var(--nd-text-primary)',
                  }}
                >
                  <Minus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                </button>
                <div
                  className="flex-1 h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--nd-border)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{
                      width: `${(moodEnergy / 5) * 100}%`,
                      backgroundColor: 'var(--nd-text-display)',
                    }}
                  />
                </div>
                <button
                  onClick={() => setMoodEnergy(Math.min(5, moodEnergy + 1))}
                  className="w-8 h-8 flex items-center justify-center flex-shrink-0"
                  style={{
                    border: '1px solid var(--nd-border)',
                    borderRadius: '8px',
                    backgroundColor: 'var(--nd-black)',
                    cursor: 'pointer',
                    color: 'var(--nd-text-primary)',
                  }}
                >
                  <Plus className="w-3.5 h-3.5" style={{ strokeWidth: 1.5 }} />
                </button>
              </div>
            </div>
            {/* Note */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Note (optional)
              </label>
              <input
                type="text"
                value={moodNote}
                onChange={(e) => setMoodNote(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                style={ndInputStyle}
                placeholder="How's your day going?"
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 mt-1">
            <button
              onClick={() => setShowLogMood(false)}
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
              onClick={handleSaveMood}
              disabled={moodSaving}
              className="flex-1 py-2 text-sm font-medium transition-opacity disabled:opacity-40 font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              {moodSaving ? '[SAVING...]' : 'Save'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── About Dialog — NO gradient icon, simple circle with 1px border ── */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader>
            <div className="flex flex-col items-center text-center">
              {/* App icon — simple circle with 1px border, no gradient */}
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3"
                style={{
                  border: '1px solid var(--nd-border-visible)',
                  backgroundColor: 'var(--nd-surface)',
                }}
              >
                <Info className="w-8 h-8" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              </div>
              <DialogTitle
                className="text-xl"
                style={{ color: 'var(--nd-text-display)' }}
              >
                Syntra Assistant
              </DialogTitle>
              <DialogDescription
                className="font-mono text-[11px] uppercase tracking-[0.08em] mt-1"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Version 1.0.0 Beta
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="py-2 text-center">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--nd-text-secondary)' }}>
              Your personal AI assistant that listens, plans and empowers your daily life.
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] mt-4" style={{ color: 'var(--nd-text-disabled)' }}>
              Built by the Syntra team
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowAbout(false)}
              className="w-full py-2.5 text-sm font-medium font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Help & Support Dialog ── */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader>
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Help &amp; Support
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)' }}>
              Frequently asked questions and contact info.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[45vh] sm:max-h-72 overflow-y-auto scrollbar-hide">
            <FaqItem
              question="How do I start a conversation?"
              answer="Tap the chat icon in the bottom navigation bar to start a new conversation with Syntra. You can ask anything — from planning your day to getting creative ideas."
            />
            <FaqItem
              question="Can I customize my AI assistant?"
              answer="Yes! Head to Settings → API Connection to configure your own AI model provider. You can also adjust various preferences in the Settings screen."
            />
            <FaqItem
              question="Is my data private?"
              answer="Absolutely. Enable Private Mode in Settings to encrypt your conversations. We never share your data with third parties. See our Privacy Policy for details."
            />
            <FaqItem
              question="How do I change the language?"
              answer="Go to Settings → Language to choose from our supported languages including English, Spanish, French, German, Japanese, Korean, and Chinese."
            />
          </div>
          <div
            className="flex items-center gap-2 mt-2 p-3"
            style={{
              border: '1px solid var(--nd-border)',
              borderRadius: '8px',
            }}
          >
            <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--nd-text-display)' }}>Contact us</p>
              <p className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
                support@syntra.ai
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowHelp(false)}
              className="w-full py-2.5 text-sm font-medium font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Privacy Policy Dialog ── */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader>
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Privacy Policy
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)' }}>
              Last updated: March 2025
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[45vh] sm:max-h-72 overflow-y-auto scrollbar-hide text-sm leading-relaxed" style={{ color: 'var(--nd-text-secondary)' }}>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>1. Data Collection</h3>
              <p>
                Syntra collects minimal data necessary to provide our services. This includes your
                profile information, conversation history, and app preferences. We do not collect
                data beyond what is required for app functionality.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>2. Data Storage</h3>
              <p>
                Your data is stored securely on our servers with industry-standard encryption. When
                Private Mode is enabled, your conversations are end-to-end encrypted and cannot be
                accessed by anyone, including our team.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>3. Third-Party Sharing</h3>
              <p>
                We do not sell, trade, or otherwise transfer your personal information to outside
                parties. Conversation data sent to AI model providers is processed according to
                their respective privacy policies.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>4. Your Rights</h3>
              <p>
                You have the right to access, modify, or delete your personal data at any time.
                Use the Data Management section in Settings to clear your data or perform a
                factory reset.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>5. Contact</h3>
              <p>
                For privacy-related inquiries, please contact us at privacy@syntra.ai.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowPrivacy(false)}
              className="w-full py-2.5 text-sm font-medium font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Terms & Conditions Dialog ── */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader>
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              Terms &amp; Conditions
            </DialogTitle>
            <DialogDescription style={{ color: 'var(--nd-text-secondary)' }}>
              Last updated: March 2025
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[45vh] sm:max-h-72 overflow-y-auto scrollbar-hide text-sm leading-relaxed" style={{ color: 'var(--nd-text-secondary)' }}>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>1. Acceptance of Terms</h3>
              <p>
                By using Syntra, you agree to be bound by these Terms and Conditions. If you do
                not agree to these terms, please do not use the service.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>2. Use of Service</h3>
              <p>
                You may use Syntra for personal, non-commercial purposes. You agree not to
                misuse the service, attempt to gain unauthorized access, or use it for any unlawful
                activity. AI-generated content is provided for informational purposes and should not
                be relied upon as professional advice.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>3. User Data</h3>
              <p>
                Your data is stored locally on your device. We do not sell, rent, or share your
                personal data with third parties for marketing purposes. Conversation data sent to
                AI model providers is processed according to their respective terms.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>4. AI-Generated Content</h3>
              <p>
                Responses generated by Syntra are for informational purposes only and should not
                be considered professional advice — whether medical, legal, financial, or otherwise.
                Always consult qualified professionals for important decisions.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>5. Limitation of Liability</h3>
              <p>
                The service is provided "as is" without warranties of any kind, either express or
                implied. We are not liable for any damages arising from your use of the service,
                including but not limited to inaccuracies in AI-generated content.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1" style={{ color: 'var(--nd-text-display)' }}>6. Changes to Terms</h3>
              <p>
                We may update these Terms and Conditions from time to time. We will notify you of
                material changes through the app. Continued use of the service after changes
                constitutes acceptance of the updated terms.
              </p>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowTerms(false)}
              className="w-full py-2.5 text-sm font-medium font-mono uppercase tracking-[0.08em] text-[11px]"
              style={{
                background: 'var(--nd-text-display)',
                color: 'var(--nd-black)',
                borderRadius: '999px',
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Password Dialog ── */}
      <Dialog open={showPassword} onOpenChange={(open) => {
        setShowPassword(open);
        if (!open) {
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
          setShowCurrentPassword(false);
          setShowNewPassword(false);
          setShowConfirmPassword(false);
        }
      }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm p-4 sm:p-6" style={ndDialogStyle}>
          <DialogHeader className="pb-0">
            <DialogTitle
              className="font-mono text-[11px] uppercase tracking-[0.08em]"
              style={{ color: 'var(--nd-text-display)' }}
            >
              {settings.passwordHash ? 'Change Password' : 'Set Password'}
            </DialogTitle>
            <DialogDescription className="text-xs" style={{ color: 'var(--nd-text-secondary)' }}>
              {settings.passwordHash
                ? 'Change or remove your lock screen password.'
                : 'Set a password to protect your app on launch.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1 max-h-[50vh] overflow-y-auto scrollbar-hide">
            {/* Current Password — only show if password is already set */}
            {settings.passwordHash && (
              <div>
                <label
                  className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                  style={{ color: 'var(--nd-text-secondary)' }}
                >
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-9 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                    style={ndInputStyle}
                    placeholder="Current password"
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setShowCurrentPassword(!showCurrentPassword);
                      }
                    }}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    ) : (
                      <Eye className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* New Password */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                  style={ndInputStyle}
                  placeholder="Min. 4 characters"
                />
                <div
                  role="button"
                  tabIndex={0}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowNewPassword(!showNewPassword);
                    }
                  }}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  ) : (
                    <Eye className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  )}
                </div>
              </div>
            </div>
            {/* Confirm Password */}
            <div>
              <label
                className="font-mono text-[10px] uppercase tracking-[0.08em] mb-1 block"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 pr-9 text-xs font-mono h-9 outline-none focus:outline-none placeholder:text-[var(--nd-text-disabled)]"
                  style={ndInputStyle}
                  placeholder="Confirm password"
                />
                <div
                  role="button"
                  tabIndex={0}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setShowConfirmPassword(!showConfirmPassword);
                    }
                  }}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  ) : (
                    <Eye className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 mt-1">
            <div className="flex gap-2 w-full">
              <button
                onClick={() => {
                  setShowPassword(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
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
                onClick={handleSavePassword}
                disabled={passwordSaving}
                className="flex-1 py-2 text-sm font-medium transition-opacity disabled:opacity-40 font-mono uppercase tracking-[0.08em] text-[11px]"
                style={{
                  background: 'var(--nd-text-display)',
                  color: 'var(--nd-black)',
                  borderRadius: '999px',
                }}
              >
                {passwordSaving ? '[SAVING...]' : 'Save'}
              </button>
            </div>
            {/* Remove Password button — only show if password is set */}
            {settings.passwordHash && (
              <button
                onClick={async () => {
                  if (!currentPassword) return;
                  const isValid = await verifyPassword(currentPassword, settings.passwordHash);
                  if (!isValid) {
                    showStatus('error', 'CURRENT PASSWORD WRONG');
                    return;
                  }
                  try {
                    await removePassword();
                    showStatus('saved');
                    setShowPassword(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setShowCurrentPassword(false);
                    setShowNewPassword(false);
                    setShowConfirmPassword(false);
                  } catch {
                    showStatus('error', 'REMOVE FAILED');
                  }
                }}
                className="w-full py-2 text-sm font-medium transition-colors font-mono uppercase tracking-[0.08em] text-[11px]"
                style={{
                  background: 'transparent',
                  color: 'var(--nd-accent)',
                  border: '1px solid var(--nd-accent)',
                  borderRadius: '999px',
                }}
              >
                Remove Password
              </button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sign Out Confirmation Dialog ── */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign Out?"
        description={settings.passwordHash
          ? 'You will be signed out and need to enter your password to get back in.'
          : 'You will be returned to the welcome screen.'}
        confirmLabel="Sign Out"
        cancelLabel="Cancel"
        variant="danger"
        icon="logout"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          if (onLogout) onLogout();
        }}
      />

      {/* ── Unified Data Deletion Confirmation ── */}
      <ConfirmDialog
        open={dataConfirm.open}
        onOpenChange={(open) => { if (!open) closeDataConfirm(); }}
        title={dataConfirm.title}
        description={dataConfirm.description}
        confirmLabel={dataConfirm.confirmLabel}
        variant="danger"
        icon="delete"
        onConfirm={async () => {
          setClearingData(true);
          try {
            await dataConfirm.onConfirm();
            showStatus('saved');
          } catch {
            showStatus('error', 'DELETE FAILED');
          } finally {
            setClearingData(false);
            closeDataConfirm();
          }
        }}
      />

      {/* ── Factory Reset Confirmation ── */}
      <ConfirmDialog
        open={showFactoryReset}
        onOpenChange={setShowFactoryReset}
        title="Factory Reset?"
        description="This will permanently delete ALL your data — tasks, reminders, conversations, profile, and settings. The app will be restored to its initial state. This action cannot be undone."
        confirmLabel="Reset Everything"
        variant="danger"
        icon="delete"
        onConfirm={async () => {
          setClearingData(true);
          try {
            await factoryReset();
            showStatus('saved');
          } catch {
            showStatus('error', 'RESET FAILED');
          } finally {
            setClearingData(false);
            setShowFactoryReset(false);
          }
        }}
      />

      {/* Bottom Navigation is rendered at the app level in page.tsx */}
    </div>
  );
}
