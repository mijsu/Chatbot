import { NextRequest, NextResponse } from 'next/server';
import { callAIForJSON } from '@/lib/ai-service';


// ─── Request Body Interfaces ───────────────────────────────────────────────

interface MemoryItem {
  key: string;
  value: string;
  category: string;
  confidence: number;
}

interface ConversationSummary {
  content: string;
  conversationId: string;
}

interface SearchRequest {
  /** Natural language search query */
  query: string;
  /** Memory items to search across */
  memories: MemoryItem[];
  /** Conversation summaries for additional context */
  conversationSummaries?: ConversationSummary[];
  /** Search scope */
  scope?: 'current' | 'all' | 'global';
  /** Maximum number of results to return */
  limit?: number;
  /** Custom AI endpoint URL (if provided, uses AI for semantic search) */
  customEndpoint?: string;
  /** Model name for custom endpoint */
  modelName?: string;
  /** API key for custom endpoint */
  apiKey?: string;
}

// ─── Response Interfaces ───────────────────────────────────────────────────

interface SearchResult {
  key: string;
  value: string;
  category: string;
  confidence: number;
  relevanceScore: number;
}

interface SearchResponse {
  results: SearchResult[];
}

// ─── AI Response Interface ─────────────────────────────────────────────────

interface AIRelevanceResponse {
  results: Array<{
    key: string;
    relevanceScore: number;
  }>;
}

// ─── System Prompt for AI-powered Semantic Search ──────────────────────────

const SEMANTIC_SEARCH_SYSTEM_PROMPT = `You are Syntra memory search engine. Your job is to find the most relevant memories for a given search query.

You will receive:
1. A search query from the user
2. A list of memory items (each with key, value, category, confidence)

Your task:
- Evaluate each memory item for relevance to the search query
- Assign a relevanceScore from 0.0 to 1.0 (1.0 = perfectly relevant, 0.0 = not related)
- Only include items with relevanceScore > 0.3
- Sort by relevanceScore descending

You MUST respond with ONLY a valid JSON object with a "results" key containing an array of objects, each with "key" (matching the original key) and "relevanceScore" (number 0-1).

Example response:
{"results": [{"key": "user_preferred_language", "relevanceScore": 0.95}, {"key": "work_schedule", "relevanceScore": 0.7}]}

Output raw JSON only. No markdown. No code fences. No explanation.`;

