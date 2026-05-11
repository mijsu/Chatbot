import { NextRequest, NextResponse } from 'next/server';
import { getZAI, resolveEndpointUrl } from '@/lib/ai-service';

// POST /api/voice/synthesize — Convert text to speech audio
export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.0, customEndpoint, modelName, apiKey } = await req.json();

    if (!text || !text.trim()) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Limit to 1024 characters per TTS request
    const inputText = text.trim().substring(0, 1024);
    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));

    // If a custom endpoint is provided, try OpenAI-compatible TTS first
    if (customEndpoint && customEndpoint.trim()) {
      try {
        const { baseUrl } = resolveEndpointUrl(customEndpoint.trim());

        // OpenAI-compatible TTS endpoint
        const ttsUrl = `${baseUrl}/v1/audio/speech`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (apiKey?.trim()) {
          headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        }

        const requestBody: Record<string, unknown> = {
          input: inputText,
          voice: voice || 'alloy',
          speed: clampedSpeed,
          response_format: 'mp3',
        };
        if (modelName?.trim()) {
          requestBody.model = modelName.trim();
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const ttsRes = await fetch(ttsUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (ttsRes.ok) {
          const arrayBuffer = await ttsRes.arrayBuffer();
          const buffer = Buffer.from(new Uint8Array(arrayBuffer));

          // Determine content type from response header or default to audio/mpeg
          const contentType = ttsRes.headers.get('content-type') || 'audio/mpeg';

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Length': buffer.length.toString(),
              'Cache-Control': 'no-cache',
            },
          });
        }

        // Custom endpoint TTS failed — log and fall back to ZAI
        const errorText = await ttsRes.text().catch(() => 'Unknown error');
        console.warn(`[TTS] Custom endpoint failed (${ttsRes.status}): ${errorText.substring(0, 200)}. Falling back to ZAI SDK.`);
      } catch (customError: any) {
        console.warn(`[TTS] Custom endpoint error: ${customError.message}. Falling back to ZAI SDK.`);
      }
    }

    // Fallback: ZAI SDK with timeout
    const zai = await getZAI();

    // 30s timeout for ZAI SDK TTS using AbortController
    const ttsController = new AbortController();
    const ttsTimeoutId = setTimeout(() => {
      ttsController.abort();
    }, 30000);

    let response;
    try {
      response = await zai.audio.tts.create({
        input: inputText,
        voice,
        speed: clampedSpeed,
        response_format: 'mp3',
        stream: false,
      });
    } catch (ttsError: any) {
      clearTimeout(ttsTimeoutId);
      if (ttsController.signal.aborted) {
        return NextResponse.json(
          { error: 'Speech synthesis request timed out. Please try a shorter text.' },
          { status: 504 }
        );
      }
      throw ttsError;
    }
    clearTimeout(ttsTimeoutId);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('TTS API error:', error);
    return NextResponse.json(
      { error: error.message || 'Speech synthesis failed' },
      { status: 500 }
    );
  }
}
