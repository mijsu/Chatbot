'use client';

import { CalendarDays, Bell, Flame, Target, MessageCircle, Brain } from 'lucide-react';

/* ─── Types ─── */

interface EmptyStateProps {
  type: 'tasks' | 'reminders' | 'habits' | 'goals' | 'chats' | 'focus';
  title?: string;  // Override default title
  action?: { label: string; onClick: () => void };
}

/* ─── Default Content Map ─── */

const EMPTY_STATE_DEFAULTS: Record<EmptyStateProps['type'], {
  title: string;
  subtitle: string;
  icon: React.ElementType;
}> = {
  tasks: {
    title: 'No tasks yet',
    subtitle: 'Add your first task to get started',
    icon: CalendarDays,
  },
  reminders: {
    title: 'No reminders',
    subtitle: 'Set a reminder to never forget',
    icon: Bell,
  },
  habits: {
    title: 'No habits tracked',
    subtitle: 'Start building daily routines',
    icon: Flame,
  },
  goals: {
    title: 'No goals set',
    subtitle: 'Define what you want to achieve',
    icon: Target,
  },
  chats: {
    title: 'No conversations',
    subtitle: 'Start a new chat with Syntra',
    icon: MessageCircle,
  },
  focus: {
    title: 'No focus sessions',
    subtitle: 'Start a focus timer to track deep work',
    icon: Brain,
  },
};

/* ─── Component ─── */

export default function EmptyState({ type, title, action }: EmptyStateProps) {
  const defaults = EMPTY_STATE_DEFAULTS[type];
  const displayTitle = title || defaults.title;
  const IconComponent = defaults.icon;

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      {/* Icon in circle */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ border: '1px solid var(--nd-border-visible)' }}
      >
        <IconComponent
          className="w-5 h-5"
          style={{ color: 'var(--nd-text-disabled)', strokeWidth: 1.5 }}
        />
      </div>

      {/* Title */}
      <p
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-center"
        style={{ color: 'var(--nd-text-primary)' }}
      >
        {displayTitle}
      </p>

      {/* Subtitle */}
      <p
        className="font-mono text-[10px] mt-1 text-center"
        style={{ color: 'var(--nd-text-disabled)' }}
      >
        {defaults.subtitle}
      </p>

      {/* Optional action button */}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] transition-colors duration-200"
          style={{
            background: 'transparent',
            color: 'var(--nd-text-primary)',
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '999px',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
