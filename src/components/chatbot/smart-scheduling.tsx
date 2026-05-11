'use client';

import { useMemo } from 'react';
import type { OfflineMoodEntry, OfflineTask } from '@/lib/offline-db';
import { formatTime12 } from '@/lib/offline-db';

/* ─── Energy Pattern Analysis ─── */

interface EnergyPatterns {
  peakHour: number;
  lowHour: number;
  avgEnergy: number;
  hourlyEnergy: Record<number, number>; // hour → avg energy
}

/**
 * Analyze mood entries to find energy patterns by hour of day.
 * Groups moods by the hour they were created, then finds peak and low energy hours.
 */
export function analyzeEnergyPatterns(moods: OfflineMoodEntry[]): EnergyPatterns {
  if (moods.length === 0) {
    return { peakHour: 10, lowHour: 15, avgEnergy: 3, hourlyEnergy: {} };
  }

  const hourlyBuckets: Record<number, number[]> = {};

  for (const mood of moods) {
    const date = new Date(mood.createdAt);
    const hour = date.getHours();
    if (!hourlyBuckets[hour]) hourlyBuckets[hour] = [];
    hourlyBuckets[hour].push(mood.energy);
  }

  const hourlyEnergy: Record<number, number> = {};
  let totalEnergy = 0;
  let totalCount = 0;

  for (const [hour, energies] of Object.entries(hourlyBuckets)) {
    const avg = energies.reduce((sum, e) => sum + e, 0) / energies.length;
    hourlyEnergy[Number(hour)] = Math.round(avg * 10) / 10;
    totalEnergy += energies.reduce((sum, e) => sum + e, 0);
    totalCount += energies.length;
  }

  let peakHour = 10;
  let lowHour = 15;
  let peakEnergy = -1;
  let lowEnergy = 6;

  for (const [hour, energy] of Object.entries(hourlyEnergy)) {
    if (energy > peakEnergy) {
      peakEnergy = energy;
      peakHour = Number(hour);
    }
    if (energy < lowEnergy) {
      lowEnergy = energy;
      lowHour = Number(hour);
    }
  }

  return {
    peakHour,
    lowHour,
    avgEnergy: totalCount > 0 ? Math.round((totalEnergy / totalCount) * 10) / 10 : 3,
    hourlyEnergy,
  };
}

/* ─── Time Suggestion ─── */

interface TimeSuggestion {
  suggestedHour24: number;  // 24h format, e.g. 14
  suggestedTime: string;    // Display string, e.g. "2:00 PM"
  reason: string;
}

// Category → energy level mapping
const HIGH_FOCUS_CATEGORIES = ['code', 'design'];
const MID_FOCUS_CATEGORIES = ['meeting'];
const LOW_FOCUS_CATEGORIES = ['general', 'personal'];

/**
 * Suggest best time for a task category based on energy patterns.
 * - High-focus tasks (code, design) → peak energy hours
 * - Meetings → mid-energy hours
 * - Admin/general/personal → low-energy hours
 * Avoids conflicts with existing tasks.
 */
export function suggestTimeForCategory(
  category: string,
  energyPatterns: EnergyPatterns,
  existingTasks: OfflineTask[]
): TimeSuggestion | null {
  const { peakHour, lowHour, hourlyEnergy } = energyPatterns;

  // If not enough data, return null (no suggestion)
  if (Object.keys(hourlyEnergy).length === 0) return null;

  // Determine target hour based on category
  let targetHour: number;
  let reason: string;

  const cat = category.toLowerCase();

  if (HIGH_FOCUS_CATEGORIES.includes(cat)) {
    targetHour = peakHour;
    reason = 'Peak focus hours — your energy is highest now';
  } else if (MID_FOCUS_CATEGORIES.includes(cat)) {
    // Find a mid-energy hour between peak and low
    const hours = Object.entries(hourlyEnergy).sort((a, b) => b[1] - a[1]);
    const midIndex = Math.floor(hours.length / 2);
    targetHour = hours[midIndex] ? Number(hours[midIndex][0]) : peakHour + 2;
    reason = 'Mid-energy window — good for collaborative work';
  } else {
    targetHour = lowHour;
    reason = 'Low-energy period — ideal for admin & review';
  }

  // Check for conflicts with existing tasks at that hour
  const occupiedHours = new Set<number>();
  for (const task of existingTasks) {
    if (task.time && /^\d{1,2}:\d{2}$/.test(task.time)) {
      const h = parseInt(task.time.split(':')[0], 10);
      occupiedHours.add(h);
    }
  }

  // If target hour is occupied, find nearest available hour
  if (occupiedHours.has(targetHour)) {
    // Search ±1, ±2, ±3 hours
    for (let offset = 1; offset <= 3; offset++) {
      const before = targetHour - offset;
      const after = targetHour + offset;
      if (before >= 6 && !occupiedHours.has(before)) {
        targetHour = before;
        break;
      }
      if (after <= 22 && !occupiedHours.has(after)) {
        targetHour = after;
        break;
      }
    }
  }

  // Clamp to reasonable hours (6 AM - 10 PM)
  targetHour = Math.max(6, Math.min(22, targetHour));

  // Format time string
  const timeStr = formatTime12(`${String(targetHour).padStart(2, '0')}:00`);

  return {
    suggestedHour24: targetHour,
    suggestedTime: timeStr,
    reason,
  };
}

/* ─── SmartSchedulingPanel Component ─── */

interface SmartSchedulingPanelProps {
  category: string;
  moods: OfflineMoodEntry[];
  existingTasks: OfflineTask[];
  onApplySuggestion: (hour24: number) => void;
}

export default function SmartSchedulingPanel({
  category,
  moods,
  existingTasks,
  onApplySuggestion,
}: SmartSchedulingPanelProps) {
  const suggestion = useMemo(() => {
    // Only show if user has at least 3 mood entries
    if (moods.length < 3) return null;
    const patterns = analyzeEnergyPatterns(moods);
    return suggestTimeForCategory(category, patterns, existingTasks);
  }, [category, moods, existingTasks]);

  if (!suggestion) return null;

  return (
    <button
      onClick={() => onApplySuggestion(suggestion.suggestedHour24)}
      className="flex items-center gap-1.5 px-2.5 py-1.5 mt-1 transition-colors duration-200 w-full text-left"
      style={{
        background: 'rgba(247, 147, 26, 0.08)',
        border: '1px solid rgba(247, 147, 26, 0.2)',
        borderRadius: '8px',
        color: '#F7931A',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(247, 147, 26, 0.14)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'rgba(247, 147, 26, 0.08)';
      }}
      aria-label={`Apply suggested time: ${suggestion.suggestedTime}`}
    >
      <span style={{ fontSize: '12px' }}>⚡</span>
      <span className="font-mono text-[10px] uppercase tracking-[0.04em]">
        Best time: {suggestion.suggestedTime}
      </span>
      <span
        className="font-mono text-[9px] ml-1"
        style={{ color: 'rgba(247, 147, 26, 0.6)' }}
      >
        — {suggestion.reason}
      </span>
    </button>
  );
}