// ─── POST Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/memory/search
 *
 * Performs AI-powered semantic search across conversation memory.
 * Falls back to keyword matching when no custom endpoint is provided.
 *
 * Flow:
 * 1. Validate query and memories
 * 2. If no customEndpoint → keyword-match and return results
 * 3. If customEndpoint → send memories + query to AI for semantic ranking
 * 4. Return matched results with relevance scores
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SearchRequest;
    const {
      query,
      memories = [],
      conversationSummaries = [],
      scope = 'all',
      limit = 10,
      customEndpoint,
      modelName,
      apiKey,
    } = body;

    // ── Step 1: Validate input ──────────────────────────────────────────
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    if (!Array.isArray(memories) || memories.length === 0) {
      return NextResponse.json(
        { results: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Cap limit to prevent excessive results
    const effectiveLimit = Math.min(Math.max(1, limit), 50);

    // ── Step 2: Filter memories by scope ────────────────────────────────
    const scopedMemories = filterByScope(memories, scope);

    if (scopedMemories.length === 0) {
      return NextResponse.json(
        { results: [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // ── Step 3: Route based on AI availability ──────────────────────────
    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());

    if (hasCustomEndpoint) {
      // AI-powered semantic search
      return await handleAISearch(query, scopedMemories, conversationSummaries, effectiveLimit, customEndpoint!, modelName, apiKey);
    } else {
      // Keyword-based fallback search
      return handleKeywordSearch(query, scopedMemories, effectiveLimit);
    }
  } catch (error: any) {
    console.error('[memory/search] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search memories' },
      { status: 500 }
    );
  }
}

// ─── Scope Filtering ───────────────────────────────────────────────────────

/**
 * Filter memories based on the search scope.
 * - 'current': Only high-confidence, recently relevant items
 * - 'all': All available memories
 * - 'global': Only global/category-agnostic memories
 */
function filterByScope(memories: MemoryItem[], scope: string): MemoryItem[] {
  switch (scope) {
    case 'current':
      // High confidence items only (>= 0.6)
      return memories.filter(m => m.confidence >= 0.6);
    case 'global':
      // Items with global-like categories
      return memories.filter(m =>
        m.category === 'preference' ||
        m.category === 'personal' ||
        m.category === 'fact' ||
        m.category === 'global'
      );
    case 'all':
    default:
      return memories;
  }
}

// ─── Keyword Search (Fallback) ─────────────────────────────────────────────

/**
 * Performs keyword-based matching against memory items.
 * Uses simple token overlap scoring for relevance.
 */
function handleKeywordSearch(
  query: string,
  memories: MemoryItem[],
  limit: number
): NextResponse {
  const queryTokens = tokenize(query);
  const results: SearchResult[] = [];

  for (const memory of memories) {
    const searchableText = `${memory.key} ${memory.value} ${memory.category}`.toLowerCase();
    const memoryTokens = tokenize(searchableText);

    // Calculate token overlap as relevance score
    const overlap = queryTokens.filter(qt =>
      memoryTokens.some(mt => mt.includes(qt) || qt.includes(mt))
    ).length;

    // Normalize score: ratio of matching tokens to query tokens
    const keywordScore = queryTokens.length > 0 ? overlap / queryTokens.length : 0;

    // Combine keyword score with confidence
    const relevanceScore = Math.round(
      (keywordScore * 0.7 + memory.confidence * 0.3) * 100
    ) / 100;

    // Only include items with meaningful relevance
    if (relevanceScore > 0.1) {
      results.push({
        key: memory.key,
        value: memory.value,
        category: memory.category,
        confidence: memory.confidence,
        relevanceScore,
      });
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return NextResponse.json(
    { results: results.slice(0, limit) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// ─── AI-Powered Semantic Search ────────────────────────────────────────────

/**
 * Uses AI to semantically rank memories by relevance to the query.
 * Sends the memory keys + values to the AI and asks for relevance scores.
 */
async function handleAISearch(
  query: string,
  memories: MemoryItem[],
  conversationSummaries: ConversationSummary[],
  limit: number,
  customEndpoint: string,
  modelName?: string,
  apiKey?: string
): Promise<NextResponse> {
  // Prepare memory items for the AI prompt (limit to avoid token overflow)
  const maxMemoriesForAI = 30;
  const memoriesForAI = memories.slice(0, maxMemoriesForAI).map(m => ({
    key: m.key,
    value: m.value.slice(0, 200), // Truncate long values
    category: m.category,
    confidence: m.confidence,
  }));

  // Build the user message with memories and query
  const memoryList = memoriesForAI
    .map(m => `  - key: "${m.key}", value: "${m.value}", category: "${m.category}", confidence: ${m.confidence}`)
    .join('\n');

  let userMessage = `Search Query: "${query}"\n\nMemory Items:\n${memoryList}`;

  // Optionally include conversation summaries for richer context
  if (conversationSummaries.length > 0) {
    const summaryList = conversationSummaries
      .slice(0, 5)
      .map(s => `  - [${s.conversationId}]: ${s.content.slice(0, 150)}`)
      .join('\n');
    userMessage += `\n\nRecent Conversation Summaries:\n${summaryList}`;
  }

  // Use callAIForJSON to get structured relevance scores
  const fallbackResponse: AIRelevanceResponse = { results: [] };

  const { data: aiResult, source, error } = await callAIForJSON<AIRelevanceResponse>(
    [{ role: 'user', content: userMessage }],
    SEMANTIC_SEARCH_SYSTEM_PROMPT,
    fallbackResponse,
    customEndpoint,
    modelName,
    apiKey,
    0.3, // Low temperature for consistent scoring
    { maxRetries: 1 }
  );

  // If AI failed or returned fallback, fall back to keyword search
  if (source === 'fallback' || !aiResult.results || aiResult.results.length === 0) {
    console.log('[memory/search] AI semantic search failed, falling back to keyword search', error || '');
    return handleKeywordSearch(query, memories, limit);
  }

  // Map AI relevance scores back to full memory items
  const scoreMap = new Map<string, number>();
  for (const r of aiResult.results) {
    if (r.key && typeof r.relevanceScore === 'number') {
      scoreMap.set(r.key, Math.min(1, Math.max(0, r.relevanceScore)));
    }
  }

  // Build results with AI scores
  const results: SearchResult[] = [];
  for (const memory of memories) {
    const aiScore = scoreMap.get(memory.key);
    if (aiScore !== undefined && aiScore > 0.3) {
      results.push({
        key: memory.key,
        value: memory.value,
        category: memory.category,
        confidence: memory.confidence,
        relevanceScore: Math.round(aiScore * 100) / 100,
      });
    }
  }

  // Sort by AI relevance score descending
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return NextResponse.json(
    { results: results.slice(0, limit) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// ─── Tokenization Helper ───────────────────────────────────────────────────

/**
 * Simple tokenizer: lowercase, split on non-alphanumeric, remove empty tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1); // Skip single-character tokens
}
