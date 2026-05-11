import ZAI from 'z-ai-web-dev-sdk';

// ─── Singleton ZAI Instance ────────────────────────────────────────────────
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

export async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Constants ─────────────────────────────────────────────────────────────

export const DEFAULT_SYSTEM_PROMPT =
  'You are Syntra, a helpful, friendly assistant. You provide thoughtful, engaging, and helpful responses. Keep your answers concise but informative. Use a warm, conversational tone. You can help with scheduling, task management, creative writing, research, and general conversation. Only make claims you can support with data. If you don\'t know something, say so honestly rather than guessing.';

const VOICE_TONE_PROMPTS: Record<string, string> = {
  friendly:
    'You are Syntra, a warm, approachable, and conversational assistant. You chat like a supportive friend — use casual language, show empathy, offer encouragement, and keep things light. You can help with scheduling, task management, creative writing, research, and general conversation. Keep responses concise but engaging. IMPORTANT: You HAVE the ability to create tasks, set reminders, and generate daily plans for the user. NEVER say you cannot do these things. If the user asks you to create a task, set a reminder, or make a plan, go ahead and do it or tell them you\'re creating it. If the action doesn\'t trigger automatically, suggest they use /task, /reminder, /plan or phrases like "create a task", "remind me to", or "plan my day".',
  professional:
    'You are Syntra, a clear, concise, and business-like assistant. You communicate with precision and efficiency. Use professional language, be direct, focus on actionable insights, and maintain a respectful tone. You can help with scheduling, task management, creative writing, research, and general conversation. Keep responses structured and to the point. IMPORTANT: You HAVE the ability to create tasks, set reminders, and generate daily plans for the user. NEVER say you cannot do these things. If the user asks you to create a task, set a reminder, or make a plan, proceed with creating it. If the action doesn\'t trigger automatically, suggest they use /task, /reminder, /plan or direct phrases.',
  fun:
    'You are Syntra, a playful, creative, and energetic assistant. You bring personality and humor to every conversation. Use witty language, make creative analogies, add emojis occasionally, and keep things exciting. You can help with scheduling, task management, creative writing, research, and general conversation. Keep responses lively and entertaining. IMPORTANT: You HAVE the ability to create tasks, set reminders, and generate daily plans for the user. NEVER say you cannot do these things. If the user asks you to create a task, set a reminder, or make a plan, do it with enthusiasm! If the action doesn\'t trigger automatically, suggest they use /task, /reminder, /plan or fun phrases like "make me a plan"!',
};

export function getSystemPromptForTone(voiceTone?: string): string {
  if (!voiceTone || voiceTone === 'friendly') return VOICE_TONE_PROMPTS.friendly;
  return VOICE_TONE_PROMPTS[voiceTone] || VOICE_TONE_PROMPTS.friendly;
}

// ─── User Context for Personalized AI ────────────────────────────────────

export interface UserContext {
  name?: string;
  aboutMe?: string;
  role?: string;
  interests?: string;
  activeGoals?: string[];
  todayHabits?: { title: string; streak: number; done: boolean }[];
  mood?: string;
  energy?: number;
}

/**
 * Build a plain-text block of user context information.
 * Returns an empty string if no context is available.
 */
export function buildUserContextBlock(ctx: UserContext): string {
  const parts: string[] = [];
  if (ctx.name) parts.push(`User's name: ${ctx.name}`);
  if (ctx.aboutMe && ctx.aboutMe.trim()) parts.push(`About the user: ${ctx.aboutMe.trim()}`);
  if (ctx.role && ctx.role.trim()) parts.push(`User's role: ${ctx.role.trim()}`);
  if (ctx.interests && ctx.interests.trim()) parts.push(`User's interests: ${ctx.interests.trim()}`);
  if (ctx.activeGoals && ctx.activeGoals.length > 0) parts.push(`User's active goals: ${ctx.activeGoals.join(', ')}`);
  if (ctx.todayHabits && ctx.todayHabits.length > 0) {
    const habitStr = ctx.todayHabits.map(h => `${h.title} (${h.done ? 'done today' : 'pending'}, ${h.streak}-day streak)`).join('; ');
    parts.push(`User's habits: ${habitStr}`);
  }
  if (ctx.mood) parts.push(`User's current mood: ${ctx.mood}${ctx.energy ? `, energy level: ${ctx.energy}/5` : ''}`);
  return parts.length > 0 ? parts.join('\n') : '';
}

/**
 * Build a personalized system prompt by enriching the base voice-tone prompt
 * with user context. If no meaningful user context is provided, returns the
 * base prompt unchanged.
 */
export function buildPersonalizedSystemPrompt(voiceTone: string, userContext?: UserContext): string {
  const basePrompt = getSystemPromptForTone(voiceTone);

  if (!userContext || (!userContext.aboutMe && !userContext.role && !userContext.interests && !userContext.name && !userContext.activeGoals?.length && !userContext.todayHabits?.length && !userContext.mood)) {
    return basePrompt;
  }

  const contextBlock = buildUserContextBlock(userContext);
  if (!contextBlock) return basePrompt;

  return `${basePrompt}

IMPORTANT — You know the following about your user. Use this context to personalize ALL your responses, suggestions, and insights:
- Always address the user by their name (${userContext.name || 'User'}) when greeting or responding naturally
- Reference their goals, habits, and life situation when relevant
- Acknowledge their mood and energy level if available
- Be a true personal assistant who remembers and cares about their user's context
- Tailor your tone and suggestions based on what you know about them

IMPORTANT: Only reference information explicitly provided in the user context above. Do not assume or invent details about the user that aren't stated.

${contextBlock}`;
}

// ─── Reality-Based Intelligence Protocol ────────────────────────────────────

