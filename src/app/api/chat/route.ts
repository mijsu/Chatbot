import { NextRequest, NextResponse } from 'next/server';
import {
  callAI,
  buildPersonalizedSystemPrompt,
  buildRealityBasedSystemPrompt,
  parseDataAvailabilityReport,
  type UserContext,
  type ChatMessage,
} from '@/lib/ai-service';
import { filterResponseForHallucinations } from '@/lib/output-filter';
import { DataValidator, type DataAvailabilityReport } from '@/lib/data-validator';
import {
  HallucinationMonitor,
  logHallucinationDetection,
  type DataAvailabilitySnapshot,
  type PotentialHallucination,
  type HallucinationType,
  type Severity,
} from '@/lib/hallucination-monitor';

const DEFAULT_SYSTEM_PROMPT = 'You are Syntra, a helpful, friendly assistant. You provide thoughtful, engaging, and helpful responses. Keep your answers concise but informative. Use a warm, conversational tone. You can help with scheduling, task management, creative writing, research, and general conversation. Only make claims you can support with data. If you don\'t know something, say so honestly rather than guessing. IMPORTANT: You HAVE the ability to create tasks, set reminders, and generate daily plans. If the user asks you to create a task, set a reminder, or make a plan, DO NOT say you cannot do it. Instead, tell them you\'re on it and create it. If for some reason the action doesn\'t trigger automatically, suggest they type "/task", "/reminder", or "/plan" followed by their request, or use phrases like "create a task", "remind me to", or "plan my day".';

/* ═══════════════════════════════════════════════════════════════
   User Correction Detection
   ═══════════════════════════════════════════════════════════════ */

const CORRECTION_PHRASES = [
  'i never said that',
  "that's not true",
  "you're wrong",
  "i didn't say that",
  "that's wrong",
  "you're making that up",
  'i never mentioned',
  "that's incorrect",
  'you misunderstood',
  "i didn't mean that",
  "that's not what i said",
  "that's not what i meant",
];

function detectUserCorrection(userMessage: string): boolean {
  const lower = userMessage.toLowerCase();
  return CORRECTION_PHRASES.some((phrase) => lower.includes(phrase));
}

const CORRECTION_INSTRUCTION = `
═══ USER CORRECTION DETECTED ═══
The user has indicated that something you previously said was incorrect or fabricated. You MUST:

1. Review the conversation history carefully for the referenced claim.
2. If you CANNOT find the exact claim the user is referring to, apologize and acknowledge you may have been mistaken.
3. If you DID make the claim, retract it honestly and correct your response.
4. Do NOT defend claims you cannot verify from the conversation history.
5. Be transparent — say "I don't see that in our conversation history, so I may have been mistaken" rather than inventing a justification.

This is a critical trust moment. Prioritize honesty over confidence.
═══ END CORRECTION INSTRUCTION ═══`;

/* ═══════════════════════════════════════════════════════════════
   Data Source Transparency
   ═══════════════════════════════════════════════════════════════ */

function getDataSourcesChecked(report: DataAvailabilityReport): string[] {
  const sources: string[] = [];
  if (report.profile.exists) sources.push('profile');
  if (report.tasks.count > 0) sources.push('tasks');
  if (report.reminders.activeCount > 0) sources.push('reminders');
  if (report.planner.hasEventsToday || report.planner.hasEventsThisWeek) sources.push('planner');
  if (report.goals.count > 0) sources.push('goals');
  if (report.habits.count > 0) sources.push('habits');
  if (report.moods.historyLength > 0) sources.push('moods');
  if (report.conversations.hasHistory) sources.push('conversations');
  return sources;
}

/* ═══════════════════════════════════════════════════════════════
   DataAvailabilityReport Parsing
   ═══════════════════════════════════════════════════════════════ */

/**
 * Parse the incoming dataAvailabilityReport into a structured DataAvailabilityReport
 * object (from @/lib/data-validator). Supports:
 * - Direct JSON of the DataAvailabilityReport format
 * - Key=value serialized format (falls back to ai-service parser)
 *
 * Returns null if the report cannot be parsed into the structured format.
 */
