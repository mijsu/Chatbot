'use client';

import {
  Home,
  CalendarDays,
  Mic,
  Clock,
  User,
} from 'lucide-react';
import type { NavAIContent } from '@/lib/ai-context-engine';

type NavScreen = 'home' | 'planner' | 'chats' | 'friends' | 'settings';

interface BottomNavProps {
  active: NavScreen;
  onNavigate: (page: string) => void;
  onVoiceOpen: () => void;
  navLabels?: NavAIContent;
}

const defaultLabels: NavAIContent = {
  homeLabel: 'Home',
  plannerLabel: 'Planner',
  voiceLabel: 'Voice',
  reminderLabel: 'Reminders',
  profileLabel: 'Profile',
};

export default function BottomNav({ active, onNavigate, onVoiceOpen }: BottomNavProps) {
  // Nav labels are ALWAYS fixed — the AI is not allowed to rename them
  const labels = defaultLabels;

  const leftItems: { screen: NavScreen; icon: typeof Home; label: string }[] = [
    { screen: 'home', icon: Home, label: labels.homeLabel },
    { screen: 'planner', icon: CalendarDays, label: labels.plannerLabel },
  ];

  const rightItems: { screen: NavScreen; icon: typeof Home; label: string }[] = [
    { screen: 'friends', icon: Clock, label: labels.reminderLabel },
    { screen: 'settings', icon: User, label: labels.profileLabel },
  ];

  return (
    <nav
      className="relative flex items-center justify-around px-1 shrink-0"
      style={{
        backgroundColor: 'var(--nd-surface)',
        borderTop: '1px solid var(--nd-border)',
        height: '64px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Left nav items: Home, Planner */}
      {leftItems.map(({ screen, icon: Icon, label }) => {
        const isActive = active === screen;
        return (
          <button
            key={screen}
            onClick={() => onNavigate(screen)}
            className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2 transition-colors duration-150"
            style={{ color: isActive ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)' }}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className="w-[20px] h-[20px]"
              strokeWidth={1.5}
              style={{ color: isActive ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)' }}
            />
            <span
              className="font-mono uppercase leading-none"
              style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: isActive ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)',
              }}
            >
              {label}
            </span>
            {/* Active dot indicator */}
            {isActive && (
              <span
                className="rounded-full"
                style={{
                  width: '5px',
                  height: '5px',
                  backgroundColor: 'var(--nd-text-display)',
                  marginTop: '1px',
                }}
              />
            )}
          </button>
        );
      })}

      {/* Center Voice / Mic button — flat, no elevation */}
      <button
        onClick={onVoiceOpen}
        className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2 group"
        aria-label={labels.voiceLabel}
      >
        <div
          className="rounded-full flex items-center justify-center transition-all duration-200 nd-focus-ring"
          style={{
            width: '40px',
            height: '40px',
            border: '1px solid var(--nd-border-visible)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
            e.currentTarget.style.background = 'color-mix(in srgb, var(--nd-text-primary) 6%, transparent)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Mic
            className="w-[18px] h-[18px]"
            strokeWidth={1.5}
            style={{ color: 'var(--nd-text-primary)' }}
          />
        </div>
        <span
          className="font-mono uppercase leading-none"
          style={{
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: 'var(--nd-text-disabled)',
          }}
        >
          {labels.voiceLabel}
        </span>
      </button>

      {/* Right nav items: Reminder, Profile */}
      {rightItems.map(({ screen, icon: Icon, label }) => {
        const isActive = active === screen;
        return (
          <button
            key={screen}
            onClick={() => onNavigate(screen)}
            className="flex flex-col items-center justify-center gap-[2px] flex-1 py-2 transition-colors duration-150"
            style={{ color: isActive ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)' }}
            aria-label={label}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className="w-[20px] h-[20px]"
              strokeWidth={1.5}
              style={{ color: isActive ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)' }}
            />
            <span
              className="font-mono uppercase leading-none"
              style={{
                fontSize: '10px',
                letterSpacing: '0.08em',
                color: isActive ? 'var(--nd-text-display)' : 'var(--nd-text-disabled)',
              }}
            >
              {label}
            </span>
            {/* Active dot indicator */}
            {isActive && (
              <span
                className="rounded-full"
                style={{
                  width: '5px',
                  height: '5px',
                  backgroundColor: 'var(--nd-text-display)',
                  marginTop: '1px',
                }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
