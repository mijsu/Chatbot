import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON, callAI, buildUserContextBlock, type UserContext } from '@/lib/ai-service';


interface GenerateContentRequest {
  userContext: UserContext;
  contextString: string;
  customEndpoint?: string;
  modelName?: string;
  apiKey?: string;
  refreshId?: string;
}

interface AISuggestion {
  icon: string;
  text: string;
  prompt: string;
  category: 'productivity' | 'wellness' | 'social' | 'creative' | 'focus' | 'learning';
}

interface ProgressItem {
  label: string;
  value: string;
  highlight?: boolean;
}

interface ProgressMetric {
  label: string;
  value: string;
  subtext?: string;
  progress?: number;
  highlight?: boolean;
  trend?: 'up' | 'down' | 'stable';
  statusColor?: string;
}

interface PriorityFocus {
  label: string;
  reason?: string;
  urgency?: 'low' | 'medium' | 'high';
}

interface DynamicContent {
  greeting: string;
  statusLine: string;
  suggestionSectionLabel: string;
  suggestions: AISuggestion[];
  insightLabel: string;
  progressLabel: string;
  quickActionLabel: string;
  moodCheckLabel: string;
  goalsSectionLabel: string;
  habitsSectionLabel: string;
  progressItems: ProgressItem[];
  progressMetrics: ProgressMetric[];
  progressStatus: string;
  priorityFocus?: PriorityFocus;
  plannerHeaderLabel: string;
  plannerEmptyTasks: string;
  plannerEmptyHint: string;
  plannerAiButton: string;
  plannerRemindersLabel: string;
  plannerEmptyReminders: string;
  plannerSearch: string;
  settingsProfileLabel: string;
  settingsAccountLabel: string;
  settingsPreferencesLabel: string;
  settingsGoalsLabel: string;
  settingsHabitsLabel: string;
  settingsDataLabel: string;
  settingsEditProfile: string;
  settingsAboutPlaceholder: string;
  settingsMoodHistory: string;
  settingsNoGoals: string;
  settingsNoHabits: string;
  navHome: string;
  navPlanner: string;
  navVoice: string;
  navReminder: string;
  navProfile: string;
}

