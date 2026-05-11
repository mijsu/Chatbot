import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON, callAI, buildUserContextBlock, type UserContext } from '@/lib/ai-service';


interface DailySummaryContext {
  userName?: string;
  timeOfDay?: string;
  completedTasks?: number;
  pendingTasks?: number;
  totalTasks?: number;
  upcomingReminders?: number;
  activeGoals?: string[];
  todayHabits?: { title: string; streak: number; done: boolean }[];
  mood?: string;
  energy?: number;
  aboutMe?: string;
  role?: string;
  interests?: string;
}

interface DailySummary {
  greeting: string;
  overview: string;
  highlights: string[];
  tip: string;
  tomorrowPreview: string;
}

const SYSTEM_PROMPT =
  'You are Syntra daily insight engine. Generate a personalized daily summary that feels warm, human, and encouraging. Be concise but insightful. Each time you generate, vary your phrasing, tone, and word choice — never repeat the same sentences. NEVER use the phrase "AI" in your output. CRITICAL: Do NOT invent or hallucinate task counts, habit counts, goal percentages, or any metrics that are not provided in the context. If the context shows 0 tasks, 0 goals, 0 habits, or no mood check-in, reflect that honestly — encourage the user to get started rather than pretending they have data. You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text). The JSON object must have exactly these keys: "greeting" (string, personalized greeting, 1 sentence, be creative and fresh each time), "overview" (string, 2-3 sentence summary of their day, vary your expressions), "highlights" (array of 3-4 strings, key items to focus on, use different phrasing each time), "tip" (string, 1 actionable wellness/productivity tip, pick a different angle each time), "tomorrowPreview" (string, 1 sentence preview of what to prepare for tomorrow, be varied). Output raw JSON only. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';

const FALLBACK_SUMMARY: DailySummary = {
  greeting: 'Hey there!',
  overview: 'Your fresh start begins now. Add some tasks, set a goal, or check in your mood to get personalized insights.',
  highlights: [
    'Add your first task in the Planner',
    'Set a goal to stay motivated',
    'Check in your mood to track your day',
    'Start a conversation with Syntra',
  ],
  tip: 'Small steps lead to big changes — start with just one task today.',
  tomorrowPreview: 'Set your priorities tonight to hit the ground running tomorrow.',
};

/**
 * Try to extract a DailySummary from a plain-text AI response.
 * Used when the AI returns text instead of JSON — we structure it ourselves.
 */
