'use client';

import { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';
import AiOrb from '@/components/chatbot/ai-orb';
import { useOfflineProfile, useOfflineSettings } from '@/hooks/use-offline-data';

/* ─── Types ─── */

interface SetupScreenProps {
  onFinish: () => void;
  onSkip: () => void;
}

/* ─── Constants ─── */

const ROLES = [
  { value: 'student', label: 'Student' },
  { value: 'young-professional', label: 'Young Professional' },
  { value: 'freelancer', label: 'Freelancer' },
  { value: 'entrepreneur', label: 'Entrepreneur' },
  { value: 'creative', label: 'Creative' },
  { value: 'manager', label: 'Manager' },
] as const;

const INTERESTS = [
  { value: 'task-management', label: 'Task Management' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'reminders', label: 'Reminders' },
  { value: 'notes', label: 'Notes' },
  { value: 'research', label: 'Research' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'finance', label: 'Finance' },
  { value: 'travel', label: 'Travel' },
  { value: 'cooking', label: 'Cooking' },
] as const;

/* ─── Component ─── */

export default function SetupScreen({ onFinish, onSkip }: SetupScreenProps) {
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [role, setRole] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { profile, updateProfile } = useOfflineProfile();
  const { updateSettings } = useOfflineSettings();

  // Pre-fill name from profile if available (skip empty/placeholder)
  useEffect(() => {
    if (profile?.name && profile.name.trim().length > 0) {
      setName(profile.name);
    }
  }, [profile]);

  const toggleInterest = (value: string) => {
    setSelectedInterests((prev) =>
      prev.includes(value)
        ? prev.filter((i) => i !== value)
        : [...prev, value]
    );
  };

  const handleFinishSetup = async () => {
    if (!name.trim()) {
      setNameError('Please enter your name');
      return;
    }
    setNameError('');
    setSaving(true);
    try {
      // Save name to profile — also clear any leftover placeholder status
      await updateProfile({
        name: name.trim(),
        status: '',  // Clear placeholder status like "Premium Member"
      });
      // Save role and interests to settings — role marks setup as completed
      await updateSettings({
        role: role || 'not-set',  // Even if no role selected, mark setup as done
        interests: selectedInterests.join(','),
      });

      // Clear all AI content caches so no stale/hallucinated data persists
      try {
        localStorage.removeItem('syntra_daily_summary_cache');
        localStorage.removeItem('syntra_ai_suggestions_cache');
        localStorage.removeItem('syntra_ai_dynamic_content');
        localStorage.removeItem('syntra_ai_full_content');
      } catch { /* ignore */ }

      onFinish();
    } catch (error) {
      console.error('Failed to save setup data:', error);
      onFinish(); // Still proceed even if save fails
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="w-full h-full min-h-screen relative flex flex-col items-center overflow-y-auto"
      style={{ background: 'var(--nd-black)' }}
    >
      {/* Subtle dot-grid background pattern */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, var(--nd-border-visible) 0.6px, transparent 0.6px)',
          backgroundSize: '24px 24px',
          backgroundPosition: '0 0',
        }}
      />

      {/* Content */}
      <div className="relative z-10 max-w-sm w-full px-6 flex flex-col items-center py-12">
        {/* AI Orb */}
        <div className="mb-6">
          <AiOrb size="md" animate={true} showIcon={true} />
        </div>

        {/* Header */}
        <h1
          className="text-center leading-tight mb-2"
          style={{
            fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
            fontSize: '20px',
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: 'var(--nd-text-display)',
            textTransform: 'uppercase',
          }}
        >
          Set Up Your Syntra
        </h1>

        <p
          className="text-center mb-8"
          style={{
            fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
            fontSize: '11px',
            letterSpacing: '0.06em',
            color: 'var(--nd-text-secondary)',
          }}
        >
          PERSONALIZE YOUR EXPERIENCE
        </p>

        {/* Name Input */}
        <div className="w-full mb-6">
          <label
            className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2 block"
            style={{ color: 'var(--nd-text-secondary)' }}
          >
            What&apos;s your name?
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameError(''); }}
            placeholder="Enter your name"
            className="w-full py-3 px-4 text-sm font-mono outline-none focus:outline-none"
            style={{
              backgroundColor: 'var(--nd-surface)',
              border: nameError ? '1px solid var(--nd-accent)' : '1px solid var(--nd-border-visible)',
              borderRadius: '10px',
              color: 'var(--nd-text-display)',
            }}
            autoFocus
          />
          {nameError && (
            <p
              className="font-mono text-[11px] uppercase tracking-[0.08em] mt-1.5"
              style={{ color: 'var(--nd-accent)' }}
            >
              [{nameError.toUpperCase()}]
            </p>
          )}
        </div>

        {/* Role Dropdown */}
        <div className="w-full mb-6">
          <label
            className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2 block"
            style={{ color: 'var(--nd-text-secondary)' }}
          >
            What&apos;s your primary role?
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const isSelected = role === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setRole(r.value)}
                  aria-pressed={isSelected}
                  className="py-2.5 px-3 text-left transition-all duration-200"
                  style={{
                    background: isSelected ? 'var(--nd-text-display)' : 'var(--nd-surface)',
                    color: isSelected ? 'var(--nd-black)' : 'var(--nd-text-primary)',
                    border: isSelected ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                    borderRadius: '10px',
                    fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
                    fontSize: '11px',
                    letterSpacing: '0.02em',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Interest Chips */}
        <div className="w-full mb-8">
          <label
            className="font-mono text-[10px] uppercase tracking-[0.08em] mb-2 block"
            style={{ color: 'var(--nd-text-secondary)' }}
          >
            What do you want help with first?
          </label>
          <div className="flex flex-wrap gap-2">
            {INTERESTS.map((interest) => {
              const isSelected = selectedInterests.includes(interest.value);
              return (
                <button
                  key={interest.value}
                  onClick={() => toggleInterest(interest.value)}
                  aria-pressed={isSelected}
                  className="py-2 px-3 transition-all duration-200"
                  style={{
                    background: isSelected ? 'var(--nd-text-display)' : 'transparent',
                    color: isSelected ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                    border: isSelected ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
                    borderRadius: '999px',
                    fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
                    fontSize: '10px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}
                >
                  {interest.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Finish Setup Button */}
        <button
          onClick={handleFinishSetup}
          disabled={saving}
          className="nd-btn-primary flex items-center justify-center gap-2.5 w-full max-w-xs"
        >
          {saving ? '[SAVING...]' : 'FINISH SETUP'}
          {!saving && <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
        </button>

        {/* Skip Link */}
        <button
          onClick={async () => {
            // Mark setup as skipped so app goes to home on next load
            // (role = 'skipped' signals setup was intentionally skipped)
            try {
              await updateSettings({ role: 'skipped', interests: '' });
              await updateProfile({ status: '' });
              // Clear all AI content caches so no stale/hallucinated data persists
              localStorage.removeItem('syntra_daily_summary_cache');
              localStorage.removeItem('syntra_ai_suggestions_cache');
              localStorage.removeItem('syntra_ai_dynamic_content');
              localStorage.removeItem('syntra_ai_full_content');
            } catch {
              // Proceed even if save fails
            }
            onSkip();
          }}
          className="mt-4 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors duration-200"
          style={{
            color: 'var(--nd-text-disabled)',
            background: 'transparent',
            border: 'none',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
          }}
        >
          Skip
        </button>

        {/* Progress indicators — second square active */}
        <div className="flex items-center gap-2 mt-12">
          <div
            style={{
              width: '4px',
              height: '4px',
              background: 'var(--nd-border-visible)',
            }}
          />
          <div
            style={{
              width: '24px',
              height: '4px',
              background: 'var(--nd-text-display)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
