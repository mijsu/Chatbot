'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { formatTime12 } from '@/lib/offline-db';
import {
  ChevronLeft,
  ChevronRight,
  Send,
  Sparkles,
  Mic,
  ImageIcon,
  X,
  ListChecks,
  Bell,
  CalendarCheck,
  HelpCircle,
  Command,
  Plus,
  MoreVertical,
  Pin,
  Trash2,
  Clock,
  User,
  Shield,
  BarChart3,
  Volume2,
} from 'lucide-react';
import { useApiConfig } from '@/lib/api-config';
import { useAI } from '@/hooks/use-ai';
import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOfflineConversations, useOfflineMessages, useOfflineTasks, useOfflineReminders, useOfflineProfile, useOfflineSettings, useOfflineGoals, useOfflineHabits, useOfflineMoods } from '@/hooks/use-offline-data';
import { DataValidator, type DataAvailabilityReport } from '@/lib/data-validator';
import { buildSyntraUnifiedContext, serializeContextForPrompt, serializeBasicContextForPrompt, type ContextInputData } from '@/lib/syntra-context-engine';
import { buildAIContext } from '@/lib/ai-context-engine';
import { getAllConversationMemories, getAllGlobalMemories, getRecentConversationSummaries, getHighConfidenceGlobalMemories } from '@/hooks/use-offline-memory';
import { scheduleAppReminder } from '@/lib/context-reminders';

/* ─── Types ─── */

interface Conversation {
  id: string;
  title: string;
  botName: string;
  preview: string;
  time: string;
  icon: string;
  pinned: boolean;
}

interface ChatScreenProps {
  conversation?: Conversation | null;
  onBack: () => void;
  onNavigate?: (page: string) => void;
  onNewChat?: () => void;
  onOpenVoiceModal?: () => void;
  initialMessage?: string;
  onInitialMessageSent?: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  botName?: string;
  type?: 'text' | 'image';
  // Reality-Based Intelligence Protocol metadata
  dataSourcesChecked?: string[];
  wasFiltered?: boolean;
  hallucinationsDetected?: number;
}

/* ─── Command Definitions ─── */

