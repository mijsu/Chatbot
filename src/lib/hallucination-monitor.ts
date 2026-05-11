/**
 * Hallucination Detection Logging — Reality-Based Intelligence Protocol (Section 10)
 *
 * Logs all AI hallucination detections for analysis and monitoring.
 * This module is server-side only — used in API routes to record every
 * hallucination event detected by the output filter and data validator.
 *
 * Architecture:
 * ┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
 * │  Output Filter │ ──→ │  Hallucination   │ ──→ │  In-Memory Log   │
 * │  / Validator   │     │  Monitor         │     │  (max 1000)      │
 * └───────────────┘     └──────────────────┘     └──────────────────┘
 *                               ↓
 *                    ┌──────────────────┐
 *                    │  Stats & Recent  │
 *                    │  Queries         │
 *                    └──────────────────┘
 */

/* ═══════════════════════════════════════════════════════════════
   Section 10: Core Interfaces
   ═══════════════════════════════════════════════════════════════ */

export interface HallucinationLogEntry {
  timestamp: Date;
  conversationId: string;
  userInput: string;
  aiResponse: string;
  potentialHallucinations: PotentialHallucination[];
  dataAvailable: DataAvailabilitySnapshot;
  wasFiltered: boolean;
  correctionApplied: string | null;
  sentToUser: boolean;
}

export interface PotentialHallucination {
  type: HallucinationType;
  claim: string;
  dataSourceChecked: string;
  severity: Severity;
}

export type HallucinationType =
  | 'unverified_claim'
  | 'assumption'
  | 'invented_pattern'
  | 'vague_claim';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface DataAvailabilitySnapshot {
  tasksCount: number;
  hasMoodData: boolean;
  hasProfileDetails: boolean;
  conversationHistoryLength: number;
}

/* ═══════════════════════════════════════════════════════════════
   Section 10: Monitor Stats Interface
   ═══════════════════════════════════════════════════════════════ */

export interface HallucinationStats {
  totalResponses: number;
  totalIssuesDetected: number;
  totalAutoCorrected: number;
  totalBlocked: number;
  issueBreakdown: Record<HallucinationType, number>;
  dataQualityImpact: DataQualityImpact;
}

export interface DataQualityImpact {
  /** Responses with issues when little data was available (tasksCount <= 3) */
  lowDataIssueRate: number;
  /** Responses with issues when moderate data was available */
  moderateDataIssueRate: number;
  /** Responses with issues when rich data was available (tasksCount > 10 + profile + mood) */
  richDataIssueRate: number;
}

/* ═══════════════════════════════════════════════════════════════
   Section 10: HallucinationMonitor Class
   ═══════════════════════════════════════════════════════════════ */

const MAX_LOG_ENTRIES = 1000;

/**
 * In-memory hallucination detection log with a fixed-size ring buffer.
 * Oldest entries are discarded when the buffer overflows.
 */
export class HallucinationMonitor {
  private static entries: HallucinationLogEntry[] = [];

  /**
   * Store a hallucination log entry.
   * If the log exceeds MAX_LOG_ENTRIES, the oldest entry is discarded.
   */
  static log(entry: HallucinationLogEntry): void {
    // Truncate long strings to keep memory bounded
    const safeEntry: HallucinationLogEntry = {
      timestamp: entry.timestamp,
      conversationId: entry.conversationId,
      userInput: entry.userInput.slice(0, 200),
      aiResponse: entry.aiResponse.slice(0, 500),
      potentialHallucinations: entry.potentialHallucinations,
      dataAvailable: entry.dataAvailable,
      wasFiltered: entry.wasFiltered,
      correctionApplied: entry.correctionApplied,
      sentToUser: entry.sentToUser,
    };

    this.entries.push(safeEntry);

    // Discard oldest when over capacity
    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries.shift();
    }
  }

  /**
   * Return the most recent log entries, ordered newest-first.
   *
   * @param limit - Maximum number of entries to return (default 50)
   */
  static getRecent(limit: number = 50): HallucinationLogEntry[] {
    return this.entries.slice(-limit).reverse();
  }

  /**
   * Compute aggregate statistics across all logged entries.
   *
   * Returns:
   * - totalResponses: count of all logged responses
   * - totalIssuesDetected: sum of potentialHallucinations across all entries
   * - totalAutoCorrected: entries where wasFiltered is true
   * - totalBlocked: entries where sentToUser is false
   * - issueBreakdown: count per hallucination type
   * - dataQualityImpact: issue rates bucketed by data richness
   */
  static getStats(): HallucinationStats {
    const totalResponses = this.entries.length;

    let totalIssuesDetected = 0;
    let totalAutoCorrected = 0;
    let totalBlocked = 0;

    const issueBreakdown: Record<HallucinationType, number> = {
      unverified_claim: 0,
      assumption: 0,
      invented_pattern: 0,
      vague_claim: 0,
    };

    // Data quality impact buckets
    let lowDataTotal = 0;
    let lowDataWithIssues = 0;
    let moderateDataTotal = 0;
    let moderateDataWithIssues = 0;
    let richDataTotal = 0;
    let richDataWithIssues = 0;

    for (const entry of this.entries) {
      const issueCount = entry.potentialHallucinations.length;
      totalIssuesDetected += issueCount;

      if (entry.wasFiltered) {
        totalAutoCorrected++;
      }

      if (!entry.sentToUser) {
        totalBlocked++;
      }

      // Tally breakdown by type
      for (const h of entry.potentialHallucinations) {
        if (h.type in issueBreakdown) {
          issueBreakdown[h.type]++;
        }
      }

      // Bucket by data richness
      const dataRichness = classifyDataRichness(entry.dataAvailable);
      const hasIssues = issueCount > 0;

      switch (dataRichness) {
        case 'low':
          lowDataTotal++;
          if (hasIssues) lowDataWithIssues++;
          break;
        case 'moderate':
          moderateDataTotal++;
          if (hasIssues) moderateDataWithIssues++;
          break;
        case 'rich':
          richDataTotal++;
          if (hasIssues) richDataWithIssues++;
          break;
      }
    }

    return {
      totalResponses,
      totalIssuesDetected,
      totalAutoCorrected,
      totalBlocked,
      issueBreakdown,
      dataQualityImpact: {
        lowDataIssueRate: lowDataTotal > 0 ? lowDataWithIssues / lowDataTotal : 0,
        moderateDataIssueRate: moderateDataTotal > 0 ? moderateDataWithIssues / moderateDataTotal : 0,
        richDataIssueRate: richDataTotal > 0 ? richDataWithIssues / richDataTotal : 0,
      },
    };
  }

  /**
   * Clear all stored log entries.
   */
  static clear(): void {
    this.entries = [];
  }
}

