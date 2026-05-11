/**
 * Output Filter — Post-AI Response Hallucination Detection (Section 8.3)
 *
 * This module filters AI responses AFTER generation to catch and correct
 * hallucinations, unsupported claims, and vague assumptions that slipped
 * through the anti-hallucination context layer.
 *
 * Architecture:
 * ┌────────────┐     ┌──────────────────┐     ┌──────────────────┐
 * │  AI        │ ──→ │  Output Filter    │ ──→ │  Safe Response   │
 * │  Response  │     │  (hallucination   │     │  (corrected)     │
 * │  (raw)     │     │   detection)      │     │                  │
 * └────────────┘     └──────────────────┘     └──────────────────┘
 *                           ↓
 *                  ┌──────────────────┐
 *                  │  FilteredResponse │
 *                  │  (issues + fix)   │
 *                  └──────────────────┘
 */

import type { DataAvailabilityReport } from './data-validator';

/* ═══════════════════════════════════════════════════════════════
   Section 8.3: Core Interfaces
   ═══════════════════════════════════════════════════════════════ */

export interface FilteredResponse {
  filtered: string;
  issuesFound: number;
  correctionsApplied: string[];
  safeToSend: boolean;
}

export interface FilterIssue {
  type: 'unverified_claim' | 'assumption' | 'invented_pattern' | 'vague_claim';
  text: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  suggestion: string;
  correction?: string;
}

/* ═══════════════════════════════════════════════════════════════
   Section 3.2: Forbidden Phrases
   ═══════════════════════════════════════════════════════════════ */

interface ForbiddenPhraseRule {
  pattern: RegExp;
  type: FilterIssue['type'];
  severity: FilterIssue['severity'];
  contextCheck: keyof DataAvailabilityReport | null;
  contextMustBe: 'empty' | 'has_data';
  message: string;
  suggestion: string;
}

/**
 * Forbidden phrases from Section 3.2.
 * Each rule specifies:
 * - The regex pattern to detect
 * - What type of issue it represents
 * - Severity level
 * - Which data category to check (if applicable)
 * - Whether the context must be empty or have data for the phrase to be forbidden
 */
