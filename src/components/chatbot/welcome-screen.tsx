'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Lock, Eye, EyeOff } from 'lucide-react';
import AiOrb from '@/components/chatbot/ai-orb';
import { checkAuth, hasPassword } from '@/lib/offline-db';

interface WelcomeScreenProps {
  onGetStarted: () => void;
  onGoToSetup?: () => void;
}

export default function WelcomeScreen({ onGetStarted, onGoToSetup }: WelcomeScreenProps) {
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordChecked, setPasswordChecked] = useState(false);
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if password is required on mount
  useEffect(() => {
    (async () => {
      const needs = await hasPassword();
      setRequiresPassword(needs);
      setPasswordChecked(true);
    })();
  }, []);

  const handleLogin = async () => {
    if (!pin.trim()) {
      setError('Enter your password');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const valid = await checkAuth(pin);
      if (valid) {
        onGetStarted();
      } else {
        setError('Wrong password');
      }
    } catch {
      setError('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLogin();
    }
  };

  // Show loading while checking password requirement
  if (!passwordChecked) {
    return (
      <div
        className="w-full h-full min-h-screen flex items-center justify-center"
        style={{ background: 'var(--nd-black)' }}
      >
        <div className="flex flex-col items-center gap-4">
          <AiOrb size="lg" animate={true} showIcon={true} />
          <p
            className="font-mono text-[11px] uppercase tracking-[0.08em]"
            style={{ color: 'var(--nd-text-secondary)' }}
          >
            Checking...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full min-h-screen relative flex items-center justify-center overflow-hidden"
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
      <div className="relative z-10 max-w-sm w-full px-6 flex flex-col items-center">
        {/* AI Orb — center piece */}
        <div className="mb-10">
          <AiOrb size="xl" animate={true} showIcon={true} />
        </div>

        {/* Title: SYNTRA — large display, tight letter-spacing */}
        <h1
          className="text-center leading-none mb-2"
          style={{
            fontFamily: 'var(--font-space-grotesk), "Space Grotesk", sans-serif',
            fontSize: '42px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--nd-text-display)',
          }}
        >
          SYNTRA
        </h1>

        {/* Tagline: ALL CAPS Space Mono label */}
        <p
          className="text-center mb-6"
          style={{
            fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
            fontSize: '11px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--nd-text-secondary)',
          }}
        >
          YOUR PERSONAL ASSISTANT
        </p>

        {/* Description in secondary text */}
        <p
          className="text-center text-sm leading-relaxed mb-8 max-w-xs"
          style={{
            color: 'var(--nd-text-secondary)',
          }}
        >
          {requiresPassword
            ? 'Enter your password to continue.'
            : 'Experience intelligent conversations that understand your needs and help you achieve more every day.'}
        </p>

        {/* Login form (when password is set) */}
        {requiresPassword ? (
          <div className="w-full max-w-xs space-y-3">
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }}
              />
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                onKeyDown={handleKeyDown}
                placeholder="Password"
                className="w-full pl-10 pr-10 py-3 text-sm font-mono outline-none focus:outline-none"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: error
                    ? '1px solid var(--nd-accent)'
                    : '1px solid var(--nd-border-visible)',
                  borderRadius: '10px',
                  color: 'var(--nd-text-display)',
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                aria-label="Toggle password visibility"
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--nd-text-secondary)' }}
              >
                {showPin ? (
                  <EyeOff className="w-4 h-4" strokeWidth={1.5} />
                ) : (
                  <Eye className="w-4 h-4" strokeWidth={1.5} />
                )}
              </button>
            </div>

            {error && (
              <p
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-center"
                style={{ color: 'var(--nd-accent)' }}
              >
                [{error.toUpperCase()}]
              </p>
            )}

            <button
              onClick={handleLogin}
              disabled={loading}
              className="nd-btn-primary flex items-center justify-center gap-2.5 w-full"
            >
              {loading ? '[VERIFYING...]' : 'UNLOCK'}
              {!loading && <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
            </button>
          </div>
        ) : (
          <>
            {/* Get Started button — nd-btn-primary style */}
            <button
              onClick={onGoToSetup || onGetStarted}
              className="nd-btn-primary flex items-center justify-center gap-2.5 w-full max-w-xs"
            >
              GET STARTED
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </>
        )}

        {/* Progress indicators — small squares, first active */}
        <div className="flex items-center gap-2 mt-12">
          <div
            style={{
              width: '24px',
              height: '4px',
              background: 'var(--nd-text-display)',
            }}
          />
          <div
            style={{
              width: '4px',
              height: '4px',
              background: 'var(--nd-border-visible)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