/* ═══════════════════════════════════════════════════════════════
   Section 10: Convenience Function
   ═══════════════════════════════════════════════════════════════ */

export interface LogHallucinationDetectionParams {
  conversationId: string;
  userInput: string;
  aiResponse: string;
  potentialHallucinations: PotentialHallucination[];
  dataAvailable: DataAvailabilitySnapshot;
  wasFiltered: boolean;
  correctionApplied: string | null;
  sentToUser: boolean;
}

/**
 * Convenience function for logging hallucination detections from the chat API route.
 *
 * Automatically sets the timestamp so callers don't have to.
 * Truncates userInput to 200 chars and aiResponse to 500 chars.
 *
 * @example
 * ```ts
 * logHallucinationDetection({
 *   conversationId: 'conv-123',
 *   userInput: 'How am I doing today?',
 *   aiResponse: "You're probably feeling great based on your usual patterns!",
 *   potentialHallucinations: [
 *     { type: 'assumption', claim: "You're probably feeling great", dataSourceChecked: 'moods', severity: 'high' },
 *     { type: 'invented_pattern', claim: 'your usual patterns', dataSourceChecked: 'habits', severity: 'critical' },
 *   ],
 *   dataAvailable: { tasksCount: 0, hasMoodData: false, hasProfileDetails: false, conversationHistoryLength: 0 },
 *   wasFiltered: true,
 *   correctionApplied: 'Removed invented pattern, softened assumption',
 *   sentToUser: true,
 * });
 * ```
 */
export function logHallucinationDetection(
  params: LogHallucinationDetectionParams,
): void {
  HallucinationMonitor.log({
    timestamp: new Date(),
    conversationId: params.conversationId,
    userInput: params.userInput.slice(0, 200),
    aiResponse: params.aiResponse.slice(0, 500),
    potentialHallucinations: params.potentialHallucinations,
    dataAvailable: params.dataAvailable,
    wasFiltered: params.wasFiltered,
    correctionApplied: params.correctionApplied,
    sentToUser: params.sentToUser,
  });
}

/* ═══════════════════════════════════════════════════════════════
   Internal Helpers
   ═══════════════════════════════════════════════════════════════ */

type DataRichness = 'low' | 'moderate' | 'rich';

/**
 * Classify the richness of available data into one of three buckets:
 * - low:      minimal data (few tasks, no profile, no mood data)
 * - moderate: some data present but not comprehensive
 * - rich:     substantial data across categories
 */
function classifyDataRichness(snapshot: DataAvailabilitySnapshot): DataRichness {
  let score = 0;

  // Tasks contribute up to 3 points
  if (snapshot.tasksCount > 10) score += 3;
  else if (snapshot.tasksCount > 3) score += 2;
  else if (snapshot.tasksCount > 0) score += 1;

  // Profile contributes 2 points
  if (snapshot.hasProfileDetails) score += 2;

  // Mood data contributes 2 points
  if (snapshot.hasMoodData) score += 2;

  // Conversation history contributes up to 2 points
  if (snapshot.conversationHistoryLength > 10) score += 2;
  else if (snapshot.conversationHistoryLength > 0) score += 1;

  if (score >= 7) return 'rich';
  if (score >= 3) return 'moderate';
  return 'low';
}
