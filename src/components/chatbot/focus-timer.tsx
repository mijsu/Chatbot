'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Square, Settings } from 'lucide-react';
import { useOfflineFocusSessions } from '@/hooks/use-offline-data';
import { playCompletionSound, hapticSuccess } from '@/lib/feedback';

type TimerMode = 'FOCUS' | 'BREAK';

type TimerState = 'idle' | 'running' | 'paused' | 'completed';

/* ─── Circular Progress Ring ─── */

function CircularProgressRing({
  progress,
  mode,
  pulseActive,
  size = 160,
}: {
  progress: number; // 0-1
  mode: TimerMode;
  pulseActive: boolean;
  size?: number;
}) {
  const strokeWidth = size <= 110 ? 3 : 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  const color = mode === 'FOCUS' ? '#EA580C' : '#06B6D4';
  const trackColor = 'var(--nd-border)';

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        style={{ overflow: 'visible' }}
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease',
          }}
        />
      </svg>
      {/* Pulse ring on completion */}
      {pulseActive && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `2px solid ${color}`,
            animation: 'focus-pulse 1.2s ease-out infinite',
          }}
        />
      )}
    </div>
  );
}

/* ─── FocusTimer Component ─── */

export default function FocusTimer({ compact = false }: { compact?: boolean }) {
  const { addSession, getTodayFocusMinutes, reload: reloadSessions } = useOfflineFocusSessions();

  // Timer configuration
  const [focusDuration, setFocusDuration] = useState(25); // minutes
  const [breakDuration, setBreakDuration] = useState(5);  // minutes
  const [showSettings, setShowSettings] = useState(false);

  // Timer state
  const [mode, setMode] = useState<TimerMode>('FOCUS');
  const [state, setState] = useState<TimerState>('idle');
  const [timeRemaining, setTimeRemaining] = useState(25 * 60); // seconds
  const [pulseActive, setPulseActive] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalTimeRef = useRef(25 * 60);

  // Load today's focus minutes
  useEffect(() => {
    setTodayMinutes(getTodayFocusMinutes());
  }, [getTodayFocusMinutes]);

  const handleTimerComplete = useCallback(async () => {
    setState('completed');
    setPulseActive(true);

    playCompletionSound();
    hapticSuccess();

    // Save session to DB
    const durationMin = mode === 'FOCUS' ? focusDuration : breakDuration;
    await addSession({
      duration: durationMin,
      completedAt: new Date(),
      type: mode.toLowerCase(),
      taskId: '',
    });

    // Update today minutes
    await reloadSessions();
    setTodayMinutes(getTodayFocusMinutes());

    // Stop pulse after 3 seconds
    setTimeout(() => setPulseActive(false), 3000);

    // Auto-switch mode after a brief pause
    setTimeout(() => {
      if (mode === 'FOCUS') {
        setMode('BREAK');
        setTimeRemaining(breakDuration * 60);
        totalTimeRef.current = breakDuration * 60;
      } else {
        setMode('FOCUS');
        setTimeRemaining(focusDuration * 60);
        totalTimeRef.current = focusDuration * 60;
      }
      setState('idle');
    }, 2500);
  }, [mode, focusDuration, breakDuration, addSession]);

  // Start interval when running
  useEffect(() => {
    if (state === 'running') {
      intervalRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            // Timer completed
            clearInterval(intervalRef.current!);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [state, handleTimerComplete]);

  const handleStart = useCallback(() => {
    if (state === 'idle' || state === 'completed') {
      totalTimeRef.current = (mode === 'FOCUS' ? focusDuration : breakDuration) * 60;
      if (timeRemaining === 0 || timeRemaining === totalTimeRef.current) {
        setTimeRemaining(totalTimeRef.current);
      }
    }
    setState('running');
  }, [state, mode, focusDuration, breakDuration, timeRemaining]);

  const handlePause = useCallback(() => {
    setState('paused');
  }, []);

  const handleStop = useCallback(() => {
    setState('idle');
    setMode('FOCUS');
    setTimeRemaining(focusDuration * 60);
    totalTimeRef.current = focusDuration * 60;
  }, [focusDuration]);

  const handleReset = useCallback(() => {
    const dur = (mode === 'FOCUS' ? focusDuration : breakDuration) * 60;
    setTimeRemaining(dur);
    totalTimeRef.current = dur;
    setState('idle');
  }, [mode, focusDuration, breakDuration]);

  // Format time as MM:SS
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Progress for ring
  const totalTime = (mode === 'FOCUS' ? focusDuration : breakDuration) * 60;
  const progress = totalTime > 0 ? 1 - timeRemaining / totalTime : 0;

  // Mode color
  const modeColor = mode === 'FOCUS' ? '#EA580C' : '#06B6D4';

  // Compact sizing
  const ringSize = compact ? 100 : 160;
  const timeFontSize = compact ? '22px' : '32px';
  const btnSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const btnIconSize = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const smallBtnSize = compact ? 'w-7 h-7' : 'w-8 h-8';
  const smallBtnIcon = compact ? 'w-3 h-3' : 'w-3.5 h-3.5';

  return (
    <>
      {/* CSS for pulse animation */}
      <style>{`
        @keyframes focus-pulse {
          0% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.08); opacity: 0.4; }
          100% { transform: scale(1.15); opacity: 0; }
        }
      `}</style>

      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--nd-surface)',
          border: '1px solid var(--nd-border)',
        }}
      >
        {/* Header */}
        <div className={`${compact ? 'px-3 pt-2.5' : 'px-4 pt-3'} pb-0 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <span
              className="font-mono uppercase"
              style={{
                fontSize: compact ? '8px' : '9px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-secondary)',
              }}
            >
              FOCUS TIMER
            </span>
            <span
              style={{
                width: '3px',
                height: '3px',
                borderRadius: '50%',
                background: state === 'running' ? modeColor : 'var(--nd-text-disabled)',
                animation: state === 'running' ? 'pulse-dot 2s ease-in-out infinite' : 'none',
              }}
            />
          </div>
          {!compact && (
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1 transition-colors duration-150"
              style={{ color: 'var(--nd-text-disabled)' }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-primary)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
              }}
              aria-label="Timer settings"
            >
              <Settings className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Settings panel (collapsible) — only in full mode */}
        {!compact && showSettings && (
          <div
            className="mx-4 mt-2 p-3 rounded-lg"
            style={{
              background: 'var(--nd-surface-raised, rgba(255,255,255,0.04))',
              border: '1px solid var(--nd-border)',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: 'var(--nd-text-secondary)',
                }}
              >
                FOCUS DURATION
              </span>
              <div className="flex items-center gap-1">
                {[15, 25, 30, 45].map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setFocusDuration(d);
                      if (mode === 'FOCUS' && state === 'idle') {
                        setTimeRemaining(d * 60);
                        totalTimeRef.current = d * 60;
                      }
                    }}
                    className="font-mono px-2 py-1 transition-colors duration-150"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                      background: focusDuration === d ? 'var(--nd-text-display)' : 'transparent',
                      color: focusDuration === d ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: `1px solid ${focusDuration === d ? 'var(--nd-text-display)' : 'var(--nd-border)'}`,
                      borderRadius: '2px',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="font-mono uppercase"
                style={{
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: 'var(--nd-text-secondary)',
                }}
              >
                BREAK DURATION
              </span>
              <div className="flex items-center gap-1">
                {[3, 5, 10, 15].map(d => (
                  <button
                    key={d}
                    onClick={() => {
                      setBreakDuration(d);
                      if (mode === 'BREAK' && state === 'idle') {
                        setTimeRemaining(d * 60);
                        totalTimeRef.current = d * 60;
                      }
                    }}
                    className="font-mono px-2 py-1 transition-colors duration-150"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.04em',
                      background: breakDuration === d ? 'var(--nd-text-display)' : 'transparent',
                      color: breakDuration === d ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                      border: `1px solid ${breakDuration === d ? 'var(--nd-text-display)' : 'var(--nd-border)'}`,
                      borderRadius: '2px',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compact settings — duration selector inline */}
        {compact && (
          <div className="px-3 pt-1.5 pb-0 flex items-center gap-1">
            {[15, 25, 30, 45].map(d => (
              <button
                key={d}
                onClick={() => {
                  setFocusDuration(d);
                  if (mode === 'FOCUS' && state === 'idle') {
                    setTimeRemaining(d * 60);
                    totalTimeRef.current = d * 60;
                  }
                }}
                className="font-mono px-1.5 py-0.5 transition-colors duration-150"
                style={{
                  fontSize: '8px',
                  letterSpacing: '0.04em',
                  background: focusDuration === d ? 'var(--nd-text-display)' : 'transparent',
                  color: focusDuration === d ? 'var(--nd-black)' : 'var(--nd-text-disabled)',
                  border: `1px solid ${focusDuration === d ? 'var(--nd-text-display)' : 'var(--nd-border)'}`,
                  borderRadius: '2px',
                }}
              >
                {d}M
              </button>
            ))}
          </div>
        )}

        {/* Timer body - centered circular timer */}
        <div className={`flex flex-col items-center ${compact ? 'py-2' : 'py-4'}`}>
          {/* Mode label */}
          <span
            className="font-mono uppercase mb-1"
            style={{
              fontSize: compact ? '8px' : '10px',
              letterSpacing: '0.08em',
              color: modeColor,
            }}
          >
            {mode}
          </span>

          {/* Circular progress with time display */}
          <div className="relative flex items-center justify-center">
            <CircularProgressRing
              progress={progress}
              mode={mode}
              pulseActive={pulseActive}
              size={ringSize}
            />
            {/* Time display overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-mono leading-none"
                style={{
                  fontSize: timeFontSize,
                  fontWeight: 700,
                  color: 'var(--nd-text-display)',
                  letterSpacing: '-0.03em',
                }}
              >
                {displayTime}
              </span>
              <span
                className="font-mono uppercase mt-0.5"
                style={{
                  fontSize: compact ? '7px' : '8px',
                  letterSpacing: '0.1em',
                  color: 'var(--nd-text-disabled)',
                }}
              >
                {state === 'running' ? 'REMAINING' : state === 'paused' ? 'PAUSED' : state === 'completed' ? 'DONE' : 'READY'}
              </span>
            </div>
          </div>

          {/* Control buttons */}
          <div className={`flex items-center gap-2 ${compact ? 'mt-2' : 'mt-4 gap-3'}`}>
            {state === 'idle' || state === 'completed' ? (
              <button
                onClick={handleStart}
                className={`flex items-center justify-center ${btnSize} rounded-full transition-colors duration-150`}
                style={{
                  background: modeColor,
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                aria-label="Start timer"
              >
                <Play className={btnIconSize} style={{ marginLeft: '1px' }} strokeWidth={2} />
              </button>
            ) : state === 'running' ? (
              <button
                onClick={handlePause}
                className={`flex items-center justify-center ${btnSize} rounded-full transition-colors duration-150`}
                style={{
                  background: 'var(--nd-surface-raised, rgba(255,255,255,0.08))',
                  color: 'var(--nd-text-primary)',
                  border: '1px solid var(--nd-border-visible)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border-visible)';
                }}
                aria-label="Pause timer"
              >
                <Pause className={btnIconSize} strokeWidth={2} />
              </button>
            ) : (
              /* paused */
              <button
                onClick={handleStart}
                className={`flex items-center justify-center ${btnSize} rounded-full transition-colors duration-150`}
                style={{
                  background: modeColor,
                  color: '#fff',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.opacity = '1';
                }}
                aria-label="Resume timer"
              >
                <Play className={btnIconSize} style={{ marginLeft: '1px' }} strokeWidth={2} />
              </button>
            )}

            {state !== 'idle' && (
              <button
                onClick={handleReset}
                className={`flex items-center justify-center ${smallBtnSize} rounded-full transition-colors duration-150`}
                style={{
                  background: 'transparent',
                  color: 'var(--nd-text-disabled)',
                  border: '1px solid var(--nd-border)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-primary)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
                }}
                aria-label="Reset timer"
              >
                <RotateCcw className={smallBtnIcon} strokeWidth={1.5} />
              </button>
            )}

            {state !== 'idle' && (
              <button
                onClick={handleStop}
                className={`flex items-center justify-center ${smallBtnSize} rounded-full transition-colors duration-150`}
                style={{
                  background: 'transparent',
                  color: 'var(--nd-text-disabled)',
                  border: '1px solid var(--nd-border)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#EF4444';
                  (e.currentTarget as HTMLElement).style.borderColor = '#EF4444';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--nd-text-disabled)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--nd-border)';
                }}
                aria-label="Stop timer"
              >
                <Square className={compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} strokeWidth={2} />
              </button>
            )}
          </div>

          {/* Today's focus summary */}
          {todayMinutes > 0 && (
            <span
              className="font-mono uppercase mt-2"
              style={{
                fontSize: compact ? '7px' : '9px',
                letterSpacing: '0.08em',
                color: 'var(--nd-text-disabled)',
              }}
            >
              {todayMinutes >= 60
                ? `${(todayMinutes / 60).toFixed(1)}H FOCUSED TODAY`
                : `${todayMinutes}MIN FOCUSED TODAY`
              }
            </span>
          )}
        </div>
      </div>
    </>
  );
}
