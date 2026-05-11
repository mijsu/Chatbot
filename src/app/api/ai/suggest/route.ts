import { NextRequest, NextResponse } from 'next/server';
import { callAI, callAIForJSON, buildUserContextBlock, type UserContext } from '@/lib/ai-service';

interface SuggestContext {
  userName?: string;
  timeOfDay?: string;
  pendingTasks?: number;
  upcomingReminders?: number;
  recentTopics?: string[];
  aboutMe?: string;
  role?: string;
  interests?: string;
  activeGoals?: string[];
  todayHabits?: { title: string; streak: number; done: boolean }[];
  mood?: string;
  energy?: number;
}

interface Suggestion {
  icon: string;
  text: string;
  prompt: string;
}

const SYSTEM_PROMPT =
  'You are Syntra suggestion engine. Generate 5 personalized activity suggestions based on user context. Each suggestion should have: icon (one of: pen-tool, coffee, book-open, sparkles, brain, calendar, bell, image, mic, code), text (short label, max 3 words), prompt (full prompt to send to AI). You MUST respond with ONLY a valid JSON object with a "suggestions" key containing an array. Example: {"suggestions": [{"icon": "sparkles", "text": "Brainstorm", "prompt": "Help me brainstorm ideas"}]}. Output raw JSON only. No markdown. No code fences. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';

const FALLBACK_SUGGESTIONS: Suggestion[] = [
  { icon: 'sparkles', text: 'Brainstorm ideas', prompt: 'Help me brainstorm creative ideas for my current projects' },
  { icon: 'calendar', text: 'Plan my day', prompt: 'Help me organize and plan my schedule for today' },
  { icon: 'code', text: 'Debug code', prompt: 'I need help debugging or reviewing my code' },
  { icon: 'book-open', text: 'Learn something', prompt: 'Suggest something interesting I can learn right now' },
  { icon: 'coffee', text: 'Take a break', prompt: 'Suggest a relaxing 5-minute break activity' },
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context: rawContext, customEndpoint, modelName, apiKey } = body as { context?: SuggestContext; customEndpoint?: string; modelName?: string; apiKey?: string };
    const context: SuggestContext = rawContext || {};

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

    // Build a user message describing the current context
    const contextParts: string[] = [];
    if (personalContextBlock) contextParts.push(personalContextBlock);
    if (context.timeOfDay) contextParts.push(`Time of day: ${context.timeOfDay}`);
    if (context.pendingTasks !== undefined) contextParts.push(`Pending tasks: ${context.pendingTasks}`);
    if (context.upcomingReminders !== undefined) contextParts.push(`Upcoming reminders: ${context.upcomingReminders}`);
    if (context.recentTopics && context.recentTopics.length > 0) {
      contextParts.push(`Recent conversation topics: ${context.recentTopics.join(', ')}`);
    }

    const userMessage =
      contextParts.length > 0
        ? `Generate 5 personalized suggestions for me based on my current context:\n${contextParts.join('\n')}`
        : 'Generate 5 personalized activity suggestions for me.';

    // Try callAIForJSON first (handles both object {suggestions: [...]} and array [...])
    const { data: result, source } = await callAIForJSON<{ suggestions: Suggestion[] } | Suggestion[]>(
      [{ role: 'user', content: userMessage }],
      SYSTEM_PROMPT,
      { suggestions: FALLBACK_SUGGESTIONS },
      customEndpoint,
      modelName,
      apiKey,
      undefined,
      { maxRetries: hasCustomEndpoint ? 1 : 2 }
    );

    // Extract suggestions from either format
    let suggestions: Suggestion[];
    if (Array.isArray(result)) {
      // AI returned a bare array [...]
      suggestions = result;
    } else if (result && Array.isArray(result.suggestions)) {
      // AI returned an object {suggestions: [...]}
      suggestions = result.suggestions;
    } else {
      // Fallback
      suggestions = FALLBACK_SUGGESTIONS;
    }

    // If callAIForJSON returned fallback, try plain text approach with custom endpoint
    if (source === 'fallback' && hasCustomEndpoint) {
      console.log('[suggest] JSON parsing failed, trying plain text approach...');
      const plainTextResult = await callAI(
        [{ role: 'user', content: userMessage + '\n\nList 5 suggestions, each on its own line starting with a dash. Format: - Label: Full prompt description' }],
        'You are Syntra suggestion engine. Generate 5 personalized activity suggestions. Each on its own line starting with "- ". Be creative and varied. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.',
        customEndpoint,
        modelName,
        apiKey,
        0.8,
        { maxRetries: 1 }
      );

      if (plainTextResult.success) {
        const lines = plainTextResult.response.split('\n').map(l => l.trim()).filter(l => l.startsWith('-') || l.startsWith('•'));
        if (lines.length > 0) {
          const validIcons = ['pen-tool', 'coffee', 'book-open', 'sparkles', 'brain', 'calendar', 'bell', 'image', 'mic', 'code'];
          const parsed = lines.slice(0, 5).map((line, i) => {
            const text = line.replace(/^[-•*]\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
            const parts = text.split(':');
            return {
              icon: validIcons[i % validIcons.length],
              text: (parts[0] || text).slice(0, 30).trim(),
              prompt: (parts[1] || text).trim() || text,
            };
          });
          if (parsed.length > 0) {
            suggestions = parsed;
          }
        }
      }
    }

    // Validate and sanitize: ensure we have exactly 5 with correct structure
    const validIcons = ['pen-tool', 'coffee', 'book-open', 'sparkles', 'brain', 'calendar', 'bell', 'image', 'mic', 'code'];
    const sanitized: Suggestion[] = Array.isArray(suggestions)
      ? suggestions.slice(0, 5).map((s: any) => ({
          icon: validIcons.includes(s.icon) ? s.icon : 'sparkles',
          text: typeof s.text === 'string' ? s.text.slice(0, 50) : 'Try this',
          prompt: typeof s.prompt === 'string' ? s.prompt : 'Help me with something',
        }))
      : FALLBACK_SUGGESTIONS;

    // Pad if less than 5
    while (sanitized.length < 5) {
      sanitized.push(FALLBACK_SUGGESTIONS[sanitized.length] || FALLBACK_SUGGESTIONS[0]);
    }

    return NextResponse.json({ suggestions: sanitized });
  } catch (error: any) {
    console.error('Suggest API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate suggestions', suggestions: FALLBACK_SUGGESTIONS },
      { status: 500 }
    );
  }
}
