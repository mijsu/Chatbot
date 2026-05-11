import React from 'react';

/* ─── Mood Glyph Icon Props ─── */

export interface MoodGlyphProps {
  size?: number;
  color?: string;
}

/* ─── Mood Glyph Icons (Nothing monoline style) ─── */

export function MoodGlyphGreat({ size = 24, color = 'currentColor' }: MoodGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.75" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="0.75" fill={color} stroke="none" />
      <path d="M8 15 C9.5 17.5 14.5 17.5 16 15" />
    </svg>
  );
}

export function MoodGlyphGood({ size = 24, color = 'currentColor' }: MoodGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.75" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="0.75" fill={color} stroke="none" />
      <path d="M9 15 C10.5 16.5 13.5 16.5 15 15" />
    </svg>
  );
}

export function MoodGlyphOkay({ size = 24, color = 'currentColor' }: MoodGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.75" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="0.75" fill={color} stroke="none" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

export function MoodGlyphLow({ size = 24, color = 'currentColor' }: MoodGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.75" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="0.75" fill={color} stroke="none" />
      <path d="M9 16 C10.5 14.5 13.5 14.5 15 16" />
    </svg>
  );
}

export function MoodGlyphBad({ size = 24, color = 'currentColor' }: MoodGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="10" r="0.75" fill={color} stroke="none" />
      <circle cx="15" cy="10" r="0.75" fill={color} stroke="none" />
      <path d="M8 16 C9.5 13.5 14.5 13.5 16 16" />
    </svg>
  );
}

/* ─── Mood Glyph Component Map ─── */

export const MOOD_GLYPHS: Record<string, React.FC<MoodGlyphProps>> = {
  great: MoodGlyphGreat,
  good: MoodGlyphGood,
  okay: MoodGlyphOkay,
  low: MoodGlyphLow,
  bad: MoodGlyphBad,
};

/* ─── Mood Constants ─── */

export const MOOD_STATUS_COLORS: Record<string, string> = {
  great: '#FFD600',   // Digital Gold — excellent
  good: '#F7931A',    // Bitcoin Orange — good
  okay: '#EA580C',    // Burnt Orange — neutral
  low: '#EF4444',     // Red — low
  bad: '#EF4444',     // Red — bad
};

export const MOOD_LABELS: Record<string, string> = {
  great: 'GREAT',
  good: 'GOOD',
  okay: 'OKAY',
  low: 'LOW',
  bad: 'BAD',
};

export const MOOD_VALUES = ['great', 'good', 'okay', 'low', 'bad'] as const;
