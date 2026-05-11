'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Search,
  X,
  CheckSquare,
  Bell,
  MessageCircle,
  Target,
  Flame,
} from 'lucide-react';
import { db } from '@/lib/offline-db';
import type {
  OfflineTask,
  OfflineReminder,
  OfflineConversation,
  OfflineHabit,
  OfflineGoal,
} from '@/lib/offline-db';

/* ─── Types ─── */

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: string) => void;
}

type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  type: 'task' | 'reminder' | 'chat' | 'habit' | 'goal';
};

type GroupedResults = {
  label: string;
  icon: React.ReactNode;
  items: SearchResultItem[];
};

/* ─── Helpers ─── */

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ─── Component ─── */

export default function GlobalSearch({ isOpen, onClose, onNavigate }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GroupedResults[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [totalResults, setTotalResults] = useState(0);

  // Refs
  const flatItems = useRef<SearchResultItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const prevIsOpen = useRef(false);

  // Effective results: show searchResults if query exists, otherwise empty
  const results = useMemo(() => {
    if (!debouncedQuery.trim()) return [];
    return searchResults;
  }, [debouncedQuery, searchResults]);

  // Debounce query — 200ms
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Load & filter data when debounced query changes (only when query is non-empty)
  useEffect(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return;

    const regex = new RegExp(escapeRegex(q), 'i');

    let cancelled = false;

    const loadAndFilter = async () => {
      const [tasks, reminders, conversations, habits, goals]: [
        OfflineTask[],
        OfflineReminder[],
        OfflineConversation[],
        OfflineHabit[],
        OfflineGoal[],
      ] = await Promise.all([
        db.tasks.toArray(),
        db.reminders.toArray(),
        db.conversations.toArray(),
        db.habits.toArray(),
        db.goals.toArray(),
      ]);

      if (cancelled) return;

      const filterList = <T extends { title: string; description?: string }>(
        list: T[],
        type: SearchResultItem['type'],
        getSubtitle: (item: T) => string,
      ): SearchResultItem[] =>
        list
          .filter((item) => regex.test(item.title) || (item.description && regex.test(item.description)))
          .map((item) => ({
            id: item.id,
            title: item.title,
            subtitle: getSubtitle(item),
            type,
          }));

      const taskResults = filterList(tasks, 'task', (t) =>
        t.completed ? 'Completed' : `${t.category || 'general'} · ${t.priority || 'medium'}`,
      );

      const reminderResults = filterList(reminders, 'reminder', (r) =>
        r.completed ? 'Completed' : r.recurring ? `Recurring ${r.recurring}` : r.time || 'One-time',
      );

      const chatResults = filterList(conversations, 'chat', () => 'Conversation');

      const habitResults = filterList(habits, 'habit', (h) =>
        `${h.frequency || 'daily'} · ${h.streak} streak`,
      );

      const goalResults = filterList(goals, 'goal', (g) =>
        g.completed ? 'Completed' : `${g.category || 'general'} · ${g.progress}%`,
      );

      const groups: GroupedResults[] = [];

      if (taskResults.length > 0) {
        groups.push({
          label: 'TASKS',
          icon: <CheckSquare className="w-3.5 h-3.5" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />,
          items: taskResults,
        });
      }
      if (reminderResults.length > 0) {
        groups.push({
          label: 'REMINDERS',
          icon: <Bell className="w-3.5 h-3.5" style={{ color: 'var(--nd-interactive)', strokeWidth: 1.5 }} />,
          items: reminderResults,
        });
      }
      if (habitResults.length > 0) {
        groups.push({
          label: 'HABITS',
          icon: <Flame className="w-3.5 h-3.5" style={{ color: 'var(--nd-warning)', strokeWidth: 1.5 }} />,
          items: habitResults,
        });
      }
      if (goalResults.length > 0) {
        groups.push({
          label: 'GOALS',
          icon: <Target className="w-3.5 h-3.5" style={{ color: 'var(--nd-success)', strokeWidth: 1.5 }} />,
          items: goalResults,
        });
      }
      if (chatResults.length > 0) {
        groups.push({
          label: 'CHATS',
          icon: <MessageCircle className="w-3.5 h-3.5" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />,
          items: chatResults,
        });
      }

      // Build flat list for keyboard navigation
      const flat: SearchResultItem[] = [];
      for (const g of groups) {
        for (const item of g.items) {
          flat.push(item);
        }
      }
      flatItems.current = flat;
      setSearchResults(groups);
      setTotalResults(flat.length);
      setSelectedIndex(0);
    };

    loadAndFilter();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  // Focus input on open; handle close reset via ref tracking
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      // Just opened — focus the input
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    if (!isOpen && prevIsOpen.current) {
      // Just closed — reset is handled by the close handler directly
      flatItems.current = [];
    }
    prevIsOpen.current = isOpen;
  }, [isOpen]);

  // Close handler that also resets state (avoids setState in effect)
  const handleClose = useCallback(() => {
    setQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
    setTotalResults(0);
    flatItems.current = [];
    onClose();
  }, [onClose]);

  // Handle result click
  const handleSelect = useCallback(
    (item: SearchResultItem) => {
      switch (item.type) {
        case 'task':
        case 'habit':
        case 'goal':
          onNavigate('planner');
          break;
        case 'reminder':
          onNavigate('friends');
          break;
        case 'chat':
          onNavigate('chats');
          break;
      }
      handleClose();
    },
    [onNavigate, handleClose],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      const total = flatItems.current.length;
      if (total === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % total);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + total) % total);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = flatItems.current[selectedIndex];
        if (item) handleSelect(item);
      }
    },
    [handleClose, selectedIndex, handleSelect],
  );

  // Scroll selected item into view
  useEffect(() => {
    if (!isOpen) return;
    const el = document.querySelector(`[data-search-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, selectedIndex]);

  // Build running index for selected state
  let runningIndex = 0;

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
        onClick={handleClose}
      />

      {/* Overlay */}
      <div
        className="fixed inset-x-0 top-0 z-50 flex flex-col"
        style={{
          maxHeight: '85vh',
          background: 'var(--nd-black)',
          borderBottom: '1px solid var(--nd-border-visible)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{ borderBottom: '1px solid var(--nd-border)' }}
        >
          <Search
            className="w-5 h-5 shrink-0"
            style={{ color: 'var(--nd-text-disabled)', strokeWidth: 1.5 }}
          />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tasks, reminders, habits, goals, chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent font-mono text-sm focus:outline-none"
            style={{ color: 'var(--nd-text-primary)' }}
          />
          <button
            onClick={handleClose}
            className="shrink-0 p-1 rounded transition-colors"
            style={{ color: 'var(--nd-text-disabled)' }}
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-3 max-h-[70vh] scrollbar-hide">
          {debouncedQuery.trim() && results.length === 0 && (
            <div className="text-center py-12">
              <p
                className="font-mono text-sm"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                No results found
              </p>
            </div>
          )}

          {!debouncedQuery.trim() && (
            <div className="text-center py-12">
              <Search
                className="w-8 h-8 mx-auto mb-3"
                style={{ color: 'var(--nd-border-visible)', strokeWidth: 1 }}
              />
              <p
                className="font-mono text-sm"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                Type to search across all your data
              </p>
              <p
                className="font-mono text-xs mt-2"
                style={{ color: 'var(--nd-text-disabled)', opacity: 0.6 }}
              >
                ⌘K to open · Esc to close
              </p>
            </div>
          )}

          {results.map((group) => {
            const groupStartIndex = runningIndex;
            return (
              <div key={group.label} className="mb-4">
                {/* Group Header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  {group.icon}
                  <span
                    className="font-mono uppercase"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.1em',
                      color: 'var(--nd-text-secondary)',
                    }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="font-mono"
                    style={{
                      fontSize: '10px',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    {group.items.length}
                  </span>
                </div>

                {/* Group Items */}
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border)',
                  }}
                >
                  {group.items.map((item, i) => {
                    const itemIndex = groupStartIndex + i;
                    const isSelected = itemIndex === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-search-index={itemIndex}
                        onClick={() => handleSelect(item)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors duration-100"
                        style={{
                          background: isSelected ? 'var(--nd-surface-raised)' : 'transparent',
                          borderBottom:
                            i < group.items.length - 1 ? '1px solid var(--nd-border)' : 'none',
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                      >
                        {/* Type indicator dot */}
                        <span
                          className="shrink-0 rounded-full"
                          style={{
                            width: '6px',
                            height: '6px',
                            background:
                              item.type === 'task'
                                ? 'var(--nd-accent)'
                                : item.type === 'reminder'
                                  ? 'var(--nd-interactive)'
                                  : item.type === 'habit'
                                    ? 'var(--nd-warning)'
                                    : item.type === 'goal'
                                      ? 'var(--nd-success)'
                                      : 'var(--nd-text-secondary)',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className="font-mono text-sm truncate"
                            style={{
                              color: 'var(--nd-text-primary)',
                            }}
                          >
                            {item.title}
                          </p>
                          <p
                            className="font-mono text-xs truncate mt-0.5"
                            style={{ color: 'var(--nd-text-disabled)' }}
                          >
                            {item.subtitle}
                          </p>
                        </div>
                        {isSelected && (
                          <span
                            className="shrink-0 font-mono text-xs"
                            style={{ color: 'var(--nd-text-disabled)' }}
                          >
                            ↵
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        {results.length > 0 && (
          <div
            className="px-5 py-2 flex items-center justify-between"
            style={{
              borderTop: '1px solid var(--nd-border)',
            }}
          >
            <span
              className="font-mono"
              style={{ fontSize: '10px', color: 'var(--nd-text-disabled)' }}
            >
              ↑↓ Navigate · ↵ Select · Esc Close
            </span>
            <span
              className="font-mono"
              style={{ fontSize: '10px', color: 'var(--nd-text-disabled)' }}
            >
              {totalResults} result{totalResults !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </>
  );
}