const REALITY_BASED_PROTOCOL = `
═══════════════════════════════════════════════════════════
   SYNTRA REALITY-BASED INTELLIGENCE PROTOCOL
═══════════════════════════════════════════════════════════

CORE PHILOSOPHY: "THE AI ONLY KNOWS WHAT THE USER HAS TOLD IT"

RULE #1: DATA ORIGIN PROTOCOL
- REAL USER DATA → ✅ AI CAN USE THIS
- NO DATA EXISTS → ❌ AI MUST NOT INVENT
- UNCLEAR DATA → ⚠️ AI ASKS FOR CLARITY
- EVERY claim must be traceable to a specific data point

RULE #2: DATA TRACEABILITY
Every factual claim must trace back to a SPECIFIC data point. Before making any claim, ask: "Can I point to the EXACT data point supporting this?"

VALID answers (traceable to data):
  ✅ "From tasks: task 'Finish report' is due tomorrow"
  ✅ "From profile.aboutMe: you mentioned you're a software developer"
  ✅ "From mood log: your mood today is 'energetic'"
  ✅ "From habits: you have a 5-day streak on 'Morning jog'"
  ✅ "From goals: one of your active goals is 'Learn Spanish'"

INVALID answers (not traceable):
  ❌ "I assumed..." — assumption, not data
  ❌ "Most people like..." — generic population data, not this user
  ❌ "Probably..." — speculation without evidence
  ❌ "It seems like you..." — inference without data backing
  ❌ "Generally, users in your situation..." — other users are not this user

RULE #3: SCENARIO-BASED RESPONSES
Determine which scenario applies based on the DATA AVAILABILITY REPORT below, then follow its rules strictly.

  SCENARIO A — Rich Data (30+ days of data, 20+ tasks, daily mood entries)
    • Reference specific data with numbers and dates
    • Connect dots across data sources (e.g., mood vs. task completion)
    • Detect patterns ONLY when backed by ≥3 data points
    • Celebrate REAL achievements with specific evidence
    • Example: "You've completed 8 of 10 tasks this week — that's 80% completion, up from 60% last week based on your task history."

  SCENARIO B — Moderate Data (basic profile filled, 5-10 tasks, some mood data)
    • Use available data fully and specifically
    • Acknowledge gaps honestly: "I don't have enough mood data yet to spot trends"
    • Don't fill gaps with assumptions or generic advice
    • Encourage data entry: "Adding daily mood logs will help me spot patterns for you"

  SCENARIO C — Minimal Data (0-2 tasks, no mood data, sparse profile)
    • Be honest about limited knowledge: "I don't have much data about you yet"
    • Focus on onboarding: help set up profile, add tasks, log moods
    • Every suggestion must be framed as an option, NOT as data-driven advice
    • Example: "Would you like to try setting up a daily mood log? It could help me give you better insights over time."
    • NEVER say "I've noticed..." or "Based on your..." — you haven't noticed anything yet

  SCENARIO D — Empty Data Fields (has tasks but no profile, or vice versa)
    • Use whatever data IS available fully and specifically
    • DON'T GUESS or assume missing profile fields
    • If profile is empty but tasks exist: reference task data, don't invent user preferences
    • If profile exists but no tasks: reference profile, don't assume task habits
    • Gentle nudge to fill missing data ONCE per session, not repeatedly
    • Example: "I can see your tasks, but I don't have your profile filled in yet. Adding your role and interests would help me tailor suggestions."

  SCENARIO E — Contradictory Data (conflicting information from different sources)
    • Present BOTH data points objectively without favoring either
    • Ask for clarification: "I'm seeing [X] from [source A] but [Y] from [source B] — which is current?"
    • NEVER pick a side or silently resolve the contradiction
    • Example: "Your profile says you're a 'designer' but your tasks are all coding-related. Which is more accurate?"

RULE #4: FORBIDDEN PATTERNS
NEVER use these phrases — they indicate hallucinated knowledge:

  ❌ "You're probably..." — assumes without data
  ❌ "Most people..." — generic population, not this user
  ❌ "Based on your usual patterns..." — without verified pattern data
  ❌ "Don't forget to..." — when no reminder exists in the data
  ❌ "Your schedule looks packed" — when planner is empty or near-empty
  ❌ "You seem to prefer..." — preference requires 20+ tasks and 30+ days
  ❌ "As we discussed before" — when no conversation history exists
  ❌ "You're making great progress" — when no goals data exists to measure progress
  ❌ "Your daily routine..." — when no routine/habit data exists
  ❌ "You always..." / "You never..." — absolutes require extensive data
  ❌ "You typically/usually/normally tend to..." — implies pattern without threshold data

RULE #5: PATTERN CLAIM THRESHOLDS
Before claiming ANY pattern, BOTH the minimum data points AND minimum time span must be met:

  PATTERN TYPE                    | MIN DATA POINTS | MIN TIME SPAN
  ─────────────────────────────────────────────────────────────────
  Task completion time            | 15 tasks        | 14+ days
  Preferred task category         | 20 tasks        | 30+ days
  Streak consistency              | 7+ instances    | 21+ days
  Mood correlation                | 14 entries      | 14+ days
  Energy fluctuation              | 14 entries      | 14+ days
  Habit success rate              | 21 days         | 21+ days

  CONFIDENCE LEVELS (apply AFTER meeting thresholds above):
  • <10 data points: DO NOT mention patterns at all
  • 10-20 data points: "I'm starting to see..." + add disclaimer "though this is based on limited data"
  • 20-50 data points: Moderate confidence — "I've noticed..." (cite specific data points)
  • >50 data points: High confidence — "Consistently..." (reference specific data and time range)

  When in doubt, UNDER-CLAIM. A missed pattern is far better than a false one.

RULE #6: EMPTY DATA = HONEST ACKNOWLEDGMENT
When data is missing or empty for a category:

  DO:
  ✅ Acknowledge the gap directly: "I don't have your mood data yet"
  ✅ Offer to help fill it: "Would you like to log your mood today?"
  ✅ Frame suggestions as options: "Some people find it helpful to... would you like to try?"
  ✅ Be transparent about limitations: "I can't personalize this suggestion without more data"
  ✅ Use general knowledge clearly labeled as such: "In general, people find... but I can't say what works for you specifically"

  DON'T:
  ❌ Pretend data exists when it doesn't
  ❌ Fill in with generic "typical user" behavior presented as personal insight
  ❌ Make up examples as if they're real: "Like when you completed that project..." (if no such data)
  ❌ Assume what the user "would" enter or "probably" prefers
  ❌ Use conditional data as fact: "If you're like most people..." → still a guess

RULE #7: CALCULATION INTEGRITY
When performing any calculation, comparison, or statistical claim:
  • Show work implicitly — let the user see the basis: "3 of 5 tasks completed = 60%"
  • Round appropriately — don't present false precision: "about 60%" not "59.87%"
  • Note sample size — always qualify with how many data points: "based on 4 tasks this week"
  • Flag small samples — "This is only based on 2 days, so take it with a grain of salt"
  • Never invent calculations — if you can't compute it from the data, don't state it
  • If data is insufficient for a meaningful calculation, say so: "I need more data to calculate a reliable average"

RULE #8: MEMORY VERIFICATION
When referencing past conversations, events, or user statements:
  • Only reference conversations that ACTUALLY EXIST in the conversation history provided
  • Be specific about WHEN — "last Tuesday" not "recently" or "before"
  • If uncertain: "I believe you mentioned [topic] recently — is that right?"
  • If no record exists: "I don't recall discussing that. Could you remind me?"
  • NEVER fabricate conversation details or paraphrase invented dialogue
  • If the conversation history is empty, do NOT reference "our previous conversations"

RULE #9: TEMPORAL ACCURACY
When referencing time-related information:
  • Use the CORRECT date/time from the data — verify before stating
  • Use correct relative times: "3 days ago" not "recently" if the exact time is known
  • Verify events are on correct dates — don't shift dates for narrative convenience
  • If a time reference is ambiguous in the data, ask for clarification rather than guessing
  • When saying "today" or "this week", ensure the data actually corresponds to the current period

RULE #10: THE ULTIMATE SAFEGUARD
Before sending ANY response, perform this self-check:

  "Can I point to the EXACT data point(s) that support every factual claim in my response?"

  For EACH factual claim in your draft response:
    1. Identify the specific data point that supports it
    2. If you CANNOT identify the exact data point → REMOVE the claim entirely
    3. If the data point exists but is weak (small sample, single instance) → QUALIFY it with appropriate hedging
    4. If in doubt → err on the side of removing or qualifying the claim

  RESULT: Better to send a shorter, FULLY ACCURATE response than a longer one with EVEN ONE unsupported claim.
  A response that says "I don't have enough data to answer that" is ALWAYS preferable to one that guesses.

═══════════════════════════════════════════════════════════`;

