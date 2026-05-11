import { NextRequest, NextResponse } from 'next/server';

function isLocalNetwork(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.') ||
    hostname === '0.0.0.0'
  );
}

// Common OpenAI-compatible API paths to try when auto-discovering
const API_PATHS = [
  '/v1/chat/completions',
  '/chat/completions',
  '/v1/completions',
  '/api/chat',
  '/api/v1/chat/completions',
  '/openai/v1/chat/completions',
];

function looksLikeBasePath(pathname: string): boolean {
  // If the path is just "/" or empty, it's a base URL
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' || trimmed === '/';
}

async function tryFetch(url: string, options: RequestInit, timeoutMs: number): Promise<{ response: Response; latency: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const start = Date.now();
    const response = await fetch(url, { ...options, signal: controller.signal });
    const latency = Date.now() - start;
    clearTimeout(timeout);
    return { response, latency };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url, apiKey } = await request.json();

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return NextResponse.json(
          { success: false, error: 'Only http:// and https:// URLs are supported' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const isLocal = isLocalNetwork(parsedUrl.hostname);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`;
    const isBase = looksLikeBasePath(parsedUrl.pathname);

    // Build headers with optional API key
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey && apiKey.trim()) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    // ─── Step 1: If the URL already has a specific path, test it directly ───
    if (!isBase) {
      const result = await tryFetch(url, { method: 'GET', headers }, isLocal ? 6000 : 10000);
      if (result) {
        // Try to auto-detect available models
        let detectedModel: string | null = null;
        try {
          const modelsResult = await tryFetch(`${baseUrl}/v1/models`, { method: 'GET', headers }, 5000);
          if (modelsResult && modelsResult.response.ok) {
            const modelsData = await modelsResult.response.json();
            if (modelsData.data && Array.isArray(modelsData.data) && modelsData.data.length > 0) {
              detectedModel = modelsData.data[0].id;
            }
          }
        } catch {
          // Ignore — models endpoint not available
        }

        // Server responded to GET — try the chat POST
        const chatResult = await tryFetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: detectedModel || undefined,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1,
          }),
        }, 10000);

        if (chatResult) {
          const ok = chatResult.response.ok || (chatResult.response.status >= 400 && chatResult.response.status < 500);
          return NextResponse.json({
            success: true,
            latency: chatResult.latency,
            resolvedUrl: url,
            detectedModel,
            note: ok ? (detectedModel ? `Model detected: ${detectedModel}` : undefined) : `Server responded with ${chatResult.response.status}`,
          });
        }

        return NextResponse.json({
          success: true,
          latency: result.latency,
          resolvedUrl: url,
          detectedModel,
          note: 'Server reachable (GET OK). Chat endpoint may need a different path.',
        });
      }

      // Direct path failed, try auto-discover as fallback
    }

    // ─── Step 2: Auto-discover the API endpoint path ───
    // First, verify the base server is reachable at all
    const basePing = await tryFetch(baseUrl, { method: 'GET', headers }, isLocal ? 5000 : 8000);

    if (!basePing) {
      const errorMsg = isLocal
        ? `Cannot reach ${parsedUrl.hostname}:${parsedUrl.port || 80}. Make sure the server is running and your device is on the same network.`
        : `Cannot reach ${parsedUrl.host}. The server may be down or the URL is incorrect.`;

      return NextResponse.json({
        success: false,
        error: errorMsg,
      });
    }

    // Server is reachable — now discover the API path
    let discoveredPath: string | null = null;
    let bestLatency = basePing.latency;

    // Try a quick chat POST on each known path (in parallel with a limit)
    for (const path of API_PATHS) {
      const testUrl = `${baseUrl}${path}`;
      const result = await tryFetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
      }, 6000);

      if (result) {
        const status = result.response.status;
        // 200 = working, 401/403 = exists but needs auth, 400/422 = exists but bad request format
        // All of these mean we found the right endpoint
        if (status === 200 || status === 401 || status === 403 || status === 400 || status === 422) {
          discoveredPath = path;
          bestLatency = result.latency;
          break;
        }
      }
    }

    if (discoveredPath) {
      const resolvedUrl = `${baseUrl}${discoveredPath}`;
      return NextResponse.json({
        success: true,
        latency: bestLatency,
        resolvedUrl,
        discoveredPath,
        note: discoveredPath !== '/v1/chat/completions'
          ? `Auto-discovered endpoint at ${discoveredPath}`
          : undefined,
      });
    }

    // Could not auto-discover — server is up but no known API path found
    return NextResponse.json({
      success: true,
      latency: basePing.latency,
      resolvedUrl: null,
      note: `Server is reachable but no OpenAI-compatible endpoint was found. Tried: ${API_PATHS.join(', ')}. Make sure your server exposes an OpenAI-compatible API (like LM Studio, Ollama, or text-generation-webui).`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
