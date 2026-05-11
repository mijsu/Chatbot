import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON, buildUserContextBlock, type UserContext } from '@/lib/ai-service';

interface PlanItem {
  time: string;
  title: string;
  description: string;
  category: string;
}

const BASE_SYSTEM_PROMPT =
  'You are Syntra daily planner. Given a planning request and date, generate a structured schedule. You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text) with a "plan" key containing an array: {"plan": [{ "time": "HH:MM", "title": string, "description": string, "category": "general"|"meeting"|"design"|"code"|"personal" }]}. Make it realistic and helpful. Output raw JSON only. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';

const FALLBACK_PLAN: PlanItem[] = [
  { time: '09:00', title: 'Morning routine', description: 'Start the day with a morning review', category: 'personal' },
  { time: '10:00', title: 'Focus work', description: 'Deep work on priority tasks', category: 'general' },
  { time: '12:00', title: 'Lunch break', description: 'Take a break and recharge', category: 'personal' },
  { time: '13:00', title: 'Collaboration time', description: 'Meetings and team sync', category: 'meeting' },
  { time: '15:00', title: 'Creative work', description: 'Design and brainstorming session', category: 'design' },
];

const VALID_CATEGORIES = ['general', 'meeting', 'design', 'code', 'personal'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { request: planRequest, date, customEndpoint, modelName, apiKey, userContext } = body as {
      request?: string;
      date?: string;
      customEndpoint?: string;
      modelName?: string;
      apiKey?: string;
      userContext?: UserContext;
    };

    if (!planRequest || typeof planRequest !== 'string' || !planRequest.trim()) {
      return NextResponse.json(
        { error: 'Request is required' },
        { status: 400 }
      );
    }

    // Build system prompt with user context if available
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (userContext) {
      const contextBlock = buildUserContextBlock(userContext);
      if (contextBlock) {
        systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nYou know the following about the user. Personalize the plan based on their context:\n${contextBlock}`;
      }
    }

    const contextParts: string[] = [`Create a day plan based on: ${planRequest}`];
    if (date) contextParts.push(`Date: ${date}`);

    const userMessage = contextParts.join('\n');

    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());
    const { data: planResult } = await callAIForJSON<{ plan: PlanItem[] } | PlanItem[]>(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
      { plan: FALLBACK_PLAN },
      customEndpoint,
      modelName,
      apiKey,
      undefined,
      { maxRetries: hasCustomEndpoint ? 1 : 2 }
    );

    // Extract plan from either format: {plan: [...]} or [...]
    const plan = Array.isArray(planResult) ? planResult : (planResult?.plan || FALLBACK_PLAN);

    // Sanitize and validate each plan item
    const sanitized: PlanItem[] = Array.isArray(plan)
      ? plan.map((item: any) => ({
          time: typeof item.time === 'string' && /^\d{2}:\d{2}$/.test(item.time) ? item.time : '09:00',
          title: typeof item.title === 'string' && item.title.trim() ? item.title.trim() : 'Planned activity',
          description: typeof item.description === 'string' ? item.description : '',
          category: VALID_CATEGORIES.includes(item.category) ? item.category : 'general',
        }))
      : FALLBACK_PLAN;

    return NextResponse.json({ plan: sanitized });
  } catch (error: any) {
    console.error('Plan API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate plan', plan: FALLBACK_PLAN },
      { status: 500 }
    );
  }
}