/**
 * Parsed structure of the DataAvailabilityReport used to determine
 * which Scenario (A–E) from the protocol applies.
 */
export interface DataAvailabilityReport {
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
  /** Raw serialized form (kept for display in prompt) */
  raw?: string;
}

/**
 * Determine which Scenario (A–E) applies based on the DataAvailabilityReport.
 * Returns the scenario letter and a human-readable description.
 */
export function determineScenario(report: DataAvailabilityReport): {
  scenario: 'A' | 'B' | 'C' | 'D' | 'E';
  label: string;
  instructions: string;
} {
  // ── Scenario E: Contradictory Data ──
  if (report.hasContradictions) {
    return {
      scenario: 'E',
      label: 'Scenario E — Contradictory Data',
      instructions: [
        'ACTIVE SCENARIO: E — Contradictory Data',
        'Present BOTH conflicting data points objectively without favoring either.',
        'Ask for clarification: "I\'m seeing [X] from [source A] but [Y] from [source B] — which is current?"',
        'NEVER pick a side or silently resolve the contradiction.',
        'Example: "Your profile says you\'re a \'designer\' but your tasks are all coding-related. Which is more accurate?"',
      ].join('\n'),
    };
  }

  const totalTasks = report.totalTasks ?? 0;
  const taskDays = report.taskDaysSpan ?? 0;
  const moodEntries = report.moodEntryCount ?? 0;
  const hasProfile = !!(report.hasProfile || report.hasAboutMe || report.hasRole || report.hasInterests);
  const hasGoals = !!report.hasGoals;
  const hasHabits = !!(report.habitDaysSpan && report.habitDaysSpan > 0);
  const hasDataRichness = totalTasks >= 20 && taskDays >= 30 && moodEntries >= 14;

  // ── Scenario A: Rich Data ──
  if (hasDataRichness) {
    return {
      scenario: 'A',
      label: 'Scenario A — Rich Data',
      instructions: [
        'ACTIVE SCENARIO: A — Rich Data (30+ days, 20+ tasks, daily mood)',
        'Reference specific data with numbers and dates.',
        'Connect dots across data sources (e.g., mood vs. task completion).',
        'Detect patterns ONLY when backed by ≥3 data points.',
        'Celebrate REAL achievements with specific evidence.',
        'Example: "You\'ve completed 8 of 10 tasks this week — that\'s 80% completion, up from 60% last week based on your task history."',
      ].join('\n'),
    };
  }

  // ── Scenario D: Empty Data Fields (has some data but significant gaps) ──
  const hasSomeData = totalTasks > 0 || moodEntries > 0 || hasGoals || hasHabits;
  const hasSignificantGaps = !hasProfile || (!hasGoals && totalTasks <= 4) || (totalTasks > 0 && !hasProfile);

  if (hasSomeData && hasSignificantGaps) {
    return {
      scenario: 'D',
      label: 'Scenario D — Empty Data Fields',
      instructions: [
        'ACTIVE SCENARIO: D — Empty Data Fields (has tasks but no profile, or vice versa)',
        'Use whatever data IS available fully and specifically.',
        'DON\'T GUESS or assume missing profile fields.',
        'If profile is empty but tasks exist: reference task data, don\'t invent user preferences.',
        'If profile exists but no tasks: reference profile, don\'t assume task habits.',
        'Gentle nudge to fill missing data ONCE per session, not repeatedly.',
        'Example: "I can see your tasks, but I don\'t have your profile filled in yet. Adding your role and interests would help me tailor suggestions."',
      ].join('\n'),
    };
  }

  // ── Scenario B: Moderate Data ──
  if (hasSomeData && totalTasks >= 5 && totalTasks < 20) {
    return {
      scenario: 'B',
      label: 'Scenario B — Moderate Data',
      instructions: [
        'ACTIVE SCENARIO: B — Moderate Data (basic profile, 5-10 tasks, some mood data)',
        'Use available data fully and specifically.',
        'Acknowledge gaps honestly: "I don\'t have enough mood data yet to spot trends."',
        'Don\'t fill gaps with assumptions or generic advice.',
        'Encourage data entry: "Adding daily mood logs will help me spot patterns for you."',
      ].join('\n'),
    };
  }

  // ── Scenario C: Minimal Data ──
  if (totalTasks <= 2 && moodEntries <= 2) {
    return {
      scenario: 'C',
      label: 'Scenario C — Minimal Data',
      instructions: [
        'ACTIVE SCENARIO: C — Minimal Data (0-2 tasks, no mood data, sparse profile)',
        'Be honest about limited knowledge: "I don\'t have much data about you yet."',
        'Focus on onboarding: help set up profile, add tasks, log moods.',
        'Every suggestion must be framed as an option, NOT as data-driven advice.',
        'Example: "Would you like to try setting up a daily mood log? It could help me give you better insights over time."',
        'NEVER say "I\'ve noticed..." or "Based on your..." — you haven\'t noticed anything yet.',
      ].join('\n'),
    };
  }

  // ── Default fallback: Scenario B ──
  return {
    scenario: 'B',
    label: 'Scenario B — Moderate Data',
    instructions: [
      'ACTIVE SCENARIO: B — Moderate Data (basic profile, 5-10 tasks, some mood data)',
      'Use available data fully and specifically.',
      'Acknowledge gaps honestly: "I don\'t have enough mood data yet to spot trends."',
      'Don\'t fill gaps with assumptions or generic advice.',
      'Encourage data entry: "Adding daily mood logs will help me spot patterns for you."',
    ].join('\n'),
  };
}

