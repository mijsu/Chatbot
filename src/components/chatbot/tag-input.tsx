'use client';

import { useState, useCallback, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

/* ─── Tag Color System ─── */

const TAG_COLORS = [
  '#F7931A', // Bitcoin Orange
  '#FFD600', // Digital Gold
  '#EA580C', // Burnt Orange
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#A855F7', // Purple
  '#10B981', // Emerald
  '#EF4444', // Red
];

export function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

/**
 * Convert a hex color to rgba with given opacity
 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ─── Tag Pill Component ─── */

function TagPill({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  const color = getTagColor(tag);

  return (
    <span
      className="inline-flex items-center gap-1 shrink-0"
      style={{
        height: '22px',
        borderRadius: '999px',
        background: hexToRgba(color, 0.15),
        color,
        padding: onRemove ? '0 4px 0 8px' : '0 8px',
        fontSize: '9px',
        fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        lineHeight: '22px',
      }}
    >
      {tag}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex items-center justify-center transition-opacity duration-150"
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            background: hexToRgba(color, 0.2),
            color,
            opacity: 0.7,
            lineHeight: 1,
            fontSize: '8px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '1';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = '0.7';
          }}
          aria-label={`Remove tag "${tag}"`}
        >
          <X className="w-2.5 h-2.5" style={{ strokeWidth: 2.5 }} />
        </button>
      )}
    </span>
  );
}

/* ─── TagInput Component ─── */

interface TagInputProps {
  tags: string;           // Comma-separated tag string
  onChange: (tags: string) => void;
  suggestedTags?: string[];
}

export default function TagInput({ tags, onChange, suggestedTags }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const tagList = tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const addTag = useCallback(
    (raw: string) => {
      const newTag = raw.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      if (!newTag) return;
      if (tagList.includes(newTag)) return; // no duplicates
      const updated = tags ? `${tags},${newTag}` : newTag;
      onChange(updated);
      setInputValue('');
    },
    [tags, tagList, onChange]
  );

  const removeTag = useCallback(
    (tagToRemove: string) => {
      const updated = tagList.filter((t) => t !== tagToRemove).join(',');
      onChange(updated);
    },
    [tagList, onChange]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tagList.length > 0) {
      // Remove last tag on backspace when input is empty
      removeTag(tagList[tagList.length - 1]);
    }
  };

  // Filter suggested tags to only show ones not already added
  const availableSuggestions = (suggestedTags || []).filter(
    (s) => !tagList.includes(s.toLowerCase())
  );

  return (
    <div>
      {/* Tag pills + input */}
      <div
        className="flex flex-wrap items-center gap-1.5 px-2.5 py-2 min-h-[36px] cursor-text"
        style={{
          background: 'var(--nd-black)',
          border: '1px solid var(--nd-border)',
          borderRadius: '8px',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {tagList.map((tag) => (
          <TagPill key={tag} tag={tag} onRemove={() => removeTag(tag)} />
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tagList.length === 0 ? 'Add tags (comma or Enter)' : ''}
          className="flex-1 min-w-[80px] bg-transparent font-mono text-xs focus:outline-none"
          style={{
            color: 'var(--nd-text-display)',
            fontSize: '11px',
          }}
        />
      </div>

      {/* Suggested tags */}
      {availableSuggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {availableSuggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => addTag(suggestion)}
              className="transition-opacity duration-150"
              style={{ opacity: 0.7 }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.7';
              }}
              aria-label={`Add tag "${suggestion}"`}
            >
              <TagPill tag={suggestion} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Exported TagPill for reuse ─── */

export { TagPill };