const FORBIDDEN_PHRASE_RULES: ForbiddenPhraseRule[] = [
  {
    pattern: /you're probably\b/i,
    type: 'assumption',
    severity: 'high',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Guessing user state without data',
    suggestion: 'Remove the assumption or add a disclaimer',
  },
  {
    pattern: /you probably\b/i,
    type: 'assumption',
    severity: 'high',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Guessing user state without data',
    suggestion: 'Remove the assumption or add a disclaimer',
  },
  {
    pattern: /most people\b/i,
    type: 'vague_claim',
    severity: 'medium',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Using population averages as if they apply to this user',
    suggestion: 'Reframe as general info or remove',
  },
  {
    pattern: /based on your usual patterns?\b/i,
    type: 'invented_pattern',
    severity: 'critical',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Claiming pattern knowledge without sufficient data',
    suggestion: 'Remove or soften with "if this pattern holds..."',
  },
  {
    pattern: /based on your (?:past |recent |previous )?(?:patterns?|history|behavior|habits|trends?)\b/i,
    type: 'invented_pattern',
    severity: 'high',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Claiming pattern knowledge without sufficient data',
    suggestion: 'Remove or add appropriate confidence qualifier',
  },
  {
    pattern: /don't forget to\b/i,
    type: 'unverified_claim',
    severity: 'high',
    contextCheck: 'reminders',
    contextMustBe: 'empty',
    message: '"Don\'t forget to" when no reminders exist',
    suggestion: 'Remove or reframe as a suggestion',
  },
  {
    pattern: /your schedule looks (?:packed|full|busy|tight|hectic)\b/i,
    type: 'invented_pattern',
    severity: 'high',
    contextCheck: 'planner',
    contextMustBe: 'empty',
    message: 'Claiming schedule is packed when planner is empty',
    suggestion: 'Remove or check actual schedule data',
  },
  {
    pattern: /your (?:busy|packed|full|tight) schedule\b/i,
    type: 'invented_pattern',
    severity: 'high',
    contextCheck: 'planner',
    contextMustBe: 'empty',
    message: 'Referencing busy schedule when planner is empty',
    suggestion: 'Remove or check actual schedule data',
  },
  {
    pattern: /you seem to prefer\b/i,
    type: 'invented_pattern',
    severity: 'medium',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Claiming to know preferences without data',
    suggestion: 'Remove or soften with "If you prefer..."',
  },
  {
    pattern: /as we (?:discussed|talked about|mentioned) (?:before|earlier|previously|last time)\b/i,
    type: 'unverified_claim',
    severity: 'high',
    contextCheck: 'conversations',
    contextMustBe: 'empty',
    message: 'Referencing past conversation when no history exists',
    suggestion: 'Remove the reference to past conversations',
  },
  {
    pattern: /you're making (?:great|good|excellent) progress\b/i,
    type: 'unverified_claim',
    severity: 'medium',
    contextCheck: 'goals',
    contextMustBe: 'empty',
    message: 'Claiming progress when no goals exist',
    suggestion: 'Remove or verify against actual goal data',
  },
  {
    pattern: /your (?:daily |regular |usual )?routine\b/i,
    type: 'assumption',
    severity: 'medium',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Assuming a routine without data',
    suggestion: 'Remove or soften with "If you have a routine..."',
  },
  {
    pattern: /you always\b/i,
    type: 'invented_pattern',
    severity: 'high',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Absolute claim about user behavior without data',
    suggestion: 'Remove or soften significantly',
  },
  {
    pattern: /you never\b/i,
    type: 'invented_pattern',
    severity: 'high',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Absolute claim about user behavior without data',
    suggestion: 'Remove or soften significantly',
  },
  {
    pattern: /you (?:typically|usually|normally|generally) (?:tend to |like to |prefer to |)?/i,
    type: 'assumption',
    severity: 'medium',
    contextCheck: null,
    contextMustBe: 'empty',
    message: 'Assuming typical behavior without data',
    suggestion: 'Remove or add uncertainty qualifier',
  },
];

/* ═══════════════════════════════════════════════════════════════
   Vague Assumption Detector
   ═══════════════════════════════════════════════════════════════ */

/**
 * Regex-based detector for vague assumption phrases.
 * Returns an array of detected vague assumptions with their positions.
 */
const VAGUE_ASSUMPTION_PATTERNS: {
  pattern: RegExp;
  label: string;
  severity: FilterIssue['severity'];
}[] = [
  {
    pattern: /\bprobably\b/gi,
    label: 'probably',
    severity: 'low',
  },
  {
    pattern: /\btypically\b/gi,
    label: 'typically',
    severity: 'low',
  },
  {
    pattern: /\bi assumed?\b/gi,
    label: 'I assumed/I assume',
    severity: 'medium',
  },
  {
    pattern: /\bmost people\b/gi,
    label: 'most people',
    severity: 'medium',
  },
  {
    pattern: /\bit's likely that\b/gi,
    label: "it's likely that",
    severity: 'low',
  },
  {
    pattern: /\bchances are\b/gi,
    label: 'chances are',
    severity: 'low',
  },
  {
    pattern: /\bi would guess\b/gi,
    label: 'I would guess',
    severity: 'medium',
  },
  {
    pattern: /\bmy guess is\b/gi,
    label: 'my guess is',
    severity: 'medium',
  },
  {
    pattern: /\bit seems like you(?:'r|'s| are| were)\b/gi,
    label: 'it seems like you...',
    severity: 'low',
  },
  {
    pattern: /\bi'd say\b/gi,
    label: "I'd say",
    severity: 'low',
  },
  {
    pattern: /\bmore often than not\b/gi,
    label: 'more often than not',
    severity: 'low',
  },
  {
    pattern: /\bin my experience\b/gi,
    label: 'in my experience',
    severity: 'medium',
  },
];