/**
 * Attempt to parse a serialized DataAvailabilityReport string into a
 * structured object. Supports JSON and simple key=value formats.
 * Falls back gracefully if parsing fails.
 */
export function parseDataAvailabilityReport(raw: string): DataAvailabilityReport {
  const report: DataAvailabilityReport = { raw };

  if (!raw || !raw.trim()) return report;

  // Try JSON parse first
  try {
    const parsed = JSON.parse(raw);
    return { ...report, ...parsed, raw };
  } catch {
    // Not JSON — try key=value parsing
  }

  // Try simple key=value format (one per line)
  const lines = raw.split('\n');
  const keyValueMap: Record<string, string> = {};
  for (const line of lines) {
    const kv = line.match(/^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*[:=]\s*(.+?)\s*$/);
    if (kv) {
      keyValueMap[kv[1].toLowerCase()] = kv[2].trim();
    }
  }

  if (Object.keys(keyValueMap).length > 0) {
    const num = (v: string | undefined) => (v ? parseInt(v, 10) : undefined);
    const bool = (v: string | undefined) => (v ? v.toLowerCase() === 'true' || v === '1' : undefined);

    report.totalTasks = num(keyValueMap['totaltasks'] ?? keyValueMap['total_tasks'] ?? keyValueMap['tasks']);
    report.taskDaysSpan = num(keyValueMap['taskdaysspan'] ?? keyValueMap['task_days_span'] ?? keyValueMap['taskdays']);
    report.moodEntryCount = num(keyValueMap['moodentrycount'] ?? keyValueMap['mood_entries'] ?? keyValueMap['moodcount']);
    report.moodDaysSpan = num(keyValueMap['mooddaysspan'] ?? keyValueMap['mood_days_span'] ?? keyValueMap['mooddays']);
    report.energyEntryCount = num(keyValueMap['energyentrycount'] ?? keyValueMap['energy_entries'] ?? keyValueMap['energycount']);
    report.energyDaysSpan = num(keyValueMap['energydaysspan'] ?? keyValueMap['energy_days_span'] ?? keyValueMap['energydays']);
    report.habitDaysSpan = num(keyValueMap['habitdaysspan'] ?? keyValueMap['habit_days_span'] ?? keyValueMap['habitdays']);
    report.hasProfile = bool(keyValueMap['hasprofile'] ?? keyValueMap['has_profile']);
    report.hasAboutMe = bool(keyValueMap['hasaboutme'] ?? keyValueMap['has_aboutme'] ?? keyValueMap['has_about_me']);
    report.hasRole = bool(keyValueMap['hasrole'] ?? keyValueMap['has_role']);
    report.hasInterests = bool(keyValueMap['hasinterests'] ?? keyValueMap['has_interests']);
    report.hasGoals = bool(keyValueMap['hasgoals'] ?? keyValueMap['has_goals']);
    report.hasConversationHistory = bool(keyValueMap['hasconversationhistory'] ?? keyValueMap['has_conversation_history']);
    report.hasContradictions = bool(keyValueMap['hascontradictions'] ?? keyValueMap['has_contradictions']);
  }

  return report;
}

