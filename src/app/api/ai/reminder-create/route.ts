import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON, buildUserContextBlock, type UserContext } from '@/lib/ai-service';

interface ReminderData {
  title: string;
  description: string;
  time: string | null;
  icon: string;
  recurring: string;
  recurringEndDate: string;
}

const BASE_SYSTEM_PROMPT =
  'You are Syntra reminder parser. Extract structured reminder data from natural language. You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text) with these keys: "title" (string), "description" (string), "time" (string or null, HH:MM format), "icon" (one of: clock, bell, calendar), "recurring" (one of: "", "daily", "weekly", "monthly" — empty string means one-time), "recurringEndDate" (string, ISO date YYYY-MM-DD when recurring should stop, empty string means forever). If something can\'t be determined, use null or empty string. Output raw JSON only. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';

const FALLBACK_REMINDER: ReminderData = {
  title: 'New Reminder',
  description: '',
  time: null,
  icon: 'bell',
  recurring: '',
  recurringEndDate: '',
};

const VALID_ICONS = ['clock', 'bell', 'calendar'];
const VALID_RECURRING = ['', 'daily', 'weekly', 'monthly'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, customEndpoint, modelName, apiKey, userContext } = body as {
      description?: string;
      customEndpoint?: string;
      modelName?: string;
      apiKey?: string;
      userContext?: UserContext;
    };

    if (!description || typeof description !== 'string' || !description.trim()) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    // Build system prompt with user context if available
    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (userContext) {
      const contextBlock = buildUserContextBlock(userContext);
      if (contextBlock) {
        systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nYou know the following about the user. Use this to make the reminder more relevant and personalized:\n${contextBlock}`;
      }
    }

    const userMessage = `Parse this reminder: ${description}`;

    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());
    const { data: reminder } = await callAIForJSON<ReminderData>(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
      FALLBACK_REMINDER,
      customEndpoint,
      modelName,
      apiKey,
      undefined,
      { maxRetries: hasCustomEndpoint ? 1 : 2 }
    );

    // Sanitize and validate the parsed reminder
    const sanitized: ReminderData = {
      title: typeof reminder.title === 'string' && reminder.title.trim() ? reminder.title.trim() : description.trim().slice(0, 100),
      description: typeof reminder.description === 'string' ? reminder.description : '',
      time: typeof reminder.time === 'string' && /^\d{2}:\d{2}$/.test(reminder.time) ? reminder.time : null,
      icon: VALID_ICONS.includes(reminder.icon) ? reminder.icon : 'bell',
      recurring: VALID_RECURRING.includes(reminder.recurring) ? reminder.recurring : '',
      recurringEndDate: typeof reminder.recurringEndDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(reminder.recurringEndDate) ? reminder.recurringEndDate : '',
    };

    return NextResponse.json({ reminder: sanitized });
  } catch (error: any) {
    console.error('Reminder create API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse reminder', reminder: FALLBACK_REMINDER },
      { status: 500 }
    );
  }
}