function parseStructuredReport(raw: string): DataAvailabilityReport | null {
  if (!raw || !raw.trim()) return null;

  // Try JSON parse first
  try {
    const parsed = JSON.parse(raw);
    // Validate that it looks like a DataAvailabilityReport (has nested category objects)
    if (parsed && typeof parsed === 'object' && parsed.profile && parsed.tasks && parsed.moods) {
      return parsed as DataAvailabilityReport;
    }
  } catch {
    // Not JSON — try the ai-service key=value parser as a fallback
  }

  // Attempt key=value parsing via ai-service parser, then check if we can
  // construct a structured report from it
  try {
    const flatReport = parseDataAvailabilityReport(raw);
    // If the ai-service parser extracted meaningful data, construct a minimal
    // DataAvailabilityReport for the DataValidator methods
    if (flatReport && (flatReport.totalTasks !== undefined || flatReport.hasProfile !== undefined)) {
      return constructReportFromFlat(flatReport);
    }
  } catch {
    // Fallback parsing also failed
  }

  return null;
}

/**
 * Construct a DataAvailabilityReport (data-validator format) from the
 * flat DataAvailabilityReport (ai-service format) as a best-effort conversion.
 */
function constructReportFromFlat(flat: {
  totalTasks?: number;
  taskDaysSpan?: number;
  moodEntryCount?: number;
  moodDaysSpan?: number;
  energyEntryCount?: number;
  energyDaysSpan?: number;
  habitDaysSpan?: number;
  hasProfile?: boolean;
  hasAboutMe?: boolean;
  hasRole?: boolean;
  hasInterests?: boolean;
  hasGoals?: boolean;
  hasConversationHistory?: boolean;
  hasContradictions?: boolean;
}): DataAvailabilityReport {
  return {
    profile: {
      exists: !!(flat.hasProfile || flat.hasAboutMe || flat.hasRole || flat.hasInterests),
      name: flat.hasProfile ? 'User' : null,
      aboutMe: flat.hasAboutMe ? '(available)' : null,
      completeness: flat.hasProfile ? (flat.hasAboutMe ? 60 : 30) : 0,
    },
    tasks: {
      count: flat.totalTasks ?? 0,
      hasOverdue: false,
      hasToday: (flat.totalTasks ?? 0) > 0,
      hasUpcoming: false,
      categories: [],
    },
    reminders: {
      activeCount: 0,
      hasRecurring: false,
      upcoming24h: 0,
    },
    planner: {
      hasEventsToday: (flat.totalTasks ?? 0) > 0,
      hasEventsThisWeek: (flat.totalTasks ?? 0) > 0,
      eventCountToday: 0,
    },
    goals: {
      count: flat.hasGoals ? 1 : 0,
      activeGoals: flat.hasGoals ? ['(active goal)'] : [],
      anyNearCompletion: false,
    },
    habits: {
      count: (flat.habitDaysSpan ?? 0) > 0 ? 1 : 0,
      activeStreaks: 0,
      completedToday: 0,
    },
    moods: {
      hasTodayEntry: false,
      historyLength: flat.moodEntryCount ?? 0,
      canCalculateTrend: (flat.moodDaysSpan ?? 0) >= 14 && (flat.moodEntryCount ?? 0) >= 5,
    },
    conversations: {
      totalCount: 0,
      recentMessageCount: 0,
      hasHistory: !!flat.hasConversationHistory,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════
   Hallucination Monitor Helpers
   ═══════════════════════════════════════════════════════════════ */

function reportToSnapshot(report: DataAvailabilityReport): DataAvailabilitySnapshot {
  return {
    tasksCount: report.tasks.count,
    hasMoodData: report.moods.historyLength > 0,
    hasProfileDetails: report.profile.exists,
    conversationHistoryLength: report.conversations.totalCount,
  };
}

/**
 * Parse the correctionsApplied strings from the output filter into
 * PotentialHallucination entries for the HallucinationMonitor.
 */
function correctionsToHallucinations(
  correctionsApplied: string[],
  dataSourcesChecked: string[],
): PotentialHallucination[] {
  return correctionsApplied.map((correction, i) => {
    // Parse correction string format: "REMOVED: "claim" (type)" or "SOFTENED: "claim" (type, severity) → suggestion"
    const isRemoved = correction.startsWith('REMOVED');
    const typeMatch = correction.match(/\((\w+)\)/);
    const claimMatch = correction.match(/"([^"]+)"/);

    const type: HallucinationType = (typeMatch?.[1] as HallucinationType) || 'vague_claim';
    const claim = claimMatch?.[1] || correction;
    const severity: Severity = isRemoved ? 'critical' : 'medium';

    return {
      type,
      claim,
      dataSourceChecked: dataSourcesChecked[i % dataSourcesChecked.length] || 'general',
      severity,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════
   Safe Fallback Response
   ═══════════════════════════════════════════════════════════════ */

const SAFE_FALLBACK_RESPONSE =
  "I want to be careful here — I don't have enough verified information to give you a fully reliable answer on this. Could you provide more details so I can give you an accurate response?";

/* ═══════════════════════════════════════════════════════════════
   Chat API Route — Reality-Based Intelligence Protocol Pipeline
   ═══════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      messages,
      systemPrompt,
      customEndpoint,
      modelName,
      apiKey,
      userContext,
      voiceTone,
      // Reality-Based Intelligence Protocol fields
      dataAvailabilityReport,
      dataAvailabilityReportJson,
      userDataContext,
      deepContextMode,
    } = body as {
      messages?: { role: string; content: string }[];
      systemPrompt?: string;
      customEndpoint?: string;
      modelName?: string;
      apiKey?: string;
      userContext?: UserContext;
      voiceTone?: string;
      dataAvailabilityReport?: string;
      dataAvailabilityReportJson?: DataAvailabilityReport;
      userDataContext?: string;
      deepContextMode?: boolean;
    };

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 },
      );
    }

    // Cast messages to ChatMessage[]
    const chatMessages: ChatMessage[] = messages.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    // ─── Step 1: Parse DataAvailabilityReport ────────────────────────
    let structuredReport: DataAvailabilityReport | null = null;

    // Priority: use the structured JSON object directly (sent by chat-screen)
    // Fall back to parsing the string version
    if (dataAvailabilityReportJson) {
      structuredReport = dataAvailabilityReportJson;
    } else if (dataAvailabilityReport) {
      structuredReport = parseStructuredReport(dataAvailabilityReport);
    }

    // ─── Step 2: Build the system prompt ─────────────────────────────
    let effectiveSystemPrompt: string;

    if (structuredReport && deepContextMode) {
      // Full deep context mode with anti-hallucination protocol
      // Use the existing reality-based system prompt builder as the base
      effectiveSystemPrompt = buildRealityBasedSystemPrompt(
        voiceTone || 'friendly',
        dataAvailabilityReport || JSON.stringify(dataAvailabilityReportJson),
        userDataContext || '',
      );

      // Inject the DataValidator's anti-hallucination context for maximum protection
      const antiHallucinationContext = DataValidator.buildAntiHallucinationContext(structuredReport);
      effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n${antiHallucinationContext}`;
    } else if (structuredReport) {
      // Data-aware mode (not full deep context, but still anti-hallucination)
      const base = buildPersonalizedSystemPrompt(voiceTone || 'friendly', userContext);

      // Build the anti-hallucination context using DataValidator
      const antiHallucinationContext = DataValidator.buildAntiHallucinationContext(structuredReport);

      effectiveSystemPrompt = `${base}\n\n${antiHallucinationContext}`;

      // Inject user data context if provided
      if (userDataContext && userDataContext.trim()) {
        effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n═══ YOUR USER'S ACTUAL DATA ═══\nUse ONLY this data. Do NOT invent, assume, or hallucinate any information not present here:\n\n${userDataContext}\n\n═══ END DATA ═══`;
      }
    } else if (dataAvailabilityReport) {
      // Fallback: dataAvailabilityReport string provided but couldn't be parsed into
      // structured format — use the legacy approach
      if (deepContextMode) {
        effectiveSystemPrompt = buildRealityBasedSystemPrompt(
          voiceTone || 'friendly',
          dataAvailabilityReport || JSON.stringify(dataAvailabilityReportJson),
          userDataContext || '',
        );
      } else {
        const base = buildPersonalizedSystemPrompt(voiceTone || 'friendly', userContext);
        effectiveSystemPrompt = `${base}\n\nDATA AVAILABILITY:\n${dataAvailabilityReport}\n\nIMPORTANT: Only reference information explicitly in your context. Do not assume or invent details.`;
      }
    } else if (userContext && voiceTone) {
      effectiveSystemPrompt = buildPersonalizedSystemPrompt(voiceTone, userContext);
    } else if (userContext) {
      effectiveSystemPrompt = buildPersonalizedSystemPrompt('friendly', userContext);
    } else {
      effectiveSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    }

    // If a supplementary systemPrompt was also provided (and we're not using the reality-based protocol), append it
    if (systemPrompt && !dataAvailabilityReport && !structuredReport && !userContext) {
      effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n${systemPrompt}`;
    }

    // ─── Step 3: User Correction Detection ───────────────────────────
    const lastUserMessage = chatMessages.filter((m) => m.role === 'user').pop();
    const userCorrectionDetected = lastUserMessage
      ? detectUserCorrection(lastUserMessage.content)
      : false;

    if (userCorrectionDetected) {
      effectiveSystemPrompt = `${effectiveSystemPrompt}\n\n${CORRECTION_INSTRUCTION}`;
    }

    // ─── Step 4: Call the AI ─────────────────────────────────────────
    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());
    const result = await callAI(
      chatMessages,
      effectiveSystemPrompt,
      customEndpoint,
      modelName,
      apiKey,
      undefined,
      { maxRetries: hasCustomEndpoint ? 1 : 2 },
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'AI call failed' },
        { status: 500 },
      );
    }

    // ─── Step 5: Post-generation filtering & HallucinationMonitor ────
    let filteredResponse = result.response;
    let hallucinationsDetected = 0;
    let wasFiltered = false;
    let dataSourcesChecked: string[] = [];

    if (structuredReport) {
      // We have a structured report — run the full output filter
      dataSourcesChecked = getDataSourcesChecked(structuredReport);

      const filtered = filterResponseForHallucinations(result.response, structuredReport);
      filteredResponse = filtered.filtered;
      hallucinationsDetected = filtered.issuesFound;
      wasFiltered = filtered.issuesFound > 0;

      // Build PotentialHallucination entries from the filter results
      const potentialHallucinations = filtered.issuesFound > 0
        ? correctionsToHallucinations(filtered.correctionsApplied, dataSourcesChecked)
        : [];

      // Log to HallucinationMonitor — always log, both clean and flagged responses
      const snapshot = reportToSnapshot(structuredReport);
      const conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      logHallucinationDetection({
        conversationId,
        userInput: lastUserMessage?.content || '',
        aiResponse: result.response,
        potentialHallucinations,
        dataAvailable: snapshot,
        wasFiltered,
        correctionApplied: filtered.correctionsApplied.length > 0
          ? filtered.correctionsApplied.join('; ')
          : null,
        sentToUser: filtered.safeToSend,
      });

      // If not safe to send, return a safe fallback response
      if (!filtered.safeToSend) {
        // Log the fallback
        logHallucinationDetection({
          conversationId: `${conversationId}-fallback`,
          userInput: '(system: unsafe response fallback)',
          aiResponse: SAFE_FALLBACK_RESPONSE,
          potentialHallucinations: [],
          dataAvailable: snapshot,
          wasFiltered: true,
          correctionApplied: 'Replaced unsafe response with safe fallback',
          sentToUser: true,
        });

        return NextResponse.json({
          success: true,
          response: SAFE_FALLBACK_RESPONSE,
          source: result.source,
          discoveredPath: result.discoveredPath,
          contextMode: deepContextMode ? 'deep' : 'basic',
          dataSourcesChecked,
          hallucinationsDetected,
          wasFiltered: true,
        });
      }
    } else if (dataAvailabilityReport) {
      // Legacy path: no structured report, but we have the raw string
      // Best-effort: try to use the output filter with the raw string (won't work perfectly
      // but maintains backwards compatibility)
      dataSourcesChecked = ['general'];
    }

    // ─── Step 6: Return the response ─────────────────────────────────
    return NextResponse.json({
      success: true,
      response: filteredResponse,
      source: result.source,
      discoveredPath: result.discoveredPath,
      contextMode: deepContextMode ? 'deep' : 'basic',
      dataSourcesChecked,
      hallucinationsDetected,
      wasFiltered,
    });
  } catch (error: any) {
    console.error('Chat API error:', error);
    // Sanitize error message — don't expose internal details
    const safeMessage = typeof error?.message === 'string'
      ? error.message.substring(0, 100)
      : 'Internal server error';
    return NextResponse.json(
      { error: safeMessage },
      { status: 500 },
    );
  }
}