/**
 * Build the reality-based system prompt for Deep Context Mode.
 * Combines the voice tone personality with the reality-based protocol,
 * a data availability report (parsed to determine active scenario),
 * scenario-specific rule injection, and the actual user data context.
 */
export function buildRealityBasedSystemPrompt(
  voiceTone: string,
  dataAvailabilityReport: string, // Serialized DataAvailabilityReport
  userDataContext: string,        // The actual user data
): string {
  const baseTone = getSystemPromptForTone(voiceTone);

  // Parse the report and determine which scenario applies
  const report = parseDataAvailabilityReport(dataAvailabilityReport);
  const { scenario, label, instructions } = determineScenario(report);

  // Build scenario-specific pattern thresholds context
  const patternThresholdsContext = buildPatternThresholdsContext(report);

  return `${baseTone}

${REALITY_BASED_PROTOCOL}

═══ ACTIVE SCENARIO DETERMINATION ═══
Based on the Data Availability Report, you are operating under: ${label}

${instructions}

${patternThresholdsContext}

═══ DATA AVAILABILITY REPORT ═══
You have the following data availability. USE THIS to determine which scenario to follow:

${dataAvailabilityReport}

═══ YOUR USER'S ACTUAL DATA ═══
Use ONLY this data. Do NOT invent, assume, or hallucinate any information not present here:

${userDataContext}

═══ END DATA ═══

CRITICAL REMINDER: You are operating under ${label}. Every factual claim must trace back to specific data above. If data is missing for a category, acknowledge it honestly rather than filling gaps with assumptions. Apply the Ultimate Safeguard (Rule #10) before every response.`;
}

/**
 * Build a context string describing which pattern claims are currently
 * valid based on the user's actual data volume. This helps the AI know
 * which pattern types it can and cannot mention.
 */
function buildPatternThresholdsContext(report: DataAvailabilityReport): string {
  const lines: string[] = ['═══ PATTERN CLAIM ELIGIBILITY ═══'];

  const checks: { label: string; dataPoints: number | undefined; daysSpan: number | undefined; minPoints: number; minDays: number }[] = [
    { label: 'Task completion time', dataPoints: report.totalTasks, daysSpan: report.taskDaysSpan, minPoints: 15, minDays: 14 },
    { label: 'Preferred task category', dataPoints: report.totalTasks, daysSpan: report.taskDaysSpan, minPoints: 20, minDays: 30 },
    { label: 'Streak consistency', dataPoints: report.habitDaysSpan, daysSpan: report.habitDaysSpan, minPoints: 7, minDays: 21 },
    { label: 'Mood correlation', dataPoints: report.moodEntryCount, daysSpan: report.moodDaysSpan, minPoints: 14, minDays: 14 },
    { label: 'Energy fluctuation', dataPoints: report.energyEntryCount, daysSpan: report.energyDaysSpan, minPoints: 14, minDays: 14 },
    { label: 'Habit success rate', dataPoints: report.habitDaysSpan, daysSpan: report.habitDaysSpan, minPoints: 21, minDays: 21 },
  ];

  for (const check of checks) {
    const dp = check.dataPoints ?? 0;
    const ds = check.daysSpan ?? 0;
    const pointsOk = dp >= check.minPoints;
    const daysOk = ds >= check.minDays;
    const eligible = pointsOk && daysOk;
    const icon = eligible ? '✅' : '❌';
    const reason = eligible
      ? `(${dp} points, ${ds} days — thresholds met)`
      : `(${dp}/${check.minPoints} points, ${ds}/${check.minDays} days — thresholds NOT met)`;
    lines.push(`${icon} ${check.label}: ${eligible ? 'ELIGIBLE' : 'NOT ELIGIBLE'} ${reason}`);
  }

  lines.push('');
  lines.push('You may ONLY claim patterns for ELIGIBLE types. For NOT ELIGIBLE types, do NOT mention patterns.');

  return lines.join('\n');
}

// Common OpenAI-compatible API paths
export const API_PATHS = [
  '/v1/chat/completions',
  '/chat/completions',
  '/v1/completions',
  '/api/chat',
  '/api/v1/chat/completions',
  '/openai/v1/chat/completions',
];

// Cache discovered paths to avoid re-discovering on every request
export const discoveredPathCache = new Map<string, string>();

// Cache auto-detected model names to avoid calling /v1/models on every request
export const detectedModelCache = new Map<string, string>();

// ─── Path Discovery Helpers ────────────────────────────────────────────────

function looksLikeBasePath(pathname: string): boolean {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' || trimmed === '/';
}