const SYSTEM_PROMPT = `You are Syntra — the living intelligence behind the entire Syntra application. You generate ALL dynamic UI content for EVERY screen. Your job is to make the entire interface feel alive, intelligent, and deeply personalized. The intelligence should feel NATURAL and assumed — never explicitly label anything as "AI" or "AI-generated". Just be smart and seamless.

CRITICAL RULES:
- NEVER use the word "AI" in any visible label, title, or text. The system is just "Syntra".
- NEVER label content as "AI-generated", "AI suggestions", "AI insights", etc.
- The intelligence should feel like a natural, seamless part of the experience.
- NEVER invent or hallucinate task counts, habit counts, goal percentages, completion rates, or any metrics that are not explicitly provided in the context. If the context shows 0 tasks, 0 goals, 0 habits, do NOT make up numbers. Return empty arrays for progressItems and progressMetrics, and use "JUST STARTED" as progressStatus.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text). The JSON must have exactly these keys:

HOME SCREEN:
1. "greeting" (string): A personalized, warm greeting. Use the user's name if known. Be creative — vary phrasing every time. Examples: "Hey Alex, your focus streak is on fire", "Morning champion, let's tackle those goals"
2. "statusLine" (string): One short context-aware status. Must be relevant to their actual tasks/mood/goals. Examples: "3 tasks waiting, 2-day mood streak", "All clear — perfect time for creative work"
3. "suggestionSectionLabel" (string): Creative section title. ALL CAPS. Examples: "SUGGESTIONS", "QUICK ACTIONS", "WHAT'S NEXT", "TRY THIS", "YOUR MOVE"
4. "suggestions" (array of exactly 6 objects): Each with "icon" (one of: sparkles, code, coffee, calendar, brain, droplets, pen-tool, book-open, bell, sun, moon, target, flame, stretch, users, phone), "text" (max 3 words, ALL CAPS), "prompt" (full prompt to send), "category" (one of: productivity, wellness, social, creative, focus, learning). MIX categories — at least 2 different. Be highly creative and contextual.
5. "insightLabel" (string): Creative label for daily insight. ALL CAPS. NEVER use "AI" in this label. Examples: "YOUR DAILY", "TODAY'S LENS", "DEEP DIVE", "DAILY INSIGHT"
6. "progressLabel" (string): Creative label for the Daily Pulse card. ALL CAPS. NEVER use "AI". Examples: "DAILY PULSE", "TODAY'S SCORE", "THE BOARD", "YOUR DAY", "DASHBOARD"
7. "quickActionLabel" (string): Creative main action button. ALL CAPS. NEVER use "AI". Examples: "ASK SYNTRA", "LET'S GO", "START", "TALK"
8. "moodCheckLabel" (string): Mood check-in section title. ALL CAPS. Examples: "HOW ARE YOU", "MOOD CHECK", "CHECK IN"
9. "goalsSectionLabel" (string): Goals section title. ALL CAPS. Examples: "YOUR GOALS", "MISSION CONTROL"
10. "habitsSectionLabel" (string): Habits section title. ALL CAPS. Examples: "DAILY HABITS", "STREAK TRACKER"
11. "progressItems" (array of 3-5 objects): Dynamic, context-aware progress items. Each has "label" (string, ALL CAPS, 1-2 words), "value" (string, short like "3/5", "2 pending", "Done", "1 overdue"), "highlight" (boolean, true if this item needs attention). These MUST reflect the user's REAL-TIME state. Adapt dynamically — never show empty or zero categories.
11a. "progressMetrics" (array of 4 objects): Rich metric tiles for the Daily Pulse card. Each has "label" (string, ALL CAPS), "value" (string, like "3/5", "72%", "4/5"), "subtext" (string, short contextual hint like "2 still pending", "On target", "Keep going"), "progress" (number 0-100 for mini bar), "highlight" (boolean), "trend" (one of: "up", "down", "stable"). These should be visually rich and context-aware. Always include TASKS metric if tasks exist. Include GOALS, HABITS, ENERGY, or REMINDERS as relevant.
11b. "progressStatus" (string, ALL CAPS): Overall daily status badge. Must be one of: "ON TRACK", "CRUSHING IT", "NEEDS ATTENTION", "STRONG PACE", "PICKING UP", "JUST STARTED", "WINDING DOWN". Choose based on time of day + completion %.
11c. "priorityFocus" (object, optional): The single most important thing to focus on. Has "label" (string, what to focus on, e.g. "Finish the design review"), "reason" (string, why it matters, e.g. "Due before 3pm"), "urgency" (one of: "low", "medium", "high"). Only include if there's something genuinely important. Omit if the user is all caught up.

PLANNER SCREEN:
12. "plannerHeaderLabel" (string): Planner title. ALL CAPS. Examples: "PLANNER", "YOUR SCHEDULE", "AGENDA"
13. "plannerEmptyTasks" (string): Empty tasks message. Examples: "No tasks for this day", "All clear today"
14. "plannerEmptyHint" (string): Hint below empty. Examples: "Tap + to add one", "Let Syntra plan your day"
15. "plannerAiButton" (string): Smart create button. ALL CAPS. NEVER use "AI". Examples: "SMART ADD", "QUICK CREATE", "AUTO ADD"
16. "plannerRemindersLabel" (string): Reminders title. ALL CAPS. Examples: "REMINDERS", "DON'T FORGET"
17. "plannerEmptyReminders" (string): Empty reminders message. Examples: "No reminders", "All caught up"
18. "plannerSearch" (string): Search placeholder. Examples: "Search tasks...", "Find something..."

SETTINGS SCREEN:
19. "settingsProfileLabel" (string): Profile section. ALL CAPS. Examples: "PROFILE", "WHO YOU ARE"
20. "settingsAccountLabel" (string): Account section. ALL CAPS. Examples: "ACCOUNT", "YOUR SETUP"
21. "settingsPreferencesLabel" (string): Preferences section. ALL CAPS. Examples: "PREFERENCES", "YOUR STYLE"
22. "settingsGoalsLabel" (string): Goals section. ALL CAPS. Examples: "GOALS", "AMBITIONS"
23. "settingsHabitsLabel" (string): Habits section. ALL CAPS. Examples: "HABITS", "ROUTINES"
24. "settingsDataLabel" (string): Data section. ALL CAPS. Examples: "DATA", "STORAGE"
25. "settingsEditProfile" (string): Edit profile link. Examples: "Edit Profile", "Update Info"
26. "settingsAboutPlaceholder" (string): About me placeholder. Examples: "Tell Syntra about yourself..."
27. "settingsMoodHistory" (string): Mood history title. ALL CAPS. Examples: "MOOD HISTORY", "WELLNESS LOG"
28. "settingsNoGoals" (string): No goals message. Examples: "No goals yet. Add one to get started!"
29. "settingsNoHabits" (string): No habits message. Examples: "No habits yet. Start building streaks!"

BOTTOM NAV (MUST use these EXACT values — do NOT rename or customize):
30. "navHome" (string): MUST be "Home"
31. "navPlanner" (string): MUST be "Planner"
32. "navVoice" (string): MUST be "Voice"
33. "navReminder" (string): MUST be "Reminders"
34. "navProfile" (string): MUST be "Profile"

Output raw JSON only. Be creative, varied, and personal every single time. Adapt to the user's context — a student's labels should differ from a freelancer's.

ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.`;

