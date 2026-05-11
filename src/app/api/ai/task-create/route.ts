import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON, buildUserContextBlock, type UserContext } from '@/lib/ai-service';

interface TaskData {
  title: string;
  description: string;
  time: string | null;
  location: string | null;
  participants: string | null;
  category: string;
  date: string | null;
}

const BASE_SYSTEM_PROMPT =
  'You are Syntra task parser. Extract structured task data from the user\'s natural language description. You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text) with these keys: "title" (string), "description" (string), "time" (string or null, HH:MM format), "location" (string or null), "participants" (string or null), "category" (one of: general, meeting, design, code, personal), "date" (YYYY-MM-DD or null). If something can\'t be determined, use null. Output raw JSON only. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.';

const FALLBACK_TASK: TaskData = {
  title: 'New Task',
  description: '',
  time: null,
  location: null,
  participants: null,
  category: 'general',
  date: null,
};

const VALID_CATEGORIES = ['general', 'meeting', 'design', 'code', 'personal'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { description, date, customEndpoint, modelName, apiKey, userContext } = body as {
      description?: string;
      date?: string;
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
        systemPrompt = `${BASE_SYSTEM_PROMPT}\n\nYou know the following about the user. Use this to make the task more relevant and personalized:\n${contextBlock}`;
      }
    }

    const contextParts: string[] = [`Parse this task: ${description}`];
    if (date) contextParts.push(`Date context: ${date}`);

    const userMessage = contextParts.join('\n');

    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());
    const { data: task } = await callAIForJSON<TaskData>(
      [{ role: 'user', content: userMessage }],
      systemPrompt,
      FALLBACK_TASK,
      customEndpoint,
      modelName,
      apiKey,
      undefined,
      { maxRetries: hasCustomEndpoint ? 1 : 2 }
    );

    // Sanitize and validate the parsed task
    const sanitized: TaskData = {
      title: typeof task.title === 'string' && task.title.trim() ? task.title.trim() : description.trim().slice(0, 100),
      description: typeof task.description === 'string' ? task.description : '',
      time: typeof task.time === 'string' && /^\d{2}:\d{2}$/.test(task.time) ? task.time : null,
      location: typeof task.location === 'string' && task.location.trim() ? task.location.trim() : null,
      participants: typeof task.participants === 'string' && task.participants.trim() ? task.participants.trim() : null,
      category: VALID_CATEGORIES.includes(task.category) ? task.category : 'general',
      date: typeof task.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.date) ? task.date : (date || null),
    };

    return NextResponse.json({ task: sanitized });
  } catch (error: any) {
    console.error('Task create API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse task', task: FALLBACK_TASK },
      { status: 500 }
    );
  }
}