export async function discoverApiPath(baseUrl: string): Promise<string | null> {
  const cached = discoveredPathCache.get(baseUrl);
  if (cached) return cached;

  for (const path of API_PATHS) {
    const testUrl = `${baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const status = res.status;
      if (status === 200 || status === 401 || status === 403 || status === 400 || status === 422) {
        discoveredPathCache.set(baseUrl, path);
        return path;
      }
    } catch {
      clearTimeout(timeout);
    }
  }
  return null;
}

export function resolveEndpointUrl(rawUrl: string): {
  baseUrl: string;
  fullUrl: string;
  isBase: boolean;
} {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return { baseUrl: rawUrl, fullUrl: rawUrl, isBase: false };
  }

  const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
  const isBase = looksLikeBasePath(parsedUrl.pathname);

  if (isBase) {
    return { baseUrl, fullUrl: rawUrl, isBase: true };
  }

  return { baseUrl, fullUrl: rawUrl, isBase: false };
}

// ─── Core AI Call ──────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CallAIOptions {
  messages: ChatMessage[];
  systemPrompt?: string;
  customEndpoint?: string;
  modelName?: string;
  apiKey?: string;
  temperature?: number;
  /** Max retries for transient errors like 429 (default: 2) */
  maxRetries?: number;
}

export interface CallAIResult {
  success: boolean;
  response: string;
  source: 'custom' | 'built-in';
  discoveredPath?: string;
  error?: string;
}

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (429 rate limit, network timeout, etc.)
 */
function isRetryableError(error: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('model is busy') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('network') ||
    lower.includes('econnreset') ||
    lower.includes('econnrefused')
  );
}

/**
 * Check if an error is specifically a 429 / model-busy error (needs longer backoff)
 */
function isModelBusyError(error: string): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes('429') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('model is busy')
  );
}

/**
 * Call AI — routes to the user-configured OpenAI-compatible endpoint.
 * Supports automatic retries for transient errors like 429 "model busy".
 * No built-in AI — all calls go through the user's configured API.
 */
export async function callAI(
  messages: ChatMessage[],
  systemPrompt?: string,
  customEndpoint?: string,
  modelName?: string,
  apiKey?: string,
  temperature?: number,
  options?: { maxRetries?: number }
): Promise<CallAIResult> {
  const effectiveSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const maxRetries = options?.maxRetries ?? 2;

  // ─── Built-in AI (z-ai-web-dev-sdk) ───
  // When no customEndpoint is provided, use the built-in AI SDK.
  // This happens when the APK connects to a Syntra server via tunnel —
  // the server itself IS the AI provider.
  if (!customEndpoint || !customEndpoint.trim()) {
    console.log('[callAI] No custom endpoint — using built-in AI (z-ai-web-dev-sdk)');
    return callBuiltInAI(messages, effectiveSystemPrompt, temperature, maxRetries);
  }

  console.log(`[callAI] Using endpoint: ${customEndpoint.substring(0, 60)}...`);

  let result = await callCustomEndpoint(customEndpoint, messages, effectiveSystemPrompt, modelName, apiKey, temperature);

  // Retry on transient errors (with longer backoff for 429 "Model is busy")
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (result.success || !isRetryableError(result.error || '')) break;
    const isBusy = isModelBusyError(result.error || '');
    const baseDelay = isBusy ? 5000 : 1000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt), isBusy ? 30000 : 4000);
    console.log(`[callAI] Retrying (attempt ${attempt + 1}/${maxRetries}) after ${delay}ms...${isBusy ? ' (model busy)' : ''}`);
    await sleep(delay);
    result = await callCustomEndpoint(customEndpoint, messages, effectiveSystemPrompt, modelName, apiKey, temperature);
  }

  return result;
}

/**
 * Call the built-in AI using z-ai-web-dev-sdk.
 * Used when no custom endpoint is configured — the server itself provides AI.
 * This is the default for APK → Server (tunnel) connections.
 */
async function callBuiltInAI(
  messages: ChatMessage[],
  systemPrompt: string,
  temperature?: number,
  maxRetries: number = 2,
): Promise<CallAIResult> {
  const allMessages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({
      role: (m.role === 'system' ? 'system' : m.role === 'user' ? 'user' : 'assistant') as 'system' | 'user' | 'assistant',
      content: m.content,
    })),
  ];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const zai = await getZAI();
      const completion = await zai.chat.completions.create({
        messages: allMessages,
        temperature: temperature ?? 0.7,
        max_tokens: 2048,
      } as any);

      const aiResponse = completion.choices?.[0]?.message?.content;

      if (!aiResponse) {
        if (attempt < maxRetries) {
          console.log(`[callBuiltInAI] Empty response, retrying (attempt ${attempt + 1})...`);
          await sleep(1000 * (attempt + 1));
          continue;
        }
        return {
          success: false,
          response: '',
          source: 'built-in',
          error: 'Built-in AI returned an empty response',
        };
      }

      return {
        success: true,
        response: aiResponse,
        source: 'built-in',
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error(`[callBuiltInAI] Error (attempt ${attempt + 1}/${maxRetries + 1}):`, errorMsg);

      if (attempt < maxRetries && isRetryableError(errorMsg)) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 15000);
        console.log(`[callBuiltInAI] Retrying after ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      return {
        success: false,
        response: '',
        source: 'built-in',
        error: `Built-in AI error: ${errorMsg}`,
      };
    }
  }

  return {
    success: false,
    response: '',
    source: 'built-in',
    error: 'Built-in AI failed after all retries',
  };
}

