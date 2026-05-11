import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON } from '@/lib/ai-service';


// ─── Request Body Interface ────────────────────────────────────────────────

interface InsightsRequest {
  /** Serialized user context string (built by context/aggregate) */
  contextString: string;
  /** Custom AI endpoint URL */
  customEndpoint?: string;
  /** Model name for custom endpoint */
  modelName?: string;
  /** API key for custom endpoint */
  apiKey?: string;
}

// ─── Response Interfaces ───────────────────────────────────────────────────

type InsightType = 'warning' | 'suggestion' | 'celebration' | 'question';
type InsightPriority = 'low' | 'medium' | 'high';

interface Insight {
  type: InsightType;
  title: string;
  description: string;
  actionItems: string[];
  priority: InsightPriority;
}

interface InsightsResponse {
  insights: Insight[];
  aiGenerated: boolean;
  timestamp: string;
}

// ─── System Prompt ─────────────────────────────────────────────────────────

const INSIGHTS_SYSTEM_PROMPT = `You are Syntra insights engine. Analyze the user's full context and generate 1-5 proactive insights that are personalized, actionable, and timely.

Guidelines:
- "warning" insights: Alert about risks (burnout, missed deadlines, low mood, scheduling conflicts)
- "suggestion" insights: Recommend actions based on patterns (optimize schedule, build habits, focus areas)
- "celebration" insights: Acknowledge achievements (completed tasks, habit streaks, mood improvements)
- "question" insights: Prompt reflection (goals alignment, time investment, priorities)

Rules:
- Be specific to THIS user's context — reference their actual tasks, habits, moods, goals
- Each insight should be independently valuable
- actionItems should be concrete next steps (max 3 per insight)
- priority: "high" = act today, "medium" = this week, "low" = whenever convenient
- If context is minimal, generate 1-2 general but still personalized insights
- NEVER use the phrase "AI" in any output
- Keep titles under 8 words, descriptions under 3 sentences

You MUST respond with ONLY a valid JSON object with an "insights" key containing an array of insight objects. Each insight must have: type (string), title (string), description (string), actionItems (array of strings), priority (string).

Example:
{"insights": [{"type": "warning", "title": "Overdue tasks piling up", "description": "You have 5 overdue tasks that need attention.", "actionItems": ["Review overdue list", "Reschedule or delegate"], "priority": "high"}]}

Output raw JSON only. No markdown. No code fences.`;

// ─── Fallback Insights ─────────────────────────────────────────────────────

const FALLBACK_INSIGHTS: Insight[] = [
  {
    type: 'suggestion',
    title: 'Review your priorities',
    description: 'Take a moment to review your current tasks and goals to ensure you\'re focusing on what matters most.',
    actionItems: ['List your top 3 priorities', 'Identify one thing to delegate or defer'],
    priority: 'medium',
  },
];