const VALID_ICONS = ['sparkles', 'code', 'coffee', 'calendar', 'brain', 'droplets', 'pen-tool', 'book-open', 'bell', 'sun', 'moon', 'target', 'flame', 'stretch', 'users', 'phone'];
const VALID_CATEGORIES = ['productivity', 'wellness', 'social', 'creative', 'focus', 'learning'];

const FALLBACK: DynamicContent = {
  greeting: 'Hey there',
  statusLine: 'Start adding tasks and goals to see your daily pulse',
  suggestionSectionLabel: 'SUGGESTIONS',
  suggestions: [
    { icon: 'sparkles', text: 'BRAINSTORM', prompt: 'Help me brainstorm creative ideas', category: 'creative' },
    { icon: 'code', text: 'DEBUG CODE', prompt: 'I need help debugging my code', category: 'productivity' },
    { icon: 'coffee', text: 'TAKE BREAK', prompt: 'Suggest a refreshing break activity', category: 'wellness' },
    { icon: 'calendar', text: 'PLAN DAY', prompt: 'Help me plan my schedule today', category: 'productivity' },
    { icon: 'brain', text: 'STAY FOCUSED', prompt: 'Help me maintain focus', category: 'focus' },
    { icon: 'droplets', text: 'CHECK IN', prompt: 'Help me compose a check-in message', category: 'social' },
  ],
  insightLabel: 'DAILY INSIGHT',
  progressLabel: 'DAILY PULSE',
  quickActionLabel: 'ASK SYNTRA',
  moodCheckLabel: 'HOW ARE YOU',
  goalsSectionLabel: 'YOUR GOALS',
  habitsSectionLabel: 'DAILY HABITS',
  progressItems: [],
  progressMetrics: [],
  progressStatus: 'JUST STARTED',
  priorityFocus: undefined,
  plannerHeaderLabel: 'PLANNER',
  plannerEmptyTasks: 'No tasks for this day',
  plannerEmptyHint: 'Tap + to add one',
  plannerAiButton: 'SMART ADD',
  plannerRemindersLabel: 'REMINDERS',
  plannerEmptyReminders: 'No reminders',
  plannerSearch: 'Search tasks...',
  settingsProfileLabel: 'PROFILE',
  settingsAccountLabel: 'ACCOUNT',
  settingsPreferencesLabel: 'PREFERENCES',
  settingsGoalsLabel: 'GOALS',
  settingsHabitsLabel: 'HABITS',
  settingsDataLabel: 'DATA',
  settingsEditProfile: 'Edit Profile',
  settingsAboutPlaceholder: 'Tell Syntra about yourself so it can personalize your experience...',
  settingsMoodHistory: 'MOOD HISTORY',
  settingsNoGoals: 'No goals yet. Add one to get started!',
  settingsNoHabits: 'No habits yet. Start building streaks!',
  navHome: 'Home',
  navPlanner: 'Planner',
  navVoice: 'Voice',
  navReminder: 'Reminders',
  navProfile: 'Profile',
};