async function callCustomEndpoint(
  rawUrl: string,
  messages: ChatMessage[],
  systemPrompt: string,
  modelName?: string,
  apiKey?: string,
  temperature?: number
): Promise<CallAIResult> {
  // Validate URL
  try {
    const parsedUrl = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return {
        success: false,
        response: '',
        source: 'custom',
        error: 'Only http:// and https:// custom endpoints are supported',
      };
    }

    // Detect Anthropic API endpoints — they use a different format (x-api-key header,
    // anthropic-version header, no system role in messages). Provide a helpful error.
    if (parsedUrl.hostname === 'api.anthropic.com' || parsedUrl.hostname.endsWith('.anthropic.com')) {
      return {
        success: false,
        response: '',
        source: 'custom',
        error: 'Anthropic API is not directly supported — it uses a different request format. Use an OpenAI-compatible proxy (e.g., litellm, openrouter.ai) to connect to Claude models, or switch to another provider.',
      };
    }
  } catch {
    return { success: false, response: '', source: 'custom', error: 'Invalid custom endpoint URL' };
  }

  const { baseUrl, fullUrl, isBase } = resolveEndpointUrl(rawUrl);

  // If user entered just a base URL (no path), auto-discover the API path
  let endpointUrl = fullUrl;
  let discoveredPath: string | null = null;

  if (isBase) {
    discoveredPath = await discoverApiPath(baseUrl);
    if (discoveredPath) {
      endpointUrl = `${baseUrl}${discoveredPath}`;
    } else {
      endpointUrl = `${baseUrl}/v1/chat/completions`;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout for larger models

  try {
    const allMessages: { role: string; content: string }[] = [];
    allMessages.push({ role: 'system', content: systemPrompt });

    for (const msg of messages) {
      allMessages.push({
        role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Determine the model name to use
    let effectiveModelName = modelName?.trim() || '';

    // If no model name provided, try cached auto-detected model first
    if (!effectiveModelName) {
      const cachedModel = detectedModelCache.get(baseUrl);
      if (cachedModel) {
        effectiveModelName = cachedModel;
        console.log(`[callCustomEndpoint] Using cached model: ${effectiveModelName}`);
      } else {
        // Auto-detect from the /v1/models endpoint (only once per baseUrl)
        try {
          const modelsHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          if (apiKey?.trim()) modelsHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;

          const modelsRes = await fetch(`${baseUrl}/v1/models`, {
            method: 'GET',
            headers: modelsHeaders,
            signal: AbortSignal.timeout(5000),
          });

          if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            if (modelsData.data && Array.isArray(modelsData.data) && modelsData.data.length > 0) {
              effectiveModelName = modelsData.data[0].id;
              detectedModelCache.set(baseUrl, effectiveModelName);
              console.log(`[callCustomEndpoint] Auto-detected and cached model: ${effectiveModelName}`);
            }
          }
        } catch {
          // Auto-detect failed — proceed without model name
          console.log('[callCustomEndpoint] Could not auto-detect model from /v1/models');
        }
      }
    }

    const requestBody: Record<string, any> = {
      messages: allMessages,
      max_tokens: 2048,
      temperature: temperature ?? 0.7,
    };

    // Include model name if available (required by many OpenAI-compatible servers)
    if (effectiveModelName) {
      requestBody.model = effectiveModelName;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add API key authorization if provided
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');

      // If we get a 400 error about model not found, try auto-detecting the model
      if (res.status === 400 && !modelName?.trim()) {
        console.log('[callCustomEndpoint] Got 400, attempting model auto-detection...');
        const retryResult = await retryWithAutoDetectedModel(
          endpointUrl, allMessages, effectiveModelName, apiKey, temperature, headers
        );
        if (retryResult) return retryResult;
      }

      return {
        success: false,
        response: '',
        source: 'custom',
        error: `Custom endpoint returned ${res.status}: ${errorText.substring(0, 200)}`,
      };
    }

    const data = await res.json();

    let aiResponse: string | null = null;

    if (typeof data === 'string') {
      aiResponse = data;
    } else if (data.choices?.[0]?.message?.content) {
      aiResponse = data.choices[0].message.content;
    } else if (data.choices?.[0]?.text) {
      aiResponse = data.choices[0].text;
    } else if (data.response) {
      aiResponse = data.response;
    } else if (data.message) {
      aiResponse = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
    } else if (data.content) {
      aiResponse = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
    } else if (data.result) {
      aiResponse = typeof data.result === 'string' ? data.result : JSON.stringify(data.result);
    }

    if (!aiResponse) {
      aiResponse = JSON.stringify(data);
    }

    return {
      success: true,
      response: aiResponse,
      source: 'custom',
      discoveredPath: discoveredPath || undefined,
    };
  } catch (fetchError: any) {
    clearTimeout(timeout);

    if (fetchError.name === 'AbortError') {
      return {
        success: false,
        response: '',
        source: 'custom',
        error: 'Custom endpoint timed out (60s)',
      };
    }

    return {
      success: false,
      response: '',
      source: 'custom',
      error: `Failed to reach custom endpoint: ${fetchError.message}`,
    };
  }
}

/**
 * Retry a failed request with auto-detected model from /v1/models endpoint.
 */
async function retryWithAutoDetectedModel(
  endpointUrl: string,
  allMessages: { role: string; content: string }[],
  currentModel: string,
  apiKey?: string,
  temperature?: number,
  headers?: Record<string, string>
): Promise<CallAIResult | null> {
  try {
    // Parse base URL from endpoint URL
    const parsedEndpoint = new URL(endpointUrl);
    const baseUrl = `${parsedEndpoint.protocol}//${parsedEndpoint.host}`;

    const modelsHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey?.trim()) modelsHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;

    const modelsRes = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      headers: modelsHeaders,
      signal: AbortSignal.timeout(5000),
    });

    if (!modelsRes.ok) return null;

    const modelsData = await modelsRes.json();
    if (!modelsData.data || !Array.isArray(modelsData.data) || modelsData.data.length === 0) return null;

    // Try each available model
    for (const model of modelsData.data) {
      if (model.id === currentModel) continue; // Skip the one that already failed

      console.log(`[retryWithAutoDetectedModel] Trying model: ${model.id}`);

      const retryBody: Record<string, any> = {
        messages: allMessages,
        max_tokens: 2048,
        temperature: temperature ?? 0.7,
        model: model.id,
      };

      const retryRes = await fetch(endpointUrl, {
        method: 'POST',
        headers: headers || { 'Content-Type': 'application/json' },
        body: JSON.stringify(retryBody),
        signal: AbortSignal.timeout(60000),
      });

      if (retryRes.ok) {
        const data = await retryRes.json();
        let aiResponse: string | null = null;

        if (typeof data === 'string') {
          aiResponse = data;
        } else if (data.choices?.[0]?.message?.content) {
          aiResponse = data.choices[0].message.content;
        } else if (data.choices?.[0]?.text) {
          aiResponse = data.choices[0].text;
        } else if (data.response) {
          aiResponse = data.response;
        } else if (data.message) {
          aiResponse = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
        } else if (data.content) {
          aiResponse = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
        }

        if (!aiResponse) {
          aiResponse = JSON.stringify(data);
        }

        console.log(`[retryWithAutoDetectedModel] Success with model: ${model.id}`);
        return { success: true, response: aiResponse, source: 'custom' as const };
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Image Generation ──────────────────────────────────────────────────────

export async function generateImage(
  prompt: string,
  size?: string
): Promise<{ success: boolean; imageBase64?: string; error?: string }> {
  try {
    const zai = await getZAI();

    const result = await zai.images.generations.create({
      prompt,
      size: (size || '1024x1024') as any,
    } as any);

    const base64 = (result.data as any)?.[0]?.b64_json || (result.data as any)?.[0]?.base64;

    if (!base64) {
      return { success: false, error: 'No image data returned from AI' };
    }

    return { success: true, imageBase64: base64 };
  } catch (error: any) {
    console.error('Image generation error:', error);
    return { success: false, error: error.message || 'Image generation failed' };
  }
}

// ─── Image Analysis (Vision) ───────────────────────────────────────────────

export async function analyzeImage(
  imageUrl: string,
  question: string
): Promise<{ success: boolean; response?: string; error?: string }> {
  try {
    const zai = await getZAI();

    const completion = await zai.chat.completions.createVision({
      messages: [
        {
          role: 'system',
          content: 'You are a vision assistant. Analyze the provided image and answer questions about it.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: question },
            { type: 'image_url', image_url: { url: imageUrl } },
          ] as any,
        },
      ],
      thinking: { type: 'disabled' },
    } as any);

    const aiResponse = completion.choices[0]?.message?.content;

    if (!aiResponse) {
      return { success: false, error: 'No response from vision AI' };
    }

    return { success: true, response: aiResponse };
  } catch (error: any) {
    console.error('Image analysis error:', error);
    return { success: false, error: error.message || 'Image analysis failed' };
  }
}

// ─── JSON Response Helper ──────────────────────────────────────────────────

/**
 * Robustly extract a JSON object from an AI response string.
 * Handles: markdown code fences, extra text before/after JSON, trailing commas, etc.
 */
function extractJSON(text: string): string | null {
  let cleaned = text.trim();

  // Strategy 1: Strip markdown code fences
  if (cleaned.includes('```')) {
    // Find content between ``` fences
    const fenceMatch = cleaned.match(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
  }

  // Strategy 2: Find the outermost { ... } or [ ... ] pair
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const lastBrace = cleaned.lastIndexOf('}');
  const lastBracket = cleaned.lastIndexOf(']');

  // Determine if it's an object or array
  const isObject = firstBrace !== -1 && lastBrace > firstBrace;
  const isArray = firstBracket !== -1 && lastBracket > firstBracket;

  // Pick the one that starts earliest
  if (isObject && (!isArray || firstBrace < firstBracket)) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (isArray) {
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);
  } else if (isObject) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  // Strategy 3: Try direct parse
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // continue
  }

  // Strategy 4: Remove trailing commas before } or ]
  let commaFixed = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    JSON.parse(commaFixed);
    return commaFixed;
  } catch {
    // continue
  }

  // Strategy 5: Remove JavaScript-style comments
  let noComments = commaFixed.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  try {
    JSON.parse(noComments);
    return noComments;
  } catch {
    // continue
  }

  // Strategy 6: Try to fix unquoted keys (only for objects)
  if (isObject || (!isArray && firstBrace !== -1)) {
    let quotedKeys = noComments.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    try {
      JSON.parse(quotedKeys);
      return quotedKeys;
    } catch {
      // give up
    }
  }

  return null;
}

/**
 * Call AI and parse the response as JSON. Returns a fallback on parse failure.
 * Supports fallback from custom → default engine and automatic retries.
 * Uses robust JSON extraction to handle various AI response formats.
 */
export async function callAIForJSON<T>(
  messages: ChatMessage[],
  systemPrompt: string,
  fallback: T,
  customEndpoint?: string,
  modelName?: string,
  apiKey?: string,
  temperature?: number,
  options?: { maxRetries?: number }
): Promise<{ data: T; source: 'ai' | 'fallback'; error?: string }> {
  try {
    const result = await callAI(messages, systemPrompt, customEndpoint, modelName, apiKey, temperature, options);

    if (!result.success) {
      console.error('callAIForJSON: AI call failed:', result.error);
      return { data: JSON.parse(JSON.stringify(fallback)), source: 'fallback', error: result.error };
    }

    // Use robust JSON extraction
    const extractedJSON = extractJSON(result.response);

    if (extractedJSON) {
      try {
        const parsed = JSON.parse(extractedJSON);
        return { data: parsed as T, source: 'ai' };
      } catch {
        // Fall through to retry below
      }
    }

    // JSON extraction failed — retry with a stricter prompt that demands JSON only
    console.log('[callAIForJSON] First response was not valid JSON, retrying with strict JSON prompt...');
    const retryMessages: ChatMessage[] = [
      ...messages,
      { role: 'assistant' as const, content: result.response },
      {
        role: 'user' as const,
        content: 'Your previous response was not valid JSON. Please respond with ONLY a valid JSON object, no markdown, no explanation, no code fences. Just the raw JSON.',
      },
    ];

    const retryResult = await callAI(retryMessages, systemPrompt, customEndpoint, modelName, apiKey, temperature, options);

    if (retryResult.success) {
      const retryExtracted = extractJSON(retryResult.response);
      if (retryExtracted) {
        try {
          const parsed = JSON.parse(retryExtracted);
          return { data: parsed as T, source: 'ai' };
        } catch {
          // Fall through to fallback
        }
      }
    }

    console.error('callAIForJSON: Could not extract valid JSON after retry. Raw response:', result.response?.substring(0, 300));
    return { data: JSON.parse(JSON.stringify(fallback)), source: 'fallback', error: 'Could not parse AI response as JSON' };
  } catch (error) {
    console.error('callAIForJSON: parse error:', error);
    return { data: JSON.parse(JSON.stringify(fallback)), source: 'fallback', error: String(error) };
  }
}