// ─── POST Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/insights/generate
 *
 * Uses AI to analyze all user data and generate proactive insights.
 * Falls back to generic insights when no endpoint is configured or
 * when the AI call fails.
 *
 * Flow:
 * 1. Validate the context string
 * 2. Build a prompt with the user's context
 * 3. Call AI (callAIForJSON) for structured insight generation
 * 4. Parse and validate the AI response (with fallback)
 * 5. Return structured insights
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as InsightsRequest;
    const {
      contextString,
      customEndpoint,
      modelName,
      apiKey,
    } = body;

    // ── Step 1: Validate input ──────────────────────────────────────────
    if (!contextString || typeof contextString !== 'string' || contextString.trim().length === 0) {
      return NextResponse.json(
        { error: 'contextString is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());

    // ── Step 2: Build the user message with context ─────────────────────
    const userMessage = `Analyze my current context and generate personalized insights:\n\n${contextString}`;

    // ── Step 3: Call AI for structured insights ─────────────────────────
    let insights: Insight[] = [];
    let aiGenerated = false;

    if (hasCustomEndpoint) {
      // Use AI-powered insight generation
      const { data, source, error } = await callAIForJSON<{ insights: Insight[] }>(
        [{ role: 'user', content: userMessage }],
        INSIGHTS_SYSTEM_PROMPT,
        { insights: FALLBACK_INSIGHTS },
        customEndpoint,
        modelName,
        apiKey,
        0.7, // Moderate temperature for creative but relevant insights
        { maxRetries: 1 }
      );

      if (source === 'ai' && data.insights && Array.isArray(data.insights) && data.insights.length > 0) {
        insights = sanitizeInsights(data.insights);
        aiGenerated = true;
      } else {
        console.log('[insights/generate] AI call failed or returned invalid data, using fallback', error || '');
        insights = FALLBACK_INSIGHTS;
      }
    } else {
      // No custom endpoint configured — return basic fallback insights
      insights = generateRuleBasedInsights(contextString);
      aiGenerated = false;
    }

    // ── Step 4: Return structured insights ──────────────────────────────
    const response: InsightsResponse = {
      insights,
      aiGenerated,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    console.error('[insights/generate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate insights' },
      { status: 500 }
    );
  }
}

// ─── Insight Sanitization ──────────────────────────────────────────────────

/**
 * Validate and sanitize AI-generated insights to ensure they conform
 * to the expected structure. Removes malformed entries.
 */
function sanitizeInsights(raw: any[]): Insight[] {
  const validTypes: InsightType[] = ['warning', 'suggestion', 'celebration', 'question'];
  const validPriorities: InsightPriority[] = ['low', 'medium', 'high'];

  const sanitized: Insight[] = [];

  for (const item of raw.slice(0, 5)) { // Max 5 insights
    if (!item || typeof item !== 'object') continue;

    const type = validTypes.includes(item.type) ? item.type : 'suggestion';
    const title = typeof item.title === 'string' ? item.title.slice(0, 80) : 'Insight';
    const description = typeof item.description === 'string' ? item.description.slice(0, 500) : '';
    const priority = validPriorities.includes(item.priority) ? item.priority : 'medium';

    // Ensure actionItems is an array of strings
    let actionItems: string[] = [];
    if (Array.isArray(item.actionItems)) {
      actionItems = item.actionItems
        .filter((a: any) => typeof a === 'string')
        .map((a: string) => a.slice(0, 150))
        .slice(0, 3); // Max 3 action items
    }

    sanitized.push({ type, title, description, actionItems, priority });
  }

  return sanitized.length > 0 ? sanitized : FALLBACK_INSIGHTS;
}

// ─── Rule-Based Insights (No AI Fallback) ──────────────────────────────────

/**
 * Generates basic insights from the context string using rule-based
 * pattern matching when no AI endpoint is available.
 */
function generateRuleBasedInsights(contextString: string): Insight[] {
  const insights: Insight[] = [];
  const lower = contextString.toLowerCase();

  // Check for overdue tasks
  if (lower.includes('overdue') || lower.includes('abandoned')) {
    const overdueMatch = lower.match(/overdue[:\s]*(\d+)/);
    const count = overdueMatch ? overdueMatch[1] : 'some';
    insights.push({
      type: 'warning',
      title: 'Overdue tasks need attention',
      description: `You have ${count} overdue task(s). Addressing these should be a priority to prevent them from piling up further.`,
      actionItems: ['Review overdue items', 'Reschedule or complete them today'],
      priority: 'high',
    });
  }

  // Check for burnout risk
  if (lower.includes('burnout') || lower.includes('overloaded')) {
    insights.push({
      type: 'warning',
      title: 'Burnout risk detected',
      description: 'Your workload appears heavy. Consider taking breaks and reducing commitments where possible.',
      actionItems: ['Schedule a break today', 'Identify one task to delegate or remove'],
      priority: 'high',
    });
  }

  // Check for declining mood
  if (lower.includes('declining') || lower.includes('mood: low') || lower.includes('mood: bad')) {
    insights.push({
      type: 'suggestion',
      title: 'Take care of yourself',
      description: 'Your mood has been declining recently. Small acts of self-care can make a big difference.',
      actionItems: ['Take a short walk', 'Reach out to a friend', 'Do something you enjoy'],
      priority: 'medium',
    });
  }

  // Check for habit streaks to celebrate
  const streakMatch = lower.match(/(\d+)-day streak/g);
  if (streakMatch && streakMatch.length > 0) {
    insights.push({
      type: 'celebration',
      title: 'Keep the streak going',
      description: `You have active habit streaks — great consistency! Maintaining streaks builds lasting habits.`,
      actionItems: ['Complete today\'s habits', 'Set a reminder if you haven\'t yet'],
      priority: 'low',
    });
  }

  // Check for scheduling conflicts
  if (lower.includes('conflict') || lower.includes('⚠')) {
    insights.push({
      type: 'warning',
      title: 'Schedule conflicts found',
      description: 'You have overlapping commitments. Resolving these now will save stress later.',
      actionItems: ['Review conflicting items', 'Reschedule one of them'],
      priority: 'high',
    });
  }

  // Check for completed tasks to celebrate
  if (lower.includes('completed') || lower.includes('done today')) {
    insights.push({
      type: 'celebration',
      title: 'Progress made today',
      description: 'You\'ve completed tasks today — every step forward counts. Keep the momentum going.',
      actionItems: ['Acknowledge your progress', 'Tackle the next priority'],
      priority: 'low',
    });
  }

  // Default suggestion if no specific patterns matched
  if (insights.length === 0) {
    insights.push({
      type: 'question',
      title: 'What matters most right now?',
      description: 'Consider what single focus would make the biggest impact on your day.',
      actionItems: ['Identify your top priority', 'Block time for it'],
      priority: 'medium',
    });
  }

  return insights.slice(0, 5);
}