function sanitizeSuggestions(suggestions: any[]): AISuggestion[] {
  if (!Array.isArray(suggestions)) return FALLBACK.suggestions;

  return suggestions.slice(0, 6).map((s, i) => ({
    icon: VALID_ICONS.includes(s?.icon) ? s.icon : VALID_ICONS[i % VALID_ICONS.length],
    text: typeof s?.text === 'string' ? s.text.toUpperCase().slice(0, 20) : FALLBACK.suggestions[i]?.text || 'TRY THIS',
    prompt: typeof s?.prompt === 'string' ? s.prompt : 'Help me with something',
    category: VALID_CATEGORIES.includes(s?.category) ? s.category : VALID_CATEGORIES[i % VALID_CATEGORIES.length],
  }));
}

function padSuggestions(suggestions: AISuggestion[]): AISuggestion[] {
  while (suggestions.length < 6) {
    const fallback = FALLBACK.suggestions[suggestions.length] || FALLBACK.suggestions[0];
    suggestions.push({ ...fallback });
  }
  return suggestions.slice(0, 6);
}

function sanitizeProgressItems(items: any[]): ProgressItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.slice(0, 5).map(item => ({
    label: typeof item?.label === 'string' ? item.label.toUpperCase().slice(0, 20) : 'STATUS',
    value: typeof item?.value === 'string' ? item.value.slice(0, 20) : '0',
    highlight: Boolean(item?.highlight),
  }));
}

function sanitizeProgressMetrics(metrics: any[]): ProgressMetric[] {
  if (!Array.isArray(metrics) || metrics.length === 0) return [];
  const validTrends = ['up', 'down', 'stable'];
  return metrics.slice(0, 4).map(m => ({
    label: typeof m?.label === 'string' ? m.label.toUpperCase().slice(0, 20) : 'STATUS',
    value: typeof m?.value === 'string' ? m.value.slice(0, 20) : '0',
    subtext: typeof m?.subtext === 'string' ? m.subtext.slice(0, 40) : undefined,
    progress: typeof m?.progress === 'number' ? Math.max(0, Math.min(100, m.progress)) : undefined,
    highlight: Boolean(m?.highlight),
    trend: validTrends.includes(m?.trend) ? m.trend : undefined,
    statusColor: typeof m?.statusColor === 'string' ? m.statusColor : undefined,
  }));
}

function sanitizePriorityFocus(pf: any): PriorityFocus | undefined {
  if (!pf || typeof pf?.label !== 'string') return undefined;
  const validUrgency = ['low', 'medium', 'high'];
  return {
    label: pf.label.slice(0, 80),
    reason: typeof pf.reason === 'string' ? pf.reason.slice(0, 60) : undefined,
    urgency: validUrgency.includes(pf.urgency) ? pf.urgency : 'medium',
  };
}

function str(val: any, fallback: string): string {
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
}