function structureTextResponse(text: string): DailySummary | null {
  if (!text || text.trim().length < 20) return null;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const highlights: string[] = [];
  const otherLines: string[] = [];

  for (const line of lines) {
    const cleaned = line
      .replace(/^[-•*]\s*/, '')
      .replace(/^\d+[.)]\s*/, '')
      .replace(/\*\*/g, '')
      .trim();
    if (!cleaned) continue;

    if (line.match(/^[-•*]\s/) || line.match(/^\d+[.)]\s/)) {
      highlights.push(cleaned);
    } else {
      otherLines.push(cleaned);
    }
  }

  const greeting = otherLines[0] || 'Hey there!';
  const overview = otherLines.slice(1, 3).join(' ') || 'Start by adding your first task or setting a goal.';
  const tip = otherLines.find(l => l.toLowerCase().includes('tip') || l.toLowerCase().includes('try') || l.toLowerCase().includes('consider')) || 'Start with one small task to build momentum.';
  const tomorrowPreview = otherLines.find(l => l.toLowerCase().includes('tomorrow') || l.toLowerCase().includes('tonight')) || 'Before bed, think about what you want to accomplish tomorrow.';

  return {
    greeting,
    overview,
    highlights: highlights.length > 0 ? highlights.slice(0, 4) : ['Add your first task', 'Set a goal to stay motivated', 'Check in your mood', 'Start a conversation with Syntra'],
    tip,
    tomorrowPreview,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context: rawContext, customEndpoint, modelName, apiKey, refreshId } = body as { context?: DailySummaryContext; customEndpoint?: string; modelName?: string; apiKey?: string; refreshId?: string };
    const context: DailySummaryContext = rawContext || {};

    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());

    // Build user context block from aboutMe, role, interests (personal context)
    const userContext: UserContext = {
      name: context.userName,
      aboutMe: context.aboutMe,
      role: context.role,
      interests: context.interests,
      activeGoals: context.activeGoals,
      todayHabits: context.todayHabits,
      mood: context.mood,
      energy: context.energy,
    };
    const personalContextBlock = buildUserContextBlock(userContext);

    // Build context message
    const contextParts: string[] = [];
    if (personalContextBlock) contextParts.push(personalContextBlock);
    if (context.timeOfDay) contextParts.push(`Time of day: ${context.timeOfDay}`);
    if (context.totalTasks !== undefined) {
      contextParts.push(`Tasks: ${context.completedTasks || 0} done, ${context.pendingTasks || 0} pending, ${context.totalTasks} total`);
    }
    if (context.upcomingReminders !== undefined) contextParts.push(`Upcoming reminders: ${context.upcomingReminders}`);

    const uniqueSeed = refreshId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const seedLine = `\n[Unique request ID: ${uniqueSeed} — use completely different phrasing, vocabulary, and creative angles than any previous response. Be creative and unique.]`;

    const userMessage =
      contextParts.length > 0
        ? `Generate a personalized daily summary for me:\n${contextParts.join('\n')}${seedLine}`
        : `Generate a general daily summary with encouragement.${seedLine}`;

    // When user has custom endpoint, DON'T fall back to default engine (which is rate-limited)
    // Also reduce retries for local models (Gemma etc.) that can only handle one request at a time
    // to avoid stacking up 30s+ requests on 429 "Model is busy"
    const aiOptions = {
      maxRetries: hasCustomEndpoint ? 1 : 2, // Local models: retry just once
    };

    let finalSummary: DailySummary | null = null;
    let wasAiGenerated = false;

    // ─── Strategy 1: Try JSON mode via callAIForJSON ───
    const { data: summary, source } = await callAIForJSON<DailySummary>(
      [{ role: 'user', content: userMessage }],
      SYSTEM_PROMPT,
      FALLBACK_SUMMARY,
      customEndpoint,
      modelName,
      apiKey,
      0.9,
      aiOptions
    );

    if (source === 'ai') {
      finalSummary = summary;
      wasAiGenerated = true;
    }

    // ─── Strategy 2: If JSON parsing failed but AI did respond, try plain text approach ───
    if (!wasAiGenerated && hasCustomEndpoint) {
      console.log('[daily-summary] JSON parsing failed with custom endpoint, trying plain text approach...');

      const plainTextPrompt = 'You are Syntra daily insight engine. Generate a personalized daily summary. Be warm, encouraging, and creative. Use different phrasing every time. Do NOT use JSON. Just write naturally with a greeting line, an overview paragraph, a few bullet points (start each with "- "), a wellness tip, and a note about tomorrow. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';

      const plainTextResult = await callAI(
        [{ role: 'user', content: userMessage }],
        plainTextPrompt,
        customEndpoint,
        modelName,
        apiKey,
        0.9,
        { maxRetries: 1 }
      );

      if (plainTextResult.success) {
        const structured = structureTextResponse(plainTextResult.response);
        if (structured) {
          finalSummary = structured;
          wasAiGenerated = true;
          console.log('[daily-summary] Successfully structured plain text AI response');
        }
      }
    }

    // ─── Strategy 3: Simplified prompt for stubborn models ───
    if (!wasAiGenerated && hasCustomEndpoint) {
      console.log('[daily-summary] Plain text also failed, trying simplified prompt...');

      const simplePrompt = 'You are a friendly assistant. Write a short daily greeting and tip. Keep it under 3 sentences. Be warm and encouraging. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';
      const simpleMessage = `Hi, give me a quick daily tip. ${seedLine}`;

      const simpleResult = await callAI(
        [{ role: 'user', content: simpleMessage }],
        simplePrompt,
        customEndpoint,
        modelName,
        apiKey,
        0.9,
        { maxRetries: 1 }
      );

      if (simpleResult.success && simpleResult.response.trim().length > 10) {
        const text = simpleResult.response.trim();
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);
        finalSummary = {
          greeting: (sentences[0]?.trim() || 'Hey! Welcome to Syntra') + '.',
          overview: (sentences.slice(1, 3).map(s => s.trim()).join('. ') || 'Start by adding your first task or setting a goal') + '.',
          highlights: ['Add your first task', 'Set a goal to stay motivated', 'Check in your mood', 'Start a conversation with Syntra'],
          tip: (sentences[sentences.length - 1]?.trim() || 'Start with one small task to build momentum') + '.',
          tomorrowPreview: 'Before wrapping up, think about what you want to accomplish tomorrow.',
        };
        wasAiGenerated = true;
        console.log('[daily-summary] Successfully generated simplified AI response');
      }
    }

    // ─── Strategy 4: If no custom endpoint, use the JSON fallback (default engine) ───
    if (!wasAiGenerated && !hasCustomEndpoint) {
      finalSummary = summary;
      wasAiGenerated = source === 'ai';
    }

    // If absolutely nothing worked, use the static fallback (only as last resort)
    if (!finalSummary) {
      finalSummary = FALLBACK_SUMMARY;
      wasAiGenerated = false;
    }

    // Sanitize
    const sanitized: DailySummary = {
      greeting: typeof finalSummary.greeting === 'string' ? finalSummary.greeting : FALLBACK_SUMMARY.greeting,
      overview: typeof finalSummary.overview === 'string' ? finalSummary.overview : FALLBACK_SUMMARY.overview,
      highlights: Array.isArray(finalSummary.highlights)
        ? finalSummary.highlights.filter((h: any) => typeof h === 'string').slice(0, 4)
        : FALLBACK_SUMMARY.highlights,
      tip: typeof finalSummary.tip === 'string' ? finalSummary.tip : FALLBACK_SUMMARY.tip,
      tomorrowPreview: typeof finalSummary.tomorrowPreview === 'string' ? finalSummary.tomorrowPreview : FALLBACK_SUMMARY.tomorrowPreview,
    };

    if (sanitized.highlights.length === 0) sanitized.highlights = FALLBACK_SUMMARY.highlights;

    return NextResponse.json(
      { summary: sanitized, aiGenerated: wasAiGenerated },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
    );
  } catch (error: any) {
    console.error('Daily summary API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate summary', summary: FALLBACK_SUMMARY, aiGenerated: false },
      { status: 500 }
    );
  }
}