export function detectVagueAssumptions(text: string): FilterIssue[] {
  const issues: FilterIssue[] = [];

  for (const { pattern, label, severity } of VAGUE_ASSUMPTION_PATTERNS) {
    const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
    const matches = text.matchAll(new RegExp(pattern.source, flags));
    for (const match of matches) {
      if (match.index !== undefined) {
        // Extract surrounding context (±30 chars)
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + match[0].length + 30);
        const surroundingText = text.slice(start, end).trim();

        issues.push({
          type: 'vague_claim',
          text: match[0],
          severity,
          suggestion: `Consider softening or removing the vague phrase "${label}"`,
          correction: undefined,
        });
      }
    }
  }

  return issues;
}

/* ═══════════════════════════════════════════════════════════════
   Pattern Claim Checker
   ═══════════════════════════════════════════════════════════════ */

/**
 * Pattern claim phrases that require sufficient data to use.
 */
const PATTERN_CLAIM_PATTERNS: {
  pattern: RegExp;
  requiredCategory: keyof DataAvailabilityReport;
  minDataPoints: number;
  label: string;
}[] = [
  {
    pattern: /\byou(?:'ve| have) been (?:consistently|regularly|steadily)\b/i,
    requiredCategory: 'habits',
    minDataPoints: 7,
    label: 'consistency claim',
  },
  {
    pattern: /\byour (?:mood|energy) (?:trend|pattern|cycle)\b/i,
    requiredCategory: 'moods',
    minDataPoints: 14,
    label: 'mood pattern claim',
  },
  {
    pattern: /\byou (?:tend to |usually |normally )(?:complete|finish|do)\b/i,
    requiredCategory: 'tasks',
    minDataPoints: 15,
    label: 'task completion pattern claim',
  },
  {
    pattern: /\byour (?:productivity|work) (?:pattern|trend|rhythm)\b/i,
    requiredCategory: 'tasks',
    minDataPoints: 15,
    label: 'productivity pattern claim',
  },
  {
    pattern: /\byour streak\b/i,
    requiredCategory: 'habits',
    minDataPoints: 7,
    label: 'streak reference',
  },
];

function checkPatternClaims(
  text: string,
  report: DataAvailabilityReport,
): FilterIssue[] {
  const issues: FilterIssue[] = [];

  for (const { pattern, requiredCategory, minDataPoints, label } of PATTERN_CLAIM_PATTERNS) {
    if (!pattern.test(text)) continue;

    // Check if the category has enough data
    const categoryData = report[requiredCategory];
    let dataPoints = 0;

    if (requiredCategory === 'habits') {
      dataPoints = (categoryData as DataAvailabilityReport['habits']).count;
    } else if (requiredCategory === 'moods') {
      dataPoints = (categoryData as DataAvailabilityReport['moods']).historyLength;
    } else if (requiredCategory === 'tasks') {
      dataPoints = (categoryData as DataAvailabilityReport['tasks']).count;
    }

    if (dataPoints < minDataPoints) {
      issues.push({
        type: 'invented_pattern',
        text: label,
        severity: dataPoints === 0 ? 'critical' : 'high',
        suggestion: `Not enough data for ${label} (need ${minDataPoints}, have ${dataPoints}). Remove or soften.`,
        correction: dataPoints > 0
          ? `I'm starting to notice a pattern, though I don't have enough data to be sure yet — `
          : undefined,
      });
    }
  }

  return issues;
}

/* ═══════════════════════════════════════════════════════════════
   Auto-Correction Engine
   ═══════════════════════════════════════════════════════════════ */

/**
 * Apply automatic corrections based on detected issues.
 *
 * Correction rules (from Section 8.3):
 * - 'assumption' type: prepend "I don't have data to confirm this, but..."
 * - 'invented_pattern' type: replace definitive claim with "I'm starting to notice..."
 * - 'vague_claim' type: soften with "It's possible that..."
 * - 'critical' severity: remove the claim entirely
 */
export function autoCorrect(text: string, issues: FilterIssue[]): string {
  let corrected = text;
  const sortedIssues = [...issues].sort((a, b) => {
    // Process critical issues first, then by text length (longer first to avoid offset issues)
    if (a.severity === 'critical' && b.severity !== 'critical') return -1;
    if (b.severity === 'critical' && a.severity !== 'critical') return 1;
    return b.text.length - a.text.length;
  });

  for (const issue of sortedIssues) {
    // Critical severity: remove the claim entirely
    if (issue.severity === 'critical') {
      // Try to find and remove the sentence containing the claim
      const sentencePattern = new RegExp(
        `[^.!?]*${escapeRegExp(issue.text)}[^.!?]*[.!?]?`,
        'i',
      );
      const match = corrected.match(sentencePattern);
      if (match && match[0].trim().length > 0) {
        corrected = corrected.replace(match[0], '');
      } else {
        // Fallback: just remove the specific phrase
        corrected = corrected.replace(
          new RegExp(escapeRegExp(issue.text), 'gi'),
          '',
        );
      }
      continue;
    }

    // Type-based corrections
    switch (issue.type) {
      case 'assumption': {
        // Prepend disclaimer to the sentence containing the assumption
        const sentencePattern = new RegExp(
          `([^.!?]*${escapeRegExp(issue.text)}[^.!?]*[.!?])`,
          'i',
        );
        const match = corrected.match(sentencePattern);
        if (match) {
          const sentence = match[1].trim();
          // Check if disclaimer already present
          if (!sentence.startsWith("I don't have data to confirm this, but")) {
            corrected = corrected.replace(
              sentence,
              `I don't have data to confirm this, but ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
            );
          }
        }
        break;
      }

      case 'invented_pattern': {
        // Replace definitive pattern claim with hedged version
        if (issue.correction) {
          // Use the specific correction provided
          const sentencePattern = new RegExp(
            `([^.!?]*${escapeRegExp(issue.text)}[^.!?]*[.!?])`,
            'i',
          );
          const match = corrected.match(sentencePattern);
          if (match) {
            const sentence = match[1].trim();
            corrected = corrected.replace(
              sentence,
              `${issue.correction}${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
            );
          }
        } else {
          // Generic hedge
          const pattern = new RegExp(escapeRegExp(issue.text), 'gi');
          corrected = corrected.replace(
            pattern,
            `I'm starting to notice a possible pattern, though I need more data — ${issue.text}`,
          );
        }
        break;
      }

      case 'vague_claim': {
        // Soften with "It's possible that..."
        const sentencePattern = new RegExp(
          `([^.!?]*${escapeRegExp(issue.text)}[^.!?]*[.!?])`,
          'i',
        );
        const match = corrected.match(sentencePattern);
        if (match) {
          const sentence = match[1].trim();
          // Don't double-soften
          if (!sentence.startsWith("It's possible that") && !sentence.startsWith("It seems")) {
            corrected = corrected.replace(
              sentence,
              `It's possible that ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
            );
          }
        }
        break;
      }

      case 'unverified_claim': {
        // Add uncertainty qualifier
        const sentencePattern = new RegExp(
          `([^.!?]*${escapeRegExp(issue.text)}[^.!?]*[.!?])`,
          'i',
        );
        const match = corrected.match(sentencePattern);
        if (match) {
          const sentence = match[1].trim();
          if (!sentence.startsWith('If') && !sentence.startsWith('When')) {
            corrected = corrected.replace(
              sentence,
              `Based on what I can see, ${sentence.charAt(0).toLowerCase()}${sentence.slice(1)}`,
            );
          }
        }
        break;
      }
    }
  }

  // Clean up any double spaces or orphaned punctuation from removals
  corrected = corrected
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/^\s+/, '')
    .replace(/\s+$/, '');

  return corrected;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ═══════════════════════════════════════════════════════════════
   Main Filter Function
   ═══════════════════════════════════════════════════════════════ */

/**
 * Filter an AI response for hallucinations, unsupported claims, and vague assumptions.
 *
 * This is the main entry point for post-generation filtering.
 * It checks for:
 * 1. Forbidden phrases from Section 3.2
 * 2. Vague assumption statements
 * 3. Pattern claims with insufficient data
 * 4. Auto-corrects issues by softening language, adding disclaimers, or removing unsupported claims
 *
 * @param response - The raw AI response text
 * @param report - The DataAvailabilityReport for the current user
 * @returns FilteredResponse with corrections applied
 */
export function filterResponseForHallucinations(
  response: string,
  report: DataAvailabilityReport,
): FilteredResponse {
  const allIssues: FilterIssue[] = [];
  const correctionsApplied: string[] = [];

  // ─── Step 1: Check forbidden phrases (Section 3.2) ───
  for (const rule of FORBIDDEN_PHRASE_RULES) {
    try {
      // Ensure the regex always has the global flag for matchAll
      const existingFlags = rule.pattern.flags || '';
      const globalFlags = existingFlags.includes('g') ? existingFlags : existingFlags + 'g';
      const globalPattern = new RegExp(rule.pattern.source, globalFlags);
      const matches = response.matchAll(globalPattern);
      for (const match of matches) {
        // Check if the context condition applies
        let isForbidden = true;

        if (rule.contextCheck) {
          const hasData = categoryHasData(rule.contextCheck, report);

          if (rule.contextMustBe === 'empty' && hasData) {
            // Not forbidden if the category actually has data
            isForbidden = false;
          }
          if (rule.contextMustBe === 'has_data' && !hasData) {
            // Not forbidden if the category doesn't have data (the opposite check)
            isForbidden = false;
          }
        }

        if (isForbidden && match.index !== undefined) {
          allIssues.push({
            type: rule.type,
            text: match[0],
            severity: rule.severity,
            suggestion: rule.suggestion,
            correction: undefined,
          });
        }
      }
    } catch (e) {
      // If a regex pattern fails to compile or matchAll fails, skip it
      // This prevents the entire filter from crashing on edge cases
      console.warn('[OutputFilter] Skipping rule due to error:', e);
    }
  }

  // ─── Step 2: Detect vague assumptions ───
  const vagueIssues = detectVagueAssumptions(response);
  allIssues.push(...vagueIssues);

  // ─── Step 3: Check pattern claims against data ───
  const patternIssues = checkPatternClaims(response, report);
  allIssues.push(...patternIssues);

  // ─── Step 4: Apply auto-corrections ───
  let filtered = response;
  if (allIssues.length > 0) {
    filtered = autoCorrect(response, allIssues);

    // Build corrections list for reporting
    for (const issue of allIssues) {
      if (issue.severity === 'critical') {
        correctionsApplied.push(`REMOVED: "${issue.text}" (${issue.type})`);
      } else {
        correctionsApplied.push(`SOFTENED: "${issue.text}" (${issue.type}, ${issue.severity}) → ${issue.suggestion}`);
      }
    }
  }

  // ─── Step 5: Determine if safe to send ───
  // A response is unsafe if there are critical issues that couldn't be fully corrected
  const hasUnresolvedCritical = allIssues.some(
    issue => issue.severity === 'critical' && issue.type === 'invented_pattern',
  );

  const safeToSend = !hasUnresolvedCritical;

  return {
    filtered,
    issuesFound: allIssues.length,
    correctionsApplied,
    safeToSend,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Helper Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Check if a data category has actual data.
 */
function categoryHasData(
  category: keyof DataAvailabilityReport,
  report: DataAvailabilityReport,
): boolean {
  const data = report[category];
  switch (category) {
    case 'profile':
      return (data as DataAvailabilityReport['profile']).exists;
    case 'tasks':
      return (data as DataAvailabilityReport['tasks']).count > 0;
    case 'reminders':
      return (data as DataAvailabilityReport['reminders']).activeCount > 0;
    case 'planner':
      return (data as DataAvailabilityReport['planner']).hasEventsToday ||
        (data as DataAvailabilityReport['planner']).hasEventsThisWeek;
    case 'goals':
      return (data as DataAvailabilityReport['goals']).count > 0;
    case 'habits':
      return (data as DataAvailabilityReport['habits']).count > 0;
    case 'moods':
      return (data as DataAvailabilityReport['moods']).historyLength > 0;
    case 'conversations':
      return (data as DataAvailabilityReport['conversations']).hasHistory;
    default:
      return false;
  }
}