function upperStr(val: any, fallback: string): string {
  const s = str(val, fallback);
  return s === s.toUpperCase() ? s : s.toUpperCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contextString, customEndpoint, modelName, apiKey, refreshId } = body as GenerateContentRequest;
    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());

    const uniqueSeed = refreshId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seedLine = `\n[Unique request ID: ${uniqueSeed} — use completely different phrasing, vocabulary, and creative angles than any previous response. Be wildly creative and unique.]`;

    const userMessage = contextString
      ? `Generate dynamic UI content for ALL screens based on my current context:\n${contextString}${seedLine}`
      : `Generate dynamic UI content for a general user across all screens.${seedLine}`;

    const aiOptions = {
      maxRetries: hasCustomEndpoint ? 1 : 2,
    };

    const { data, source } = await callAIForJSON<DynamicContent>(
      [{ role: 'user', content: userMessage }],
      SYSTEM_PROMPT,
      FALLBACK,
      customEndpoint,
      modelName,
      apiKey,
      0.9,
      aiOptions
    );

    // Deep copy to prevent mutating the shared FALLBACK constant
    const result: DynamicContent = {
      ...data,
      suggestions: data.suggestions.map(s => ({ ...s })),
      progressItems: data.progressItems.map(p => ({ ...p })),
      progressMetrics: data.progressMetrics.map(m => ({ ...m })),
      priorityFocus: data.priorityFocus ? { ...data.priorityFocus } : undefined,
    };

    let wasAiGenerated = source === 'ai';

    // If the full JSON approach failed, try a simplified approach
    if (!wasAiGenerated && hasCustomEndpoint) {
      console.log('[generate-content] Full JSON parsing failed, trying simplified prompt...');

      const simplePrompt = `You are Syntra. Generate personalized UI content. Respond with ONLY a JSON object with these keys: "greeting" (string), "statusLine" (string), "suggestions" (array of 6 objects with "icon" [one of: ${VALID_ICONS.join(', ')}], "text" [max 3 words ALL CAPS], "prompt" [full prompt], "category" [one of: ${VALID_CATEGORIES.join(', ')}]), "insightLabel" (string, ALL CAPS, never say "AI"), "progressLabel" (string, ALL CAPS), "quickActionLabel" (string, ALL CAPS, never say "AI"), "progressItems" (array of 3-5 objects with "label" [ALL CAPS], "value" [short string], "highlight" [boolean]). Never use "AI" in any label. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.`;

      const simpleResult = await callAI(
        [{ role: 'user', content: `${contextString || 'General user'}\n${seedLine}` }],
        simplePrompt,
        customEndpoint,
        modelName,
        apiKey,
        0.9,
        { maxRetries: 1 }
      );

      if (simpleResult.success) {
        try {
          const jsonMatch = simpleResult.response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.greeting || parsed.suggestions) {
              if (parsed.greeting) result.greeting = parsed.greeting;
              if (parsed.statusLine) result.statusLine = parsed.statusLine;
              if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
                result.suggestions = sanitizeSuggestions(parsed.suggestions);
              }
              if (parsed.insightLabel) result.insightLabel = parsed.insightLabel;
              if (parsed.progressLabel) result.progressLabel = parsed.progressLabel;
              if (parsed.quickActionLabel) result.quickActionLabel = parsed.quickActionLabel;
              if (Array.isArray(parsed.progressItems)) {
                result.progressItems = sanitizeProgressItems(parsed.progressItems);
              }
              wasAiGenerated = true;
            }
          }
        } catch {
          // Simplified approach failed too
        }
      }
    }

    // Sanitize the full result
    const sanitized: DynamicContent = {
      greeting: str(result.greeting, FALLBACK.greeting),
      statusLine: str(result.statusLine, FALLBACK.statusLine),
      suggestionSectionLabel: upperStr(result.suggestionSectionLabel, FALLBACK.suggestionSectionLabel),
      suggestions: padSuggestions(sanitizeSuggestions(result.suggestions)),
      insightLabel: upperStr(result.insightLabel, FALLBACK.insightLabel),
      progressLabel: upperStr(result.progressLabel, FALLBACK.progressLabel),
      quickActionLabel: upperStr(result.quickActionLabel, FALLBACK.quickActionLabel),
      moodCheckLabel: upperStr(result.moodCheckLabel, FALLBACK.moodCheckLabel),
      goalsSectionLabel: upperStr(result.goalsSectionLabel, FALLBACK.goalsSectionLabel),
      habitsSectionLabel: upperStr(result.habitsSectionLabel, FALLBACK.habitsSectionLabel),
      progressItems: sanitizeProgressItems(result.progressItems),
      progressMetrics: sanitizeProgressMetrics(result.progressMetrics),
      progressStatus: upperStr(result.progressStatus, FALLBACK.progressStatus),
      priorityFocus: sanitizePriorityFocus(result.priorityFocus),
      plannerHeaderLabel: upperStr(result.plannerHeaderLabel, FALLBACK.plannerHeaderLabel),
      plannerEmptyTasks: str(result.plannerEmptyTasks, FALLBACK.plannerEmptyTasks),
      plannerEmptyHint: str(result.plannerEmptyHint, FALLBACK.plannerEmptyHint),
      plannerAiButton: upperStr(result.plannerAiButton, FALLBACK.plannerAiButton),
      plannerRemindersLabel: upperStr(result.plannerRemindersLabel, FALLBACK.plannerRemindersLabel),
      plannerEmptyReminders: str(result.plannerEmptyReminders, FALLBACK.plannerEmptyReminders),
      plannerSearch: str(result.plannerSearch, FALLBACK.plannerSearch),
      settingsProfileLabel: upperStr(result.settingsProfileLabel, FALLBACK.settingsProfileLabel),
      settingsAccountLabel: upperStr(result.settingsAccountLabel, FALLBACK.settingsAccountLabel),
      settingsPreferencesLabel: upperStr(result.settingsPreferencesLabel, FALLBACK.settingsPreferencesLabel),
      settingsGoalsLabel: upperStr(result.settingsGoalsLabel, FALLBACK.settingsGoalsLabel),
      settingsHabitsLabel: upperStr(result.settingsHabitsLabel, FALLBACK.settingsHabitsLabel),
      settingsDataLabel: upperStr(result.settingsDataLabel, FALLBACK.settingsDataLabel),
      settingsEditProfile: str(result.settingsEditProfile, FALLBACK.settingsEditProfile),
      settingsAboutPlaceholder: str(result.settingsAboutPlaceholder, FALLBACK.settingsAboutPlaceholder),
      settingsMoodHistory: upperStr(result.settingsMoodHistory, FALLBACK.settingsMoodHistory),
      settingsNoGoals: str(result.settingsNoGoals, FALLBACK.settingsNoGoals),
      settingsNoHabits: str(result.settingsNoHabits, FALLBACK.settingsNoHabits),
      navHome: str(result.navHome, FALLBACK.navHome),
      navPlanner: str(result.navPlanner, FALLBACK.navPlanner),
      navVoice: str(result.navVoice, FALLBACK.navVoice),
      navReminder: str(result.navReminder, FALLBACK.navReminder),
      navProfile: str(result.navProfile, FALLBACK.navProfile),
    };

    // ALWAYS force nav labels to fixed values — AI must not rename these
    sanitized.navHome = 'Home';
    sanitized.navPlanner = 'Planner';
    sanitized.navVoice = 'Voice';
    sanitized.navReminder = 'Reminders';
    sanitized.navProfile = 'Profile';

    // Clean any "AI" from visible labels (safety net)
    const aiLabelPattern = /\bAI\b/g;
    (sanitized as any).insightLabel = sanitized.insightLabel.replace(aiLabelPattern, 'SYNTRA');
    sanitized.quickActionLabel = sanitized.quickActionLabel.replace(aiLabelPattern, 'SYNTRA');
    sanitized.suggestionSectionLabel = sanitized.suggestionSectionLabel.replace(aiLabelPattern, 'SYNTRA');
    sanitized.plannerAiButton = sanitized.plannerAiButton.replace(aiLabelPattern, 'SMART');

    return NextResponse.json(
      { content: sanitized, aiGenerated: wasAiGenerated },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('Generate content API error:', error);
    return NextResponse.json(
      { content: FALLBACK, aiGenerated: false, error: error.message },
      { status: 500 }
    );
  }
}
