'use client';

import { getTagColor, TagPill } from '@/components/chatbot/tag-input';

/* ─── TagFilter Component ─── */

interface TagFilterProps {
  availableTags: string[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

export default function TagFilter({ availableTags, selectedTag, onSelectTag }: TagFilterProps) {
  if (availableTags.length === 0) return null;

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide items-center">
      {/* ALL pill */}
      <button
        onClick={() => onSelectTag(null)}
        className="shrink-0 transition-all duration-200"
        style={{
          height: '24px',
          borderRadius: '999px',
          padding: '0 10px',
          background: selectedTag === null ? 'var(--nd-text-display)' : 'transparent',
          color: selectedTag === null ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
          border: selectedTag === null ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border-visible)',
          fontSize: '9px',
          fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          lineHeight: '24px',
        }}
        aria-label="Show all tags"
        aria-pressed={selectedTag === null}
      >
        ALL
      </button>

      {/* Tag pills */}
      {availableTags.map((tag) => {
        const isActive = selectedTag === tag;
        const color = getTagColor(tag);

        return (
          <button
            key={tag}
            onClick={() => onSelectTag(isActive ? null : tag)}
            className="shrink-0 transition-all duration-200"
            style={{
              height: '24px',
              borderRadius: '999px',
              padding: '0 10px',
              background: isActive ? color : 'transparent',
              color: isActive ? '#000' : color,
              border: isActive ? `1px solid ${color}` : '1px solid var(--nd-border-visible)',
              fontSize: '9px',
              fontFamily: 'var(--font-space-mono), "Space Mono", monospace',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.04em',
              lineHeight: '24px',
            }}
            aria-label={`Filter by tag: ${tag}`}
            aria-pressed={isActive}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}