interface CommandDef {
  command: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const COMMANDS: CommandDef[] = [
  {
    command: '/image',
    label: '/image',
    description: 'Generate an image from a description',
    icon: <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />,
  },
  {
    command: '/analyze',
    label: '/analyze',
    description: 'Analyze an uploaded image with AI',
    icon: <ImageIcon className="w-3.5 h-3.5" strokeWidth={1.5} />,
  },
  {
    command: '/task',
    label: '/task',
    description: 'Create a task using AI',
    icon: <ListChecks className="w-3.5 h-3.5" strokeWidth={1.5} />,
  },
  {
    command: '/reminder',
    label: '/reminder',
    description: 'Create a reminder using AI',
    icon: <Bell className="w-3.5 h-3.5" strokeWidth={1.5} />,
  },
  {
    command: '/plan',
    label: '/plan',
    description: 'Generate a daily plan',
    icon: <CalendarCheck className="w-3.5 h-3.5" strokeWidth={1.5} />,
  },
  {
    command: '/help',
    label: '/help',
    description: 'Show all available commands',
    icon: <HelpCircle className="w-3.5 h-3.5" strokeWidth={1.5} />,
  },
];

/* ─── Helpers ─── */

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isImageContent(content: string): boolean {
  return content.startsWith('data:image/');
}

/* ─── Quick Reply Generator ─── */

function generateQuickReplies(text: string): string[] {
  const lower = text.toLowerCase();
  const chips: string[] = [];

  // Keyword-based context-aware suggestions
  const patterns: Array<{ keywords: string[]; suggestions: string[] }> = [
    {
      keywords: ['task', 'todo', 'to-do', 'to do', 'assignment', 'project', 'deadline'],
      suggestions: ['Create a task', 'Add to planner', 'Set a deadline'],
    },
    {
      keywords: ['remind', 'reminder', 'don\'t forget', 'do not forget', 'remember to'],
      suggestions: ['Set a reminder', 'Remind me later', 'Add to reminders'],
    },
    {
      keywords: ['schedule', 'meeting', 'appointment', 'call', 'calendar'],
      suggestions: ['Schedule it', 'Add to calendar', 'Set a reminder'],
    },
    {
      keywords: ['plan', 'organize', 'arrange', 'prepare'],
      suggestions: ['Create a plan', 'Make a task', 'Organize my day'],
    },
    {
      keywords: ['time', 'clock', 'hour', 'minute', 'am ', 'pm ', 'a.m.', 'p.m.'],
      suggestions: ['Set a reminder', 'What time is it?', 'Schedule something'],
    },
    {
      keywords: ['weather', 'rain', 'sun', 'cold', 'hot', 'temperature'],
      suggestions: ['Today\'s forecast', 'Plan my day', 'Set a reminder'],
    },
    {
      keywords: ['email', 'message', 'send', 'write', 'draft'],
      suggestions: ['Help me write it', 'Set a reminder', 'Create a task'],
    },
    {
      keywords: ['learn', 'study', 'read', 'course', 'practice'],
      suggestions: ['Create a study plan', 'Set a study reminder', 'Track my progress'],
    },
    {
      keywords: ['health', 'exercise', 'workout', 'gym', 'diet', 'sleep'],
      suggestions: ['Create a routine', 'Set a reminder', 'Track my habit'],
    },
    {
      keywords: ['buy', 'purchase', 'shop', 'order', 'store'],
      suggestions: ['Add to tasks', 'Set a reminder', 'Create a shopping list'],
    },
  ];

  for (const pattern of patterns) {
    if (chips.length >= 3) break;
    const matches = pattern.keywords.some((kw) => lower.includes(kw));
    if (matches) {
      for (const suggestion of pattern.suggestions) {
        if (chips.length < 3 && !chips.includes(suggestion)) {
          chips.push(suggestion);
        }
      }
    }
  }

  // Default fallback suggestions if no keywords matched
  if (chips.length === 0) {
    chips.push('Tell me more');
    chips.push('Create a task');
    chips.push('Set a reminder');
  }

  // Ensure exactly 3 chips
  while (chips.length < 3) {
    const defaults = ['Tell me more', 'Create a task', 'Set a reminder', 'Make a plan', 'Help me organize'];
    const next = defaults.find((d) => !chips.includes(d));
    if (next) chips.push(next);
    else break;
  }

  return chips.slice(0, 3);
}

/* ─── Actionable Content Detection ─── */

interface ActionableItem {
  detected: boolean;
  phrase: string;
  text: string; // the relevant text around the phrase
}

function detectActionableContent(text: string): ActionableItem {
  const actionPhrases = [
    /remind (?:you|me|us)\s+(?:to\s+)?(.+?)(?:\.|!|$)/i,
    /you should\s+(.+?)(?:\.|!|$)/i,
    /don'?t forget\s+(?:to\s+)?(.+?)(?:\.|!|$)/i,
    /do not forget\s+(?:to\s+)?(.+?)(?:\.|!|$)/i,
    /make sure(?:\s+to)?\s+(.+?)(?:\.|!|$)/i,
    /be sure(?:\s+to)?\s+(.+?)(?:\.|!|$)/i,
    /schedule\s+(.+?)(?:\.|!|$)/i,
    /plan\s+(?:to\s+)?(.+?)(?:\.|!|$)/i,
    /need(?:s)?\s+to\s+(?:be\s+)?(.+?)(?:\.|!|$)/i,
    /remember\s+to\s+(.+?)(?:\.|!|$)/i,
    /it(?:'s| is)\s+(?:important|essential|crucial)\s+(?:to\s+)?(.+?)(?:\.|!|$)/i,
  ];

  for (const regex of actionPhrases) {
    const match = text.match(regex);
    if (match) {
      const fullMatch = match[0].trim();
      const capturedText = match[1] ? match[1].trim() : fullMatch;
      return {
        detected: true,
        phrase: fullMatch,
        text: capturedText.length > 80 ? capturedText.substring(0, 80) + '...' : capturedText,
      };
    }
  }

  return { detected: false, phrase: '', text: '' };
}

function hasTaskablePhrases(text: string): boolean {
  const lower = text.toLowerCase();
  const phrases = [
    'remind you', 'remind me', 'you should', 'don\'t forget', 'do not forget',
    'make sure', 'be sure', 'schedule', 'plan to', 'needs to', 'need to',
    'remember to', 'important to', 'essential to', 'crucial to',
  ];
  return phrases.some((p) => lower.includes(p));
}

/* ─── Natural Language Intent Detection ─── */
/* Detects when the user wants to create tasks, reminders, plans, or images
   from natural language (not just /slash commands). This mirrors the voice
   modal's detectVoiceCommand so chat has the same smart routing.

   Order matters: plan > reminder > task > image > chat
   Plan is checked first because phrases like "make plans and tasks" should
   route to plan (the broader action). Reminder is checked before task because
   "remind me" is more specific than generic task creation. */

type ChatIntent = 'task' | 'reminder' | 'image' | 'plan' | 'chat';

function detectChatIntent(text: string): { type: ChatIntent; description: string } {
  const lower = text.toLowerCase().trim();

  // ─── PLAN INTENT (check first — most specific and broadest action) ───
  const planPatterns = [
    // Direct command patterns at start of message
    /^\s*(plan|create a plan|make a plan|make plans|create plan|prepare a plan|prepare plans|build a plan|generate a plan)\b/i,
    // "plan my/for/the/tomorrow"
    /\bplan\s+(my|for|the|tomorrow|today|this|next|me)\b/i,
    // "make me plans / a plan"
    /\bmake\s+me\s+plans?\b/i,
    // "create/make/prepare/build/generate ... plan(s)/schedule/itinerary"
    /\b(create|make|prepare|build|generate)\s+.*\b(plans?|schedule|itinerary|timetable)\b/i,
    // "plan my day/week/schedule"
    /\b(plan my day|plan my week|plan my schedule|plan for tomorrow|plan for today|plan for next)\b/i,
    // "schedule my day/week"
    /\bschedule\s+(my|the|our)\s+(day|week|morning|afternoon|evening|schedule|time)\b/i,
    // "organize my day/week/schedule"
    /\borganize\s+(my|the|our)\s+(day|week|morning|afternoon|evening|schedule|time)\b/i,
    // "I want/need a plan/schedule"
    /\b(i want|i need|i'd like)\s+(a\s+)?(plan|schedule|itinerary)\b/i,
    // "add ... to my plan" / "for my plan"
    /\badd\s+.*\bto\s+(my\s+)?plan\b/i,
    /\bfor\s+my\s+plan\b/i,
    // "time blocks" / "time-blocked"
    /\btime[- ]?block/i,
    // Polite request forms: "can you plan", "help me plan", "would you create a plan"
    /\b(can you|could you|would you|will you|please|i want you to|i'd like you to|help me)\s+.*\b(plan|schedule|organize)\b/i,
    // "prepare plans/tasks for tomorrow" — even if both words appear, plan takes priority
    /\bprepare\s+.*\bplans?\b/i,
  ];
  for (const pattern of planPatterns) {
    if (lower.match(pattern)) return { type: 'plan', description: text };
  }

  // ─── REMINDER INTENT (checked before task — more specific) ───
  const reminderPatterns = [
    // Direct command at start
    /^\s*(remind me to|remind me|set a reminder|create a reminder|create reminder|set reminder|add a reminder|add reminder|remind)\b/i,
    // "remind me" anywhere
    /\bremind\s+me\b/i,
    // "set/create/add/make a reminder"
    /\b(set|create|add|make)\s+(a\s+)?reminder\b/i,
    // "set me a reminder" / "give me a reminder" / "I need a reminder"
    /\b(set me a reminder|give me a reminder|i need a reminder)\b/i,
    // "don't forget" / "don't let me forget"
    /\bdon'?t\s+(forget|let me forget)\b/i,
    // Polite request forms
    /\b(can you|could you|would you|please|i want you to|help me)\s+.*\b(remind|reminder)\b/i,
  ];
  for (const pattern of reminderPatterns) {
    if (lower.match(pattern)) return { type: 'reminder', description: text };
  }

  // ─── TASK INTENT (checked after plan and reminder) ───
  const taskPatterns = [
    // Direct command at start
    /^\s*(create a task|add a task|new task|create task|add task|make a task|make me a task)\b/i,
    // "create/add/make a task" anywhere
    /\b(create a task|add a task|new task|create task|add task|make a task)\b/i,
    // "add those/these/them to my tasks"
    /\badd\s+(those|these|them|it)\s+to\s+(my\s+)?tasks?\b/i,
    // "I need/have to" — common task phrasing
    /\bi\s+(need|have)\s+to\b/i,
    // "I should" at start
    /^\s*i\s+should\s+/i,
    // Polite request forms
    /\b(can you|could you|would you|please|i want you to|help me)\s+.*\b(tasks?)\b/i,
    // "suggestions for task/tasks"
    /\bsuggestions?\s+for\s+.*\btasks?\b/i,
  ];
  for (const pattern of taskPatterns) {
    if (lower.match(pattern)) return { type: 'task', description: text };
  }

  // ─── IMAGE INTENT ───
  const imagePatterns = [
    // Direct command at start
    /^\s*(generate an image|create an image|draw|generate image|create image|make an image|draw me)\b/i,
    // "generate/create/make an image" anywhere
    /\b(generate an image|create an image|generate image|create image|make an image)\b/i,
    // "draw me" anywhere
    /\bdraw\s+me\b/i,
    // Polite request forms
    /\b(can you|could you|would you|please|i want you to|help me)\s+.*\b(image|picture|photo|drawing|illustration)\b/i,
  ];
  for (const pattern of imagePatterns) {
    if (lower.match(pattern)) return { type: 'image', description: text };
  }

  return { type: 'chat', description: text };
}

/* ─── Markdown-like Formatter ─── */

function FormattedContent({ content, onImageClick }: { content: string; onImageClick?: (src: string) => void }) {
  if (isImageContent(content)) {
    // Content may be: "data:image/...;base64,...\nSome text after"
    // Split on the first newline to separate image data from optional caption
    const newlineIdx = content.indexOf('\n');
    const imageData = newlineIdx >= 0 ? content.slice(0, newlineIdx) : content;
    const caption = newlineIdx >= 0 ? content.slice(newlineIdx + 1).trim() : '';

    return (
      <div className="flex flex-col gap-1">
        <img
          src={imageData}
          alt="Attached image"
          className="max-w-full rounded-lg cursor-pointer"
          style={{ maxHeight: '400px', objectFit: 'contain' }}
          onClick={() => onImageClick?.(imageData)}
        />
        {caption && <span className="text-sm">{caption}</span>}
      </div>
    );
  }

  // Process line by line
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let listKey = 0;
  let numberedIndex = 0;
  let isNumberedList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${listKey++}`} className="my-1 pl-4 space-y-0.5" style={{ listStyleType: isNumberedList ? 'decimal' : 'disc' }}>
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const formatInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Match **bold** patterns
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match;
    let partKey = 0;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={partKey++}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(<strong key={partKey++} className="font-semibold">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(<span key={partKey++}>{text.slice(lastIndex)}</span>);
    }

    return parts.length > 0 ? parts : [text];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trimStart();

    // Numbered list: "1. " or "1) "
    const numberedMatch = trimmedLine.match(/^(\d+)[.)]\s+(.+)$/);
    if (numberedMatch) {
      if (!inList || !isNumberedList) {
        flushList();
        inList = true;
        isNumberedList = true;
        numberedIndex = 0;
      }
      numberedIndex++;
      listItems.push(
        <li key={`num-${i}-${numberedIndex}`} value={parseInt(numberedMatch[1]) || numberedIndex} style={{ color: 'inherit' }}>
          {formatInline(numberedMatch[2])}
        </li>
      );
      continue;
    }

    // Bullet list: "- " or "• " or "* "
    const bulletMatch = trimmedLine.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      if (!inList || isNumberedList) {
        flushList();
        inList = true;
        isNumberedList = false;
      }
      listItems.push(
        <li key={`bullet-${i}`} style={{ color: 'inherit' }}>
          {formatInline(bulletMatch[1])}
        </li>
      );
      continue;
    }

    // Not a list item — flush any open list
    flushList();

    // Empty line
    if (trimmedLine === '') {
      elements.push(<br key={`br-${i}`} />);
      continue;
    }

    // Regular paragraph line
    elements.push(<span key={`line-${i}`}>{formatInline(trimmedLine)}</span>);
    if (i < lines.length - 1) {
      elements.push(<br key={`br2-${i}`} />);
    }
  }

  flushList();

  return <div className="text-sm leading-relaxed">{elements}</div>;
}

/* ─── ConnectionStatus ─── */

function ConnectionStatus() {
  const mode = useApiConfig((s) => s.mode);
  const status = useApiConfig((s) => s.status);

  if (mode === 'default') {
    return (
      <p className="text-xs flex items-center gap-1.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--nd-success)' }}
        />
        <span style={{ color: 'var(--nd-success)' }}>PROVIDER — CONNECTED</span>
      </p>
    );
  }

  const dotColors: Record<string, string> = {
    connected: 'var(--nd-success)',
    testing: 'var(--nd-warning)',
    error: 'var(--nd-accent)',
    disconnected: 'var(--nd-text-secondary)',
  };
  const labels: Record<string, string> = {
    connected: 'CUSTOM \u2014 CONNECTED',
    testing: 'CUSTOM \u2014 TESTING...',
    error: 'CUSTOM \u2014 ERROR',
    disconnected: 'CUSTOM \u2014 NOT TESTED',
  };

  return (
    <p className="text-xs flex items-center gap-1.5 truncate" style={{ color: 'var(--nd-text-secondary)' }}>
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: dotColors[status] || 'var(--nd-text-secondary)' }}
      />
      <span style={{ color: dotColors[status] || 'var(--nd-text-secondary)' }}>
        {labels[status] || 'CUSTOM'}
      </span>
    </p>
  );
}

/* ─── Segmented Typing Indicator ─── */

function TypingIndicator() {
  return (
    <div className="flex gap-[4px] items-center h-5">
      <div
        className="w-[4px] h-3 rounded-none nd-typing-dot-1"
        style={{ backgroundColor: 'var(--nd-text-secondary)' }}
      />
      <div
        className="w-[4px] h-4 rounded-none nd-typing-dot-2"
        style={{ backgroundColor: 'var(--nd-text-secondary)' }}
      />
      <div
        className="w-[4px] h-3 rounded-none nd-typing-dot-3"
        style={{ backgroundColor: 'var(--nd-text-secondary)' }}
      />
    </div>
  );
}

/* ─── Quick Reply Chips ─── */

function QuickReplyChips({ chips, onChipTap }: { chips: string[]; onChipTap: (text: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 sm:gap-1.5 mt-2">
      {chips.map((chip) => (
        <button
          key={chip}
          onClick={() => onChipTap(chip)}
          aria-label={`Suggestion: ${chip}`}
          className="px-3 py-1 text-xs cursor-pointer"
          style={{
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '999px',
            backgroundColor: 'transparent',
            color: 'var(--nd-text-secondary)',
            fontFamily: "'Space Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.02em',
            transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
            e.currentTarget.style.color = 'var(--nd-text-primary)';
            e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--nd-text-secondary)';
            e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
          }}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

/* ─── Smart Action Buttons ─── */

function SmartActionButtons({
  onAddTask,
  onAddReminder,
  onViewPlanner,
  onViewReminders,
}: {
  onAddTask: () => void;
  onAddReminder: () => void;
  onViewPlanner?: () => void;
  onViewReminders?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2 mt-2">
      <button
        onClick={onAddTask}
        className="flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer"
        style={{
          border: '1px solid var(--nd-interactive)',
          borderRadius: '999px',
          backgroundColor: 'rgba(74, 127, 212, 0.08)',
          color: 'var(--nd-interactive)',
          fontFamily: "'Space Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.02em',
          transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(74, 127, 212, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(74, 127, 212, 0.08)';
        }}
      >
        <ListChecks className="w-3 h-3" strokeWidth={1.5} />
        Create Task
      </button>
      {onViewPlanner && (
        <button
          onClick={onViewPlanner}
          className="flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer"
          style={{
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '999px',
            backgroundColor: 'transparent',
            color: 'var(--nd-text-secondary)',
            fontFamily: "'Space Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.02em',
            transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
            e.currentTarget.style.color = 'var(--nd-text-primary)';
            e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--nd-text-secondary)';
            e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
          }}
        >
          <ListChecks className="w-3 h-3" strokeWidth={1.5} />
          View Planner
        </button>
      )}
      <button
        onClick={onAddReminder}
        className="flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer"
        style={{
          border: '1px solid var(--nd-warning)',
          borderRadius: '999px',
          backgroundColor: 'rgba(184, 137, 46, 0.08)',
          color: 'var(--nd-warning)',
          fontFamily: "'Space Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.02em',
          transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(184, 137, 46, 0.18)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(184, 137, 46, 0.08)';
        }}
      >
        <Bell className="w-3 h-3" strokeWidth={1.5} />
        Set Reminder
      </button>
      {onViewReminders && (
        <button
          onClick={onViewReminders}
          className="flex items-center gap-1 px-2.5 py-1 text-xs cursor-pointer"
          style={{
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '999px',
            backgroundColor: 'transparent',
            color: 'var(--nd-text-secondary)',
            fontFamily: "'Space Mono', monospace",
            fontSize: '11px',
            letterSpacing: '0.02em',
            transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
            e.currentTarget.style.color = 'var(--nd-text-primary)';
            e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--nd-text-secondary)';
            e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
          }}
        >
          <Bell className="w-3 h-3" strokeWidth={1.5} />
          View Reminders
        </button>
      )}
    </div>
  );
}

/* ─── Auto-Task Detection Banner ─── */

function AutoTaskBanner({
  actionText,
  onAdd,
  onDismiss,
  onViewPlanner,
}: {
  actionText: string;
  onAdd: () => void;
  onDismiss: () => void;
  onViewPlanner?: () => void;
}) {
  return (
    <div
      className="mt-2 flex items-center gap-2 px-3 py-2 nd-fade-in"
      style={{
        border: '1px solid var(--nd-border-visible)',
        borderRadius: '8px',
        backgroundColor: 'var(--nd-surface)',
      }}
    >
      <Sparkles className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.5} style={{ color: 'var(--nd-interactive)' }} />
      <span
        className="flex-1 text-xs truncate"
        style={{
          color: 'var(--nd-text-secondary)',
          fontFamily: "'Space Mono', monospace",
          fontSize: '11px',
          letterSpacing: '0.02em',
        }}
      >
        Syntra detected an action item. Add to tasks?
      </span>
      {onViewPlanner && (
        <button
          onClick={onViewPlanner}
          className="flex items-center gap-1 px-2 py-0.5 cursor-pointer flex-shrink-0"
          style={{
            border: '1px solid var(--nd-border-visible)',
            borderRadius: '999px',
            backgroundColor: 'transparent',
            color: 'var(--nd-text-secondary)',
            fontFamily: "'Space Mono', monospace",
            fontSize: '10px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
            e.currentTarget.style.color = 'var(--nd-text-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--nd-text-secondary)';
          }}
        >
          <ListChecks className="w-3 h-3" strokeWidth={1.5} />
          View
        </button>
      )}
      <button
        onClick={onAdd}
        className="flex items-center gap-1 px-2 py-0.5 cursor-pointer flex-shrink-0"
        style={{
          border: '1px solid var(--nd-interactive)',
          borderRadius: '999px',
          backgroundColor: 'rgba(74, 127, 212, 0.1)',
          color: 'var(--nd-interactive)',
          fontFamily: "'Space Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase' as const,
          transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(74, 127, 212, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(74, 127, 212, 0.1)';
        }}
      >
        <Plus className="w-3 h-3" strokeWidth={1.5} />
        Add
      </button>
      <button
        onClick={onDismiss}
        className="cursor-pointer flex-shrink-0"
        style={{
          color: 'var(--nd-text-disabled)',
          transition: 'color 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--nd-text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--nd-text-disabled)';
        }}
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ─── Navigation Chip ─── */

function NavigationChip({ label, onNavigate }: { label: string; onNavigate: () => void }) {
  return (
    <button
      onClick={onNavigate}
      className="flex items-center gap-1 px-2.5 py-1 mt-1 cursor-pointer"
      style={{
        border: '1px solid var(--nd-interactive)',
        borderRadius: '999px',
        backgroundColor: 'rgba(74, 127, 212, 0.08)',
        color: 'var(--nd-interactive)',
        fontFamily: "'Space Mono', monospace",
        fontSize: '11px',
        letterSpacing: '0.02em',
        transition: 'all 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(74, 127, 212, 0.18)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(74, 127, 212, 0.08)';
      }}
    >
      <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
      {label}
    </button>
  );
}

/* ─── Toast Notification ─── */

function ToastNotification({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 nd-fade-in"
      style={{
        backgroundColor: 'var(--nd-success)',
        color: 'white',
        borderRadius: '999px',
        fontFamily: "'Space Mono', monospace",
        fontSize: '12px',
        letterSpacing: '0.04em',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      }}
    >
      {message}
    </div>
  );
}

/* ─── ChatScreen ─── */

export default function ChatScreen({ conversation, onBack, onNavigate, onOpenVoiceModal, initialMessage, onInitialMessageSent }: ChatScreenProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showCommandHints, setShowCommandHints] = useState(false);
  const [dismissedBanners, setDismissedBanners] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [navChip, setNavChip] = useState<{ target: string; label: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageSentRef = useRef<string | null>(null);
  const handleSendRef = useRef<(overrideText?: string) => Promise<void>>((_overrideText?: string) => Promise.resolve());
  const commandHintRef = useRef<HTMLDivElement>(null);
  const { getEndpoint, getModelName, getApiKey } = useAI();
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { messages: offlineMessages, addMessage: addOfflineMessage } = useOfflineMessages(conversation?.id || undefined);
  const { updateConversation, conversations: offlineConversations } = useOfflineConversations();
  const { tasks: allTasks, addTask: addOfflineTask } = useOfflineTasks();
  const { reminders: allReminders, addReminder: addOfflineReminder } = useOfflineReminders();
  const { profile } = useOfflineProfile();
  const { settings } = useOfflineSettings();
  const { goals } = useOfflineGoals();
  const { habits } = useOfflineHabits();
  const { moods } = useOfflineMoods();

  // Build user context for personalized AI calls (legacy - used by non-chat AI features)
  const getUserContext = useCallback(() => {
    const today = getToday();
    const todayMood = moods.find(m => m.date === today);
    return {
      name: profile.name || 'User',
      aboutMe: profile.aboutMe || '',
      role: settings.role || '',
      interests: settings.interests || '',
      activeGoals: goals.filter(g => !g.completed).map(g => g.title),
      todayHabits: habits.map(h => ({
        title: h.title,
        streak: h.streak,
        done: h.lastCompletedDate === today,
      })),
      mood: todayMood?.mood,
      energy: todayMood?.energy,
    };
  }, [profile, settings, goals, habits, moods]);

  // Phase 2: Build unified context string for omniscient AI
  const buildUnifiedContextString = useCallback(async (): Promise<{ contextString: string; deepContextMode: boolean }> => {
    const deepContextMode = settings.deepContextMode !== false; // Default to true
    try {
      // Gather memory data
      const currentConvMemories = conversation?.id ? await getAllConversationMemories(conversation.id) : [];
      const recentSummaries = await getRecentConversationSummaries(5);
      const globalMemories = deepContextMode ? await getHighConfidenceGlobalMemories(0.3) : [];

      const contextInput: ContextInputData = {
        profile,
        settings,
        tasks: allTasks,
        reminders: allReminders,
        goals,
        habits,
        moods,
        recentMessages: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        conversationMemories: [...currentConvMemories, ...recentSummaries],
        globalMemories,
        deepContextMode,
      };

      const unifiedContext = buildSyntraUnifiedContext(contextInput);

      if (deepContextMode) {
        return { contextString: serializeContextForPrompt(unifiedContext), deepContextMode: true };
      } else {
        return { contextString: serializeBasicContextForPrompt(unifiedContext), deepContextMode: false };
      }
    } catch (error) {
      console.error('[buildUnifiedContextString] Error building context:', error);
      // Fallback to basic context
      return { contextString: '', deepContextMode: false };
    }
  }, [profile, settings, allTasks, allReminders, goals, habits, moods, messages, conversation?.id]);

  // Reality-Based Intelligence Protocol: Build DataAvailabilityReport object and string
  const buildDataAvailabilityReport = useCallback((): { reportObj: DataAvailabilityReport; reportString: string } | null => {
    try {
      const reportObj = DataValidator.generateAvailabilityReport(
        allTasks, allReminders, goals, habits, moods, profile, settings, offlineConversations
      );
      const reportString = DataValidator.buildAntiHallucinationContext(reportObj);
      return { reportObj, reportString };
    } catch (error) {
      console.error('[buildDataAvailabilityReport] Error:', error);
      return null;
    }
  }, [allTasks, allReminders, goals, habits, moods, profile, settings, offlineConversations]);

  // Build user data context using buildAIContext from ai-context-engine
  const buildUserDataContextString = useCallback((): string => {
    try {
      return buildAIContext({
        profile,
        settings,
        tasks: allTasks,
        reminders: allReminders,
        goals,
        habits,
        moods,
      });
    } catch (error) {
      console.error('[buildUserDataContextString] Error:', error);
      return '';
    }
  }, [profile, settings, allTasks, allReminders, goals, habits, moods]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2000);
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, isSpeaking, scrollToBottom]);

  // Sync messages from offline hook when conversation changes
  useEffect(() => {
    setMessages(
      offlineMessages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        botName: m.role === 'assistant' ? (conversation?.botName || 'Syntra') : undefined,
        type: m.content?.startsWith('data:image/') ? 'image' as const : 'text' as const,
      }))
    );
  }, [offlineMessages, conversation?.botName]);

  // Reset initialMessage tracking when the conversation ID changes
  useEffect(() => {
    initialMessageSentRef.current = null;
  }, [conversation?.id]);

  // Auto-send initial message when provided (e.g. from voice modal)
  useEffect(() => {
    if (initialMessage && initialMessage !== initialMessageSentRef.current && conversation?.id && !isLoading) {
      initialMessageSentRef.current = initialMessage;
      // Use a short delay to ensure the component is fully mounted and handleSend is available
      const timer = setTimeout(() => {
        handleSendRef.current(initialMessage);
        onInitialMessageSent?.();
      }, 500);
      return () => clearTimeout(timer);
    }
    }, [initialMessage, conversation?.id, isLoading, onInitialMessageSent]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Close command hints on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (commandHintRef.current && !commandHintRef.current.contains(e.target as Node)) {
        setShowCommandHints(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Show/hide command hints based on input
  useEffect(() => {
    const trimmed = input.trimStart();
    if (trimmed.startsWith('/') && !trimmed.includes(' ') && trimmed.length <= '/reminder'.length) {
      setShowCommandHints(true);
    } else {
      setShowCommandHints(false);
    }
  }, [input]);



  // ─── Command Handlers ───

  // ─── Text-to-Speech: Speak AI response before showing text ───
  // Extracts a brief intro (first 1-2 sentences) from the AI response
  // and speaks it via TTS before the text message appears in chat.
  const extractSpeechText = useCallback((fullText: string): string => {
    // For image content, don't try to speak
    if (isImageContent(fullText)) return '';

    // Remove markdown bold markers for cleaner speech
    let cleanText = fullText.replace(/\*\*(.+?)\*\*/g, '$1');
    // Remove list markers
    cleanText = cleanText.replace(/^[-•*]\s+/gm, '');
    cleanText = cleanText.replace(/^\d+[.)]\s+/gm, '');

    // Try to get first 1-2 sentences, up to ~300 chars
    const sentences = cleanText.match(/[^.!?]+[.!?]+/g);
    if (sentences) {
      let speechText = '';
      for (const sentence of sentences) {
        if ((speechText + sentence).length > 300) break;
        speechText += sentence;
      }
      return speechText.trim() || cleanText.slice(0, 300);
    }

    // Fallback: first 300 chars
    return cleanText.slice(0, 300).trim();
  }, []);

  const speakText = useCallback(async (text: string): Promise<void> => {
    if (!text) return;

    try {
      // Add a timeout so TTS doesn't block forever
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/ai/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: 'tongtong', speed: 1.1 }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (!data.success || !data.audioBase64) {
        console.warn('[TTS] Failed to generate audio, skipping voice');
        return;
      }

      // Stop any currently playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
      audioRef.current = audio;

      setIsSpeaking(true);

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          audioRef.current = null;
          resolve();
        };
        audio.play().catch(() => {
          setIsSpeaking(false);
          audioRef.current = null;
          resolve();
        });
      });
    } catch (error) {
      console.warn('[TTS] Error:', error);
      setIsSpeaking(false);
    }
  }, []);

  const addAssistantMessage = useCallback((content: string, type: 'text' | 'image' = 'text') => {
    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content,
      botName: conversation?.botName || 'Syntra',
      type,
    };
    setMessages((prev) => [...prev, aiMessage]);
    setIsTyping(false);
    return aiMessage;
  }, [conversation?.botName]);

  // Voice-first AI message: speaks a brief intro first, then shows the text
  const addAssistantMessageWithVoice = useCallback(async (content: string, type: 'text' | 'image' = 'text') => {
    // For image content, just add the message without voice
    if (type === 'image' || isImageContent(content)) {
      return addAssistantMessage(content, type);
    }

    // Extract a brief intro to speak
    const speechText = extractSpeechText(content);

    // Speak the intro first, then show the full text
    if (speechText) {
      await speakText(speechText);
    }

    // Now add the message to chat
    return addAssistantMessage(content, type);
  }, [addAssistantMessage, extractSpeechText, speakText]);

  const saveMessageToDb = useCallback(async (role: string, content: string) => {
    if (!conversation?.id) return;
    try {
      await addOfflineMessage({ role, content, conversationId: conversation.id });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  }, [conversation?.id, addOfflineMessage]);

  const handleImageCommand = useCallback(async (description: string) => {
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: description, size: '1024x1024', customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
      });
      const data = await res.json();

      if (data.success && data.imageBase64) {
        const imageContent = `data:image/png;base64,${data.imageBase64}`;
        addAssistantMessage(imageContent, 'image');
        await saveMessageToDb('assistant', imageContent);
      } else if (data.textDescription) {
        // AI can't generate images but described what it would look like
        const descMessage = `[Image] **Image: ${description}**\n\n${data.textDescription}`;
        await addAssistantMessageWithVoice(descMessage);
        await saveMessageToDb('assistant', descMessage);
      } else {
        addAssistantMessage(data.error || 'Failed to generate image. Please try again.');
        await saveMessageToDb('assistant', data.error || 'Failed to generate image. Please try again.');
      }
    } catch (error) {
      console.error('Image command error:', error);
      addAssistantMessage('Failed to generate image. Please try again.');
    }
  }, [addAssistantMessage, addAssistantMessageWithVoice, saveMessageToDb, getEndpoint, getModelName, getApiKey]);

  // Helper: build recent conversation context string for AI parsing APIs
  const buildConversationContext = useCallback((): string => {
    if (messages.length === 0) return '';
    const recent = messages.slice(-8); // Last 8 messages for context
    return recent.map(m => `${m.role === 'user' ? 'User' : 'Syntra'}: ${m.content.slice(0, 300)}`).join('\n');
  }, [messages]);

  const handleTaskCommand = useCallback(async (description: string) => {
    try {
      const today = getToday();
      // Include conversation context so the AI parser knows what's been discussed
      const convContext = buildConversationContext();
      const enrichedDescription = convContext
        ? `[Conversation context]\n${convContext}\n\n[Task request] ${description}`
        : description;
      const res = await fetch('/api/ai/task-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: enrichedDescription, date: today, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext: getUserContext() }),
      });
      const data = await res.json();

      if (data.task) {
        // Save the task to IndexedDB (not SQLite!)
        try {
          await addOfflineTask({
            title: data.task.title,
            description: data.task.description || '',
            time: data.task.time || '',
            location: data.task.location || '',
            participants: data.task.participants || '',
            category: data.task.category || 'general',
            priority: 'medium',
            completed: false,
            date: data.task.date || today,
          });

          const details = [
            `Task created: ${data.task.title}`,
            data.task.description ? `  ${data.task.description}` : '',
            data.task.time ? `  Time: ${formatTime12(data.task.time)}` : '',
            data.task.location ? `  Location: ${data.task.location}` : '',
            data.task.participants ? `  With: ${data.task.participants}` : '',
            `  Date: ${data.task.date || today}`,
            `  Category: ${data.task.category || 'general'}`,
          ].filter(Boolean).join('\n');
          await addAssistantMessageWithVoice(details);
          await saveMessageToDb('assistant', details);
          setNavChip({ target: 'planner', label: 'View in Planner' });
        } catch (saveError) {
          console.error('Failed to save task to IndexedDB:', saveError);
          addAssistantMessage('Task parsed but failed to save. Please try again.');
          await saveMessageToDb('assistant', 'Task parsed but failed to save. Please try again.');
        }
      } else {
        addAssistantMessage('Failed to create task. Please try again.');
        await saveMessageToDb('assistant', 'Failed to create task. Please try again.');
      }
    } catch (error) {
      console.error('Task command error:', error);
      addAssistantMessage('Failed to create task. Please try again.');
    }
  }, [addAssistantMessageWithVoice, saveMessageToDb, addOfflineTask, getEndpoint, getModelName, getApiKey, buildConversationContext]);

  const handleReminderCommand = useCallback(async (description: string) => {
    try {
      // Include conversation context so the AI parser knows what's been discussed
      const convContext = buildConversationContext();
      const enrichedDescription = convContext
        ? `[Conversation context]\n${convContext}\n\n[Reminder request] ${description}`
        : description;
      const res = await fetch('/api/ai/reminder-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: enrichedDescription, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext: getUserContext() }),
      });
      const data = await res.json();

      if (data.reminder) {
        // Save the reminder to IndexedDB (not SQLite!)
        try {
          await addOfflineReminder({
            title: data.reminder.title,
            description: data.reminder.description || '',
            time: data.reminder.time || '',
            icon: data.reminder.icon || 'bell',
            completed: false,
            recurring: data.reminder.recurring || '',
            recurringEndDate: data.reminder.recurringEndDate || '',
          });

          const details = [
            `Reminder created: ${data.reminder.title}`,
            data.reminder.description ? `  ${data.reminder.description}` : '',
            data.reminder.time ? `  Time: ${formatTime12(data.reminder.time)}` : '',
          ].filter(Boolean).join('\n');
          await addAssistantMessageWithVoice(details);
          await saveMessageToDb('assistant', details);
          setNavChip({ target: 'friends', label: 'View Reminders' });
        } catch (saveError) {
          console.error('Failed to save reminder to IndexedDB:', saveError);
          addAssistantMessage('Reminder parsed but failed to save. Please try again.');
          await saveMessageToDb('assistant', 'Reminder parsed but failed to save. Please try again.');
        }
      } else {
        addAssistantMessage('Failed to create reminder. Please try again.');
        await saveMessageToDb('assistant', 'Failed to create reminder. Please try again.');
      }
    } catch (error) {
      console.error('Reminder command error:', error);
      addAssistantMessage('Failed to create reminder. Please try again.');
    }
  }, [addAssistantMessageWithVoice, saveMessageToDb, addOfflineReminder, getEndpoint, getModelName, getApiKey, buildConversationContext]);

  const handlePlanCommand = useCallback(async (description: string) => {
    try {
      const today = getToday();
      // Include conversation context so the AI planner knows what's been discussed
      // (e.g. the user's OJT schedule, preferences mentioned earlier, etc.)
      const convContext = buildConversationContext();
      const enrichedRequest = convContext
        ? `[Conversation context]\n${convContext}\n\n[Planning request] ${description}`
        : description;
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request: enrichedRequest, date: today, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext: getUserContext() }),
      });
      const data = await res.json();

      if (data.plan && Array.isArray(data.plan)) {
        // Create all tasks from the plan via IndexedDB (not SQLite!)
        const createdTasks: string[] = [];
        for (const item of data.plan) {
          try {
            await addOfflineTask({
              title: item.title,
              description: item.description || '',
              time: item.time || '',
              location: '',
              participants: '',
              category: item.category || 'general',
              priority: 'medium',
              completed: false,
              date: today,
            });
            createdTasks.push(`${formatTime12(item.time)} - ${item.title}`);
          } catch (e) {
            console.error('Failed to save plan item:', e);
          }
        }

        const planLines = [
          `Daily plan created (${data.plan.length} items):`,
          '',
          ...data.plan.map((item: { time: string; title: string; description: string; category: string }) =>
            `  ${formatTime12(item.time)}  ${item.title}${item.description ? ` — ${item.description}` : ''}`
          ),
          '',
          createdTasks.length > 0
            ? `${createdTasks.length} task${createdTasks.length !== 1 ? 's' : ''} saved to your planner.`
            : 'Failed to save tasks to planner.',
        ];
        const planText = planLines.join('\n');
        await addAssistantMessageWithVoice(planText);
        await saveMessageToDb('assistant', planText);
        if (createdTasks.length > 0) {
          setNavChip({ target: 'planner', label: 'View in Planner' });
        }
      } else {
        addAssistantMessage('Failed to generate plan. Please try again.');
        await saveMessageToDb('assistant', 'Failed to generate plan. Please try again.');
      }
    } catch (error) {
      console.error('Plan command error:', error);
      addAssistantMessage('Failed to generate plan. Please try again.');
    }
  }, [addAssistantMessageWithVoice, saveMessageToDb, addOfflineTask, getEndpoint, getModelName, getApiKey, buildConversationContext]);

  const handleAnalyzeCommand = useCallback(async (question: string) => {
    if (!pendingImage) {
      addAssistantMessage('Please upload an image first using the image button, then use /analyze to ask about it.');
      await saveMessageToDb('assistant', 'Please upload an image first using the image button, then use /analyze to ask about it.');
      return;
    }
    try {
      const res = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: pendingImage,
          question: question || 'Describe this image in detail.',
          customEndpoint: getEndpoint(),
          modelName: getModelName(),
          apiKey: getApiKey(),
        }),
      });
      const data = await res.json();
      if (data.success && data.response) {
        await addAssistantMessageWithVoice(data.response);
        await saveMessageToDb('assistant', data.response);
      } else {
        addAssistantMessage('Failed to analyze image. Please try again.');
        await saveMessageToDb('assistant', 'Failed to analyze image. Please try again.');
      }
      setPendingImage(null);
    } catch (error) {
      console.error('Analyze command error:', error);
      addAssistantMessage('Failed to analyze image. Please try again.');
    }
  }, [pendingImage, addAssistantMessage, addAssistantMessageWithVoice, saveMessageToDb, getEndpoint, getModelName, getApiKey]);

  const handleHelpCommand = useCallback(() => {
    const helpText = [
      'Available commands:',
      '',
      ...COMMANDS.map((cmd) => `  ${cmd.label.padEnd(12)} ${cmd.description}`),
      '',
      'Type a command followed by a description to use it.',
      'For example: /image a sunset over mountains',
    ].join('\n');
    addAssistantMessage(helpText);
    saveMessageToDb('assistant', helpText);
  }, [addAssistantMessage, saveMessageToDb]);

  // ─── Auto-Title Conversation ───
  // After the first exchange, use AI to detect the topic and rename the conversation.
  const autoTitleConversation = useCallback(async (convId: string, userMessage: string, aiResponse: string) => {
    try {
      // Use a lightweight AI call to generate a short title
      const titlePrompt = `Based on the following conversation start, generate a very short title (2-5 words max, no quotes, no punctuation at the end). This will be used as a conversation title. Just output the title, nothing else.\n\nUser: ${userMessage.slice(0, 200)}\nAI: ${aiResponse.slice(0, 200)}`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: titlePrompt }],
          systemPrompt: 'You are a title generator. Generate short, descriptive conversation titles. Output ONLY the title text, nothing else. No quotes, no extra words.',
          customEndpoint: getEndpoint(),
          modelName: getModelName(),
          apiKey: getApiKey(),
        }),
      });

      const data = await res.json();
      if (data.success && data.response) {
        const title = data.response.trim().replace(/^["']|["']$/g, '').slice(0, 60);
        if (title && title.length > 1) {
          await updateConversation(convId, { title });
        }
      }
    } catch (error) {
      // Silently fail — title auto-naming is optional
      console.error('Auto-title failed:', error);
    }
  }, [getEndpoint, getModelName, getApiKey, updateConversation]);

  // Phase 2: Extract memory from conversation exchanges (async, non-blocking)
  const extractMemoryFromExchange = useCallback(async (convId: string, userMessage: string, aiResponse: string) => {
    // Don't await — this runs in background and shouldn't block the UI
    try {
      const { addConversationMemory, upsertGlobalMemory: upsertGlobal } = await import('@/hooks/use-offline-memory');

      // Simple rule-based memory extraction (no AI call needed for speed)
      const combined = `${userMessage} ${aiResponse}`.toLowerCase();

      // Extract preferences — look for preference patterns
      const preferencePatterns = [
        /(?:i (?:prefer|like|love|enjoy|hate|dislike|don't like|can't stand))\s+([^.!?\n]{3,60})/gi,
        /(?:i (?:always|never|usually|often|rarely))\s+([^.!?\n]{3,60})/gi,
        /(?:my (?:favorite|preferred|usual))\s+([^.!?\n]{3,60})/gi,
      ];

      for (const pattern of preferencePatterns) {
        let match;
        while ((match = pattern.exec(userMessage)) !== null) {
          const prefText = match[0].trim();
          const prefKey = prefText.replace(/[^a-z0-9]+/g, '_').slice(0, 40);
          await upsertGlobal(prefKey, 'preference', prefText, convId);
        }
      }

      // Extract facts — look for factual statements
      const factPatterns = [
        /(?:i (?:am|work as|study|live in|have|work at|go to))\s+([^.!?\n]{3,60})/gi,
        /(?:i'm (?:a|an|the))\s+([^.!?\n]{3,60})/gi,
      ];

      for (const pattern of factPatterns) {
        let match;
        while ((match = pattern.exec(userMessage)) !== null) {
          const factText = match[0].trim();
          const factKey = factText.replace(/[^a-z0-9]+/g, '_').slice(0, 40);
          await upsertGlobal(factKey, 'fact', factText, convId);
        }
      }

      // Extract goals mentioned
      const goalPatterns = [
        /(?:i want to|i'm trying to|i need to|my goal is to|i'm working on)\s+([^.!?\n]{3,60})/gi,
      ];

      for (const pattern of goalPatterns) {
        let match;
        while ((match = pattern.exec(userMessage)) !== null) {
          const goalText = match[0].trim();
          const goalKey = goalText.replace(/[^a-z0-9]+/g, '_').slice(0, 40);
          await upsertGlobal(goalKey, 'goal', goalText, convId);
        }
      }

      // Add entity memory for current conversation
      // Track significant topics (words > 4 chars that appear multiple times)
      const words = combined.split(/\s+/).filter(w => w.length > 4);
      const wordCounts: Record<string, number> = {};
      for (const w of words) {
        wordCounts[w] = (wordCounts[w] || 0) + 1;
      }
      const topics = Object.entries(wordCounts)
        .filter(([, count]) => count >= 2)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([word]) => word);

      if (topics.length > 0) {
        await addConversationMemory({
          conversationId: convId,
          type: 'entity',
          content: `Topics: ${topics.join(', ')}`,
          timestamp: new Date(),
          importance: 'low',
        });
      }

      // Track key decisions — if AI suggests an action and user seems to agree
      if (combined.includes('yes') || combined.includes('sure') || combined.includes('let\'s') || combined.includes('okay') || combined.includes('do it')) {
        // Simple heuristic: if the user message is affirmative after a suggestion
        const prevAiMsg = aiResponse.slice(0, 200);
        if (prevAiMsg.includes('suggest') || prevAiMsg.includes('how about') || prevAiMsg.includes('want me to') || prevAiMsg.includes('should we')) {
          await addConversationMemory({
            conversationId: convId,
            type: 'keyDecision',
            content: `User agreed to: ${prevAiMsg.slice(0, 100)}`,
            timestamp: new Date(),
            importance: 'high',
          });
        }
      }
    } catch (error) {
      // Memory extraction is non-critical — silently fail
      console.error('[extractMemoryFromExchange] Error:', error);
    }
  }, []);

  // ─── Command Detection ───

  const detectCommand = (text: string): { command: string; args: string } | null => {
    const trimmed = text.trim();
    const match = trimmed.match(/^\/(image|task|reminder|plan|help|analyze)(?:\s+(.*))?$/);
    if (!match) return null;
    const command = match[1];
    const args = (match[2] || '').trim();
    return { command, args };
  };

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPendingImage(base64);
    };
    reader.readAsDataURL(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // ─── Quick-task creation from AI messages ───

  const handleQuickAddTask = useCallback(async (text: string) => {
    try {
      const title = text.length > 60 ? text.substring(0, 60) + '...' : text;
      await addOfflineTask({
        title,
        description: text,
        time: '',
        location: '',
        participants: '',
        category: 'general',
        priority: 'medium',
        completed: false,
        date: getToday(),
      });
      showToast('[CREATED] Task added');
      setNavChip({ target: 'planner', label: 'View in Planner' });
    } catch (error) {
      console.error('Quick add task error:', error);
    }
  }, [addOfflineTask, showToast]);

  const handleQuickAddReminder = useCallback(async (text: string) => {
    try {
      const title = text.length > 60 ? text.substring(0, 60) + '...' : text;
      await addOfflineReminder({
        title,
        description: text,
        time: '',
        icon: 'bell',
        completed: false,
        recurring: '',
        recurringEndDate: '',
      });
      showToast('[CREATED] Reminder added');
      setNavChip({ target: 'friends', label: 'View Reminders' });
    } catch (error) {
      console.error('Quick add reminder error:', error);
    }
  }, [addOfflineReminder, showToast]);

  // ─── Main Send Handler ───

  const handleSend = async (overrideText?: string) => {
    const trimmed = (overrideText || input).trim();
    // Allow send with either text or a pending image (or both)
    if ((!trimmed && !pendingImage) || isLoading) return;

    // Clear navigation chip when user sends a new message
    setNavChip(null);

    // Capture the pending image if one is attached
    const imageToSend = pendingImage;
    if (imageToSend) {
      setPendingImage(null);
    }

    // Build user message — include image if attached
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: imageToSend ? `${imageToSend}\n${trimmed}` : trimmed,
      type: imageToSend ? 'image' : 'text',
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!overrideText) {
      setInput('');
      setShowCommandHints(false);
      setShowQuickActions(false);
    }
    setIsLoading(true);
    setIsTyping(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Save user message to database
    await saveMessageToDb('user', imageToSend ? `[Image attached] ${trimmed}` : trimmed);

    // ─── Image + Text flow: send to vision API for analysis ───
    if (imageToSend) {
      try {
        const question = trimmed || 'Describe this image in detail.';
        const res = await fetch('/api/ai/analyze-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: imageToSend,
            question,
            customEndpoint: getEndpoint(),
            modelName: getModelName(),
            apiKey: getApiKey(),
          }),
        });
        const data = await res.json();
        if (data.success && data.response) {
          await addAssistantMessageWithVoice(data.response);
          await saveMessageToDb('assistant', data.response);
        } else {
          addAssistantMessage('I couldn\'t analyze the image. Please try again.');
          await saveMessageToDb('assistant', 'I couldn\'t analyze the image. Please try again.');
        }
      } catch (error) {
        console.error('Image analysis error:', error);
        addAssistantMessage('I couldn\'t analyze the image. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Check for commands
    const cmd = detectCommand(trimmed);
    if (cmd) {
      const { command, args } = cmd;
      try {
        switch (command) {
          case 'help':
            handleHelpCommand();
            break;
          case 'image':
            if (!args) {
              addAssistantMessage('Please provide a description. Usage: /image <description>');
              await saveMessageToDb('assistant', 'Please provide a description. Usage: /image <description>');
            } else {
              await handleImageCommand(args);
            }
            break;
          case 'task':
            if (!args) {
              addAssistantMessage('Please provide a description. Usage: /task <description>');
              await saveMessageToDb('assistant', 'Please provide a description. Usage: /task <description>');
            } else {
              await handleTaskCommand(args);
            }
            break;
          case 'reminder':
            if (!args) {
              addAssistantMessage('Please provide a description. Usage: /reminder <description>');
              await saveMessageToDb('assistant', 'Please provide a description. Usage: /reminder <description>');
            } else {
              await handleReminderCommand(args);
            }
            break;
          case 'plan':
            if (!args) {
              addAssistantMessage('Please provide a planning request. Usage: /plan <description>');
              await saveMessageToDb('assistant', 'Please provide a planning request. Usage: /plan <description>');
            } else {
              await handlePlanCommand(args);
            }
            break;
          case 'analyze':
            await handleAnalyzeCommand(args);
            break;
        }
      } catch (error) {
        console.error('Command execution error:', error);
        addAssistantMessage('An error occurred while executing the command. Please try again.');
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ─── Natural Language Intent Detection ───
    // When the user types "remind me to X" or "plan my day" without a /slash,
    // detect the intent and route to the specialized handler that actually
    // creates the item in the database (not just a text response).
    const intent = detectChatIntent(trimmed);
    if (intent.type !== 'chat') {
      try {
        switch (intent.type) {
          case 'task':
            await handleTaskCommand(intent.description || trimmed);
            break;
          case 'reminder':
            await handleReminderCommand(intent.description || trimmed);
            break;
          case 'image':
            await handleImageCommand(intent.description || trimmed);
            break;
          case 'plan':
            await handlePlanCommand(intent.description || trimmed);
            break;
        }
        // After creating a task/reminder, check if user also wants a "remind me later" app reminder
        if (/\bremind\s+me\s+(later|next\s+time|when\s+i\s+open|when\s+open|later\s+on)\b/i.test(trimmed)) {
          scheduleAppReminder({
            id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
            message: trimmed,
            triggeredAt: new Date().toISOString(),
            screen: intent.type === 'task' || intent.type === 'plan' ? 'planner' : 'friends',
          });
        }
        setIsLoading(false);
        return;
      } catch (error) {
        console.error('Intent handler error — falling back to chat:', error);
        // Fall through to regular chat flow so user still gets a response
      }
    }

    // ─── "Remind me later" / "Remind me next time" standalone detection ───
    // If the user explicitly asks to be reminded later (without creating a specific task/reminder)
    if (/\bremind\s+me\s+(later|next\s+time|when\s+i\s+open|when\s+open|later\s+on)\b/i.test(trimmed)) {
      scheduleAppReminder({
        id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
        message: trimmed.replace(/\bremind\s+me\s+(later|next\s+time|when\s+i\s+open|when\s+open|later\s+on)\b/i, '').trim() || trimmed,
        triggeredAt: new Date().toISOString(),
      });
      await addAssistantMessage('📌 Got it! I\'ll remind you next time you open the app.');
      await saveMessageToDb('assistant', '📌 Got it! I\'ll remind you next time you open the app.');
      setIsLoading(false);
      return;
    }

    // ─── Regular Chat Flow with Smart Context (Phase 2 Enhanced) ───

    try {
      // Phase 2: Build unified context for omniscient AI
      const { contextString: unifiedContextString, deepContextMode } = await buildUnifiedContextString();

      const voiceTone = settings.voiceTone || 'friendly';

      // Legacy userContext (used as fallback if unified context fails)
      const today = getToday();
      const todayMood = moods.find(m => m.date === today);
      const userContext = {
        name: profile.name || 'User',
        aboutMe: profile.aboutMe || '',
        role: settings.role || '',
        interests: settings.interests || '',
        activeGoals: goals.filter(g => !g.completed).map(g => g.title),
        todayHabits: habits.map(h => ({
          title: h.title,
          streak: h.streak,
          done: h.lastCompletedDate === today,
        })),
        mood: todayMood?.mood,
        energy: todayMood?.energy,
      };

      // Sliding window: estimate ~4 chars per token, keep ~3000 tokens for history
      const MAX_CONTEXT_CHARS = 12000; // ~3000 tokens for chat history
      const allMessages = [...messages, userMessage];
      let chatHistory = allMessages.map((m) => ({
        role: m.role as string,
        content: m.content,
      }));

      // Trim from the beginning if context is too long
      let totalChars = chatHistory.reduce((sum, m) => sum + m.content.length, 0);
      while (totalChars > MAX_CONTEXT_CHARS && chatHistory.length > 1) {
        totalChars -= chatHistory[0].content.length;
        chatHistory.shift();
      }

      const chatMessages = chatHistory;

      const customEndpoint = getEndpoint();
      const modelName = getModelName();
      const apiKey = getApiKey();

      // Reality-Based Intelligence Protocol: Send data availability report + user data context
      // The backend will use buildRealityBasedSystemPrompt if deepContextMode is true
      const reportData = buildDataAvailabilityReport();
      const userDataContextStr = buildUserDataContextString();

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: chatMessages,
          customEndpoint,
          modelName,
          apiKey,
          userContext,
          voiceTone,
          unifiedContextString: unifiedContextString || undefined,
          deepContextMode,
          dataAvailabilityReport: reportData?.reportString || undefined,
          dataAvailabilityReportJson: reportData?.reportObj || undefined,
          userDataContext: userDataContextStr || unifiedContextString || undefined,
        }),
      });

      const data = await res.json();

      if (data.success && data.response) {
        // Voice-first: speak a brief intro before showing the text
        const speechText = extractSpeechText(data.response);
        if (speechText) {
          await speakText(speechText);
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          botName: conversation?.botName || 'Syntra',
          // Reality-Based Intelligence Protocol metadata
          dataSourcesChecked: data.dataSourcesChecked,
          wasFiltered: data.wasFiltered,
          hallucinationsDetected: data.hallucinationsDetected,
        };

        setMessages((prev) => [...prev, aiMessage]);
        setIsTyping(false);

        if (conversation?.id) {
          try {
            await addOfflineMessage({ role: 'assistant', content: data.response, conversationId: conversation.id });
          } catch (error) {
            console.error('Failed to save AI message:', error);
          }

          // Auto-name conversation based on topic if it still has the default title
          const convTitle = offlineConversations.find(c => c.id === conversation.id)?.title || '';
          if (convTitle === 'New Chat' || convTitle.startsWith('New Chat')) {
            autoTitleConversation(conversation.id, trimmed, data.response);
          }

          // Phase 2: Extract memory from this exchange (async, non-blocking)
          extractMemoryFromExchange(conversation.id, trimmed, data.response);
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm sorry, I encountered an error. Please try again.",
          botName: conversation?.botName || 'Syntra',
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I couldn't connect to the AI service. Please try again.",
        botName: conversation?.botName || 'Syntra',
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsTyping(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Keep handleSendRef up to date
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChipTap = useCallback((chipText: string) => {
    if (isLoading) return;
    handleSend(chipText);
  }, [isLoading]);

  const handleDismissBanner = useCallback((messageId: string) => {
    setDismissedBanners((prev) => new Set(prev).add(messageId));
  }, []);

  // Filter command hints based on current input
  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.command.startsWith(input.trimStart().toLowerCase())
  );

  const handleCommandSelect = (command: string) => {
    setInput(command + ' ');
    setShowCommandHints(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="h-full flex flex-col relative" style={{ backgroundColor: 'var(--nd-black)' }}>
      {/* ═══ Header Bar — Nothing Design System ═══ */}
      <header
        className="shrink-0 px-3 sm:px-4 py-2.5 flex items-center gap-2.5"
        style={{
          backgroundColor: 'var(--nd-surface)',
          borderBottom: '1px solid var(--nd-border)',
        }}
      >
        {/* Back button — flat circle */}
        <button
          onClick={onBack}
          className="flex items-center justify-center flex-shrink-0 transition-colors duration-200"
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '999px',
            backgroundColor: 'transparent',
            border: '1px solid var(--nd-border-visible)',
            color: 'var(--nd-text-primary)',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--nd-text-secondary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--nd-border-visible)'; }}
          aria-label="Go back"
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.5} />
        </button>

        {/* Bot avatar — DotmTriangle11 AI indicator */}
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '999px',
            backgroundColor: 'var(--nd-black)',
            border: '1px solid var(--nd-border-visible)',
          }}
        >
          <DotmTriangle11
            size={20}
            dotSize={3}
            speed={1.2}
            color="var(--nd-text-secondary)"
            bloom
            opacityBase={0.1}
            opacityMid={0.4}
            opacityPeak={0.95}
          />
        </div>

        {/* Title + Connection Status */}
        <div className="flex-1 min-w-0">
          <h1
            className="font-medium text-sm truncate"
            style={{
              color: 'var(--nd-text-display)',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {conversation?.title || conversation?.botName || 'Syntra'}
          </h1>
          <ConnectionStatus />
        </div>

        {/* Header actions — dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center justify-center flex-shrink-0 transition-colors duration-200"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '999px',
                border: '1px solid var(--nd-border-visible)',
                background: 'transparent',
                color: 'var(--nd-text-secondary)',
                cursor: 'pointer',
              }}
              aria-label="Chat options"
            >
              <MoreVertical className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="border-0 shadow-none outline-none"
            style={{
              backgroundColor: 'var(--nd-surface)',
              border: '1px solid var(--nd-border-visible)',
              borderRadius: '12px',
              minWidth: '180px',
              padding: '4px',
            }}
          >
            <DropdownMenuItem
              className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
              style={{ color: 'var(--nd-text-primary)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
              onSelect={() => {
                if (conversation?.id) {
                  updateConversation(conversation.id, { pinned: !conversation.pinned });
                }
              }}
            >
              <Pin className="w-4 h-4" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              <span>{conversation?.pinned ? 'Unpin Chat' : 'Pin Chat'}</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator style={{ backgroundColor: 'var(--nd-border)', margin: '2px 8px' }} />
            <DropdownMenuItem
              className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 outline-none"
              style={{ color: 'var(--nd-accent)', fontFamily: "'Space Grotesk', sans-serif", fontSize: '13px' }}
              onSelect={() => {
                if (conversation?.id) {
                  onBack();
                }
              }}
            >
              <Trash2 className="w-4 h-4" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
              <span>Delete Chat</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* ═══ Messages Area ═══ */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-3 sm:py-4 space-y-3 scrollbar-thin">
        {/* Empty state — Nothing dot-grid aesthetic */}
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full text-center select-none nd-fade-in px-4">
            {/* Dot-grid visual anchor */}
            <div
              className="flex items-center justify-center mb-6"
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '999px',
                backgroundColor: 'var(--nd-surface)',
                border: '1px solid var(--nd-border-visible)',
                backgroundImage: 'radial-gradient(circle, var(--nd-border-visible) 1px, transparent 1px)',
                backgroundSize: '8px 8px',
              }}
            >
              <DotmTriangle11
                size={32}
                dotSize={4}
                speed={1.2}
                color="var(--nd-text-secondary)"
                bloom
                opacityBase={0.1}
                opacityMid={0.4}
                opacityPeak={0.95}
              />
            </div>

            {/* Greeting */}
            <h3
              className="font-medium text-base mb-1.5"
              style={{
                color: 'var(--nd-text-display)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {profile.name ? `Hey, ${profile.name}` : 'Start a conversation'}
            </h3>
            <p
              className="text-sm max-w-[280px] sm:max-w-[260px] leading-relaxed mb-4"
              style={{ color: 'var(--nd-text-secondary)' }}
            >
              Send a message and I&apos;ll help with whatever you need.
            </p>

            {/* Suggestion chips */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {[
                { text: 'PLAN MY DAY', prompt: 'Help me plan my day efficiently' },
                { text: 'SET A REMINDER', prompt: 'Set a reminder for me' },
                { text: 'CREATE A TASK', prompt: 'Create a task for me' },
              ].map((chip) => (
                <button
                  key={chip.text}
                  onClick={() => {
                    setInput(chip.prompt);
                  }}
                  className="px-3 py-1.5 cursor-pointer transition-colors duration-200"
                  style={{
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '999px',
                    backgroundColor: 'transparent',
                    color: 'var(--nd-text-secondary)',
                    fontFamily: "'Space Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.06em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
                    e.currentTarget.style.color = 'var(--nd-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                    e.currentTarget.style.color = 'var(--nd-text-secondary)';
                  }}
                >
                  {chip.text}
                </button>
              ))}
            </div>

            {/* Commands hint */}
            <p
              className="text-xs max-w-xs leading-relaxed mt-4"
              style={{ color: 'var(--nd-text-disabled)', fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em', fontSize: '10px' }}
            >
              Type / for commands
            </p>
          </div>
        )}

        {/* Message list */}
        {messages.map((message, index) => {
          const isAiMessage = message.role === 'assistant';
          const isImageMsg = isImageContent(message.content);
          const quickReplies = isAiMessage && !isImageMsg ? generateQuickReplies(message.content) : [];
          const hasActionable = isAiMessage && !isImageMsg && hasTaskablePhrases(message.content);
          const actionItem = isAiMessage && !isImageMsg ? detectActionableContent(message.content) : { detected: false, text: '' };
          const showAutoBanner = isAiMessage && actionItem.detected && !dismissedBanners.has(message.id) && !isImageMsg;
          const isLastAiMessage = isAiMessage && index === messages.length - 1;

          return (
            <div
              key={message.id}
              className={`flex gap-1.5 sm:gap-2 nd-fade-in ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* AI avatar — DotmTriangle11 indicator */}
              {message.role === 'assistant' && (
                <div
                  className="flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--nd-black)',
                    border: '1px solid var(--nd-border-visible)',
                  }}
                >
                  <DotmTriangle11
                    size={16}
                    dotSize={2.5}
                    speed={1.4}
                    color="var(--nd-text-secondary)"
                    bloom
                    opacityBase={0.1}
                    opacityMid={0.4}
                    opacityPeak={0.95}
                  />
                </div>
              )}

              {/* Message bubble + extras */}
              <div className="max-w-[85%] sm:max-w-[75%]">
                {/* Sender label — Space Mono ALL CAPS */}
                {isAiMessage && (
                  <p
                    className="text-[10px] mb-1"
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      color: 'var(--nd-text-disabled)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {message.botName || 'SYNTRA'}
                  </p>
                )}

                <div
                  className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user' ? 'nd-bubble-user' : 'nd-bubble-ai'
                  }`}
                >
                  <FormattedContent content={message.content} onImageClick={(src) => setViewerImage(src)} />
                </div>

                {/* Quick Reply Chips — only for last AI text message */}
                {isLastAiMessage && !isImageMsg && quickReplies.length > 0 && (
                  <QuickReplyChips chips={quickReplies} onChipTap={handleChipTap} />
                )}

                {/* Smart Action Buttons — only when task-able phrases detected */}
                {isLastAiMessage && !isImageMsg && hasActionable && (
                  <SmartActionButtons
                    onAddTask={() => handleQuickAddTask(actionItem.text || message.content)}
                    onAddReminder={() => handleQuickAddReminder(actionItem.text || message.content)}
                    onViewPlanner={onNavigate ? () => onNavigate('planner') : undefined}
                    onViewReminders={onNavigate ? () => onNavigate('friends') : undefined}
                  />
                )}

                {/* Navigation Chip — after task/reminder/plan creation */}
                {isLastAiMessage && navChip && onNavigate && (
                  <NavigationChip
                    label={navChip.label}
                    onNavigate={() => {
                      onNavigate(navChip.target);
                      setNavChip(null);
                    }}
                  />
                )}

                {/* Auto-Task Detection Banner */}
                {showAutoBanner && (
                  <AutoTaskBanner
                    actionText={actionItem.text}
                    onAdd={() => {
                      handleQuickAddTask(actionItem.text);
                      handleDismissBanner(message.id);
                    }}
                    onDismiss={() => handleDismissBanner(message.id)}
                    onViewPlanner={onNavigate ? () => onNavigate('planner') : undefined}
                  />
                )}

                {/* Reality-Based Intelligence Protocol: Data source & filter indicators */}
                {isAiMessage && !isImageMsg && message.dataSourcesChecked && message.dataSourcesChecked.length > 0 && (
                  <div
                    className="flex items-center gap-1.5 mt-1.5"
                    style={{ color: 'var(--nd-text-disabled)' }}
                  >
                    <BarChart3 className="w-3 h-3" strokeWidth={1.5} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: '10px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Used: {message.dataSourcesChecked.join(', ')}
                    </span>
                  </div>
                )}
                {isAiMessage && !isImageMsg && (message.wasFiltered || (message.hallucinationsDetected && message.hallucinationsDetected > 0)) && (
                  <div
                    className="flex items-center gap-1.5 mt-1"
                    style={{ color: 'var(--nd-warning)' }}
                    title="Response was filtered for accuracy"
                  >
                    <Shield className="w-3 h-3" strokeWidth={1.5} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: '10px',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Filtered for accuracy
                    </span>
                  </div>
                )}
              </div>

              {/* User avatar (right side) */}
              {message.role === 'user' && (
                <div
                  className="flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--nd-text-display)',
                    border: 'none',
                  }}
                >
                  <User className="w-3 h-3" strokeWidth={1.5} style={{ color: 'var(--nd-black)' }} />
                </div>
              )}
            </div>
          );
        })}

        {/* Typing indicator — DotmTriangle11 + segmented bars */}
        {isTyping && (
          <div className="flex gap-2 justify-start nd-fade-in">
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '999px',
                backgroundColor: 'var(--nd-black)',
                border: '1px solid var(--nd-border-visible)',
              }}
            >
              <DotmTriangle11
                size={16}
                dotSize={2.5}
                speed={1.8}
                color="var(--nd-text-secondary)"
                bloom
                opacityBase={0.1}
                opacityMid={0.4}
                opacityPeak={0.95}
              />
            </div>
            <div>
              <p
                className="text-[10px] mb-1"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  color: 'var(--nd-text-disabled)',
                  textTransform: 'uppercase',
                }}
              >
                SYNTRA
              </p>
              <div className="nd-bubble-ai px-3.5 py-2.5">
                {isSpeaking ? (
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5 animate-pulse" strokeWidth={1.5} style={{ color: 'var(--nd-interactive)' }} />
                    <span
                      className="text-xs"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        fontSize: '11px',
                        letterSpacing: '0.02em',
                        color: 'var(--nd-interactive)',
                      }}
                    >
                      Speaking...
                    </span>
                  </div>
                ) : (
                  <TypingIndicator />
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ═══ Input Area — Nothing Design ═══ */}
      <div
        className="shrink-0 px-3 sm:px-4 pt-2.5 pb-2.5 relative"
        style={{
          backgroundColor: 'var(--nd-surface)',
          borderTop: '1px solid var(--nd-border)',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Quick Actions popup — anchored to the + button inside the input row */}
        {showQuickActions && (
          <>
            <div
              className="fixed inset-0 z-[29]"
              onClick={() => setShowQuickActions(false)}
            />
            <div
              className="absolute bottom-full right-14 sm:right-16 mb-2 z-30 flex flex-col gap-1.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
            >
              {/* Image option */}
              <button
                onClick={() => {
                  setShowQuickActions(false);
                  fileInputRef.current?.click();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 transition-colors duration-200 whitespace-nowrap cursor-pointer"
                style={{
                  background: 'var(--nd-surface)',
                  color: pendingImage ? 'var(--nd-text-display)' : 'var(--nd-text-secondary)',
                  border: '1px solid var(--nd-border-visible)',
                  borderRadius: '999px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--nd-text-primary)';
                  e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = pendingImage ? 'var(--nd-text-display)' : 'var(--nd-text-secondary)';
                  e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                }}
              >
                <ImageIcon className="w-3 h-3" strokeWidth={1.5} />
                <span className="font-mono text-[10px] uppercase tracking-[0.06em]">Image</span>
              </button>

              {/* Voice option */}
              {onOpenVoiceModal && (
                <button
                  onClick={() => {
                    setShowQuickActions(false);
                    onOpenVoiceModal();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 transition-colors duration-200 whitespace-nowrap cursor-pointer"
                  style={{
                    background: 'var(--nd-surface)',
                    color: 'var(--nd-text-secondary)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '999px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--nd-text-primary)';
                    e.currentTarget.style.borderColor = 'var(--nd-text-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--nd-text-secondary)';
                    e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                  }}
                >
                  <Mic className="w-3 h-3" strokeWidth={1.5} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.06em]">Voice</span>
                </button>
              )}
            </div>
          </>
        )}

        {/* Pending image preview */}
        {pendingImage && (
          <div className="mb-2 px-1">
            <div
              className="relative inline-flex rounded-xl overflow-hidden"
              style={{
                border: '1px solid var(--nd-border-visible)',
                backgroundColor: 'var(--nd-black)',
                maxWidth: '200px',
              }}
            >
              <img
                src={pendingImage}
                alt="Attached image preview"
                className="w-full h-auto max-h-[140px] object-cover rounded-xl cursor-pointer"
                onClick={() => setViewerImage(pendingImage)}
              />
              {/* Remove button overlay */}
              <button
                onClick={() => setPendingImage(null)}
                className="absolute top-1.5 right-1.5 flex items-center justify-center w-6 h-6 rounded-full cursor-pointer"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  color: 'var(--nd-text-display)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  backdropFilter: 'blur(4px)',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.85)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.6)';
                }}
                aria-label="Remove image"
              >
                <X className="w-3.5 h-3.5" strokeWidth={2} />
              </button>
              {/* Image label overlay */}
              <div
                className="absolute bottom-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                style={{
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                }}
              >
                <ImageIcon className="w-2.5 h-2.5" strokeWidth={1.5} style={{ color: 'var(--nd-text-display)' }} />
                <span
                  className="font-mono text-[9px] uppercase tracking-[0.04em]"
                  style={{ color: 'var(--nd-text-display)' }}
                >
                  Attached
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center max-w-4xl mx-auto">
          <div className="flex-1 relative">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              aria-hidden="true"
            />
            {/* Command Hints Dropdown */}
            {showCommandHints && filteredCommands.length > 0 && (
              <div
                ref={commandHintRef}
                className="absolute bottom-full left-0 mb-2 w-[calc(100vw-48px)] sm:w-72 z-50 nd-fade-in"
                style={{
                  backgroundColor: 'var(--nd-surface)',
                  border: '1px solid var(--nd-border-visible)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                }}
              >
                <div
                  className="px-3 py-2 flex items-center gap-2"
                  style={{ borderBottom: '1px solid var(--nd-border)' }}
                >
                  <Command className="w-3 h-3" strokeWidth={1.5} style={{ color: 'var(--nd-text-secondary)' }} />
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: '10px',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: 'var(--nd-text-disabled)',
                    }}
                  >
                    Commands
                  </span>
                </div>
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.command}
                    onClick={() => handleCommandSelect(cmd.command)}
                    aria-label={`${cmd.label}: ${cmd.description}`}
                    className="w-full px-3 py-2.5 flex items-center gap-3 text-left"
                    style={{
                      backgroundColor: 'transparent',
                      color: 'var(--nd-text-primary)',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'background-color 150ms cubic-bezier(0.25, 0.1, 0.25, 1)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--nd-surface-raised)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--nd-black)',
                        border: '1px solid var(--nd-border)',
                        color: 'var(--nd-text-secondary)',
                      }}
                    >
                      {cmd.icon}
                    </span>
                    <div className="min-w-0">
                      <p
                        className="text-xs font-medium"
                        style={{
                          fontFamily: "'Space Mono', monospace",
                          fontSize: '12px',
                          color: 'var(--nd-text-primary)',
                        }}
                      >
                        {cmd.label}
                      </p>
                      <p
                        className="text-xs truncate"
                        style={{
                          color: 'var(--nd-text-disabled)',
                          fontSize: '11px',
                        }}
                      >
                        {cmd.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            <textarea
              ref={textareaRef}
              placeholder="Write a message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              className="w-full px-3.5 py-2.5 text-sm resize-none max-h-[120px] min-h-[42px] focus:outline-none"
              style={{
                backgroundColor: 'var(--nd-black)',
                border: '1px solid var(--nd-border)',
                borderRadius: '12px',
                color: 'var(--nd-text-primary)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                overflow: 'auto',
                height: 'auto',
                lineHeight: '20px',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 120) + 'px';
              }}
            />
          </div>

          {/* + Quick Action button — next to Send, after textarea */}
          <button
            onClick={() => setShowQuickActions((prev) => !prev)}
            className="flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer self-stretch"
            style={{
              minWidth: '42px',
              borderRadius: '12px',
              backgroundColor: showQuickActions ? 'var(--nd-surface-raised)' : 'transparent',
              border: '1px solid var(--nd-border-visible)',
              color: showQuickActions ? 'var(--nd-text-primary)' : 'var(--nd-text-secondary)',
              transform: showQuickActions ? 'rotate(45deg)' : 'rotate(0deg)',
            }}
            aria-label="Quick actions"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
          </button>

          {/* Send button — next to +, after textarea */}
          <button
            onClick={() => handleSend()}
            disabled={isLoading || (!input.trim() && !pendingImage)}
            className="flex items-center justify-center flex-shrink-0 transition-all duration-200 self-stretch"
            style={{
              minWidth: '42px',
              borderRadius: '12px',
              backgroundColor: (input.trim() || pendingImage) ? 'var(--nd-text-display)' : 'transparent',
              border: (input.trim() || pendingImage) ? 'none' : '1px solid var(--nd-border-visible)',
              color: (input.trim() || pendingImage) ? 'var(--nd-black)' : 'var(--nd-text-disabled)',
              cursor: (input.trim() || pendingImage) ? 'pointer' : 'default',
            }}
            aria-label="Send message"
          >
            <Send className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <ToastNotification message={toastMessage} visible={toastVisible} />

      {/* Fullscreen Image Viewer */}
      {viewerImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center animate-in fade-in-0 duration-200"
          style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
          onClick={() => setViewerImage(null)}
        >
          <button
            onClick={() => setViewerImage(null)}
            className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full cursor-pointer z-10"
            style={{
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              transition: 'background-color 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)';
            }}
            aria-label="Close image viewer"
          >
            <X className="w-5 h-5" strokeWidth={2} />
          </button>
          <img
            src={viewerImage}
            alt="Full size image"
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
