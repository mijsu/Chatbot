import { NextRequest, NextResponse } from 'next/server';


// ─── Request Body Interface ────────────────────────────────────────────────

interface AggregateRequest {
  /** Pre-serialized context string built by the frontend */
  serializedContext?: string;
  /** Whether to use deep (full) or basic (minimal) context mode */
  deepContextMode?: boolean;
}

// ─── Response Interface ────────────────────────────────────────────────────

interface AggregateResponse {
  /** The serialized context string ready for AI prompt injection */
  contextString: string;
  /** Which context mode was used */
  mode: 'deep' | 'basic';
  /** When this context was generated */
  generatedAt: string;
}

// ─── POST Handler ──────────────────────────────────────────────────────────

/**
 * POST /api/context/aggregate
 *
 * Receives serialized user context from the frontend, validates it,
 * optionally strips it down for basic mode, and returns the final
 * context string ready for AI injection.
 *
 * The frontend builds the SyntraUnifiedContext using the context engine,
 * serializes it, and sends it here. This endpoint's job is validation
 * and mode-based filtering — not context construction.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AggregateRequest;
    const { serializedContext, deepContextMode = true } = body;

    // ── Step 1: Validate input ──────────────────────────────────────────
    if (!serializedContext || typeof serializedContext !== 'string' || serializedContext.trim().length === 0) {
      return NextResponse.json(
        { error: 'serializedContext is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Cap context size to prevent abuse (max ~32K chars ≈ 8K tokens)
    const MAX_CONTEXT_LENGTH = 32000;
    if (serializedContext.length > MAX_CONTEXT_LENGTH) {
      return NextResponse.json(
        { error: `serializedContext exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    const mode: 'deep' | 'basic' = deepContextMode ? 'deep' : 'basic';
    let contextString = serializedContext;

    // ── Step 2: If deep mode, return the context as-is ──────────────────
    // The frontend already built and serialized the full context.

    // ── Step 3: If basic mode, strip context to essentials ──────────────
    if (!deepContextMode) {
      contextString = stripToBasicContext(serializedContext);
    }

    // ── Step 4: Return the context string for AI injection ──────────────
    const response: AggregateResponse = {
      contextString,
      mode,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    console.error('[context/aggregate] Error:', error);
    return NextResponse.json(
      { error: 'Failed to aggregate context' },
      { status: 500 }
    );
  }
}

// ─── Basic Context Stripping ───────────────────────────────────────────────

/**
 * Strips a deep serialized context down to basics for basic mode.
 * Keeps only: name, mood, basic task counts, and time.
 * Removes: detailed memory, scheduling, insights, patterns, etc.
 */
function stripToBasicContext(fullContext: string): string {
  const lines = fullContext.split('\n');
  const basicLines: string[] = [];

  // Section headers to keep (identity + emotional basics)
  const keepSectionHeaders = ['WHO YOU KNOW', 'HOW THEY FEEL', 'RIGHT NOW'];
  // Section headers to partially keep (tasks summary only)
  const partialSectionHeaders = ['WHAT THEY\'RE DOING'];

  let currentSection = '';
  let inKeepSection = false;
  let inPartialSection = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers (═══ SECTION NAME ═══)
    const sectionMatch = trimmed.match(/^═+ (.+?) ═+$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      inKeepSection = keepSectionHeaders.includes(currentSection);
      inPartialSection = partialSectionHeaders.includes(currentSection);

      if (inKeepSection || inPartialSection) {
        basicLines.push(line);
      }
      continue;
    }

    // Keep all lines in keep sections
    if (inKeepSection) {
      basicLines.push(line);
      continue;
    }

    // For partial sections, keep only summary lines (not individual items)
    if (inPartialSection) {
      // Keep summary/count lines, skip individual item listings
      const isSummaryLine =
        trimmed.startsWith('Tasks:') ||
        trimmed.startsWith('Workload:') ||
        trimmed.startsWith('Pending tasks:') ||
        trimmed.startsWith('Overdue:');

      if (isSummaryLine) {
        basicLines.push(line);
      }
    }
  }

  // If we couldn't parse anything meaningful, return a truncated version
  if (basicLines.length < 3) {
    return fullContext.slice(0, 800);
  }

  return basicLines.join('\n');
}
