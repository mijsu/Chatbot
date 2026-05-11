import { NextRequest, NextResponse } from 'next/server';
import { getZAI, resolveEndpointUrl } from '@/lib/ai-service';

// POST /api/voice/transcribe — Transcribe audio from base64
export async function POST(req: NextRequest) {
  try {
    const { audio, format, customEndpoint, modelName, apiKey } = await req.json();

    if (!audio) {
      return NextResponse.json(
        { error: 'Audio data is required' },
        { status: 400 }
      );
    }

    // Limit audio payload size (base64 — 10MB raw ≈ 13.3MB base64)
    const MAX_AUDIO_LENGTH = 14_000_000;
    if (audio.length > MAX_AUDIO_LENGTH) {
      return NextResponse.json(
        { error: 'Audio file too large. Please record a shorter clip.' },
        { status: 413 }
      );
    }

    // If a custom endpoint is provided, try OpenAI-compatible STT first
    if (customEndpoint && customEndpoint.trim()) {
      try {
        const { baseUrl } = resolveEndpointUrl(customEndpoint.trim());

        // OpenAI-compatible transcription endpoint
        const sttUrl = `${baseUrl}/v1/audio/transcriptions`;

        // Build multipart form data
        const audioBuffer = Buffer.from(audio, 'base64');
        const audioFormat = format || 'webm';
        const filename = `audio.${audioFormat}`;
        const mimeType = audioFormat === 'wav' ? 'audio/wav' : audioFormat === 'mp3' ? 'audio/mpeg' : 'audio/webm';

        const boundary = `----FormBoundary${Date.now().toString(16)}`;
        const parts: Buffer[] = [];

        // Add file part
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
        ));
        parts.push(audioBuffer);
        parts.push(Buffer.from('\r\n'));

        // Add model part if provided
        const model = modelName?.trim() || 'whisper-1';
        parts.push(Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`
        ));

        // Close boundary
        parts.push(Buffer.from(`--${boundary}--\r\n`));

        const bodyBuffer = Buffer.concat(parts);

        const headers: Record<string, string> = {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        };
        if (apiKey?.trim()) {
          headers['Authorization'] = `Bearer ${apiKey.trim()}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);

        const sttRes = await fetch(sttUrl, {
          method: 'POST',
          headers,
          body: bodyBuffer,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (sttRes.ok) {
          const data = await sttRes.json();
          const transcribedText = data.text || '';

          return NextResponse.json({
            success: true,
            text: transcribedText,
          });
        }

        // Custom endpoint STT failed — log and fall back to ZAI
        const errorText = await sttRes.text().catch(() => 'Unknown error');
        console.warn(`[STT] Custom endpoint failed (${sttRes.status}): ${errorText.substring(0, 200)}. Falling back to ZAI SDK.`);
      } catch (customError: any) {
        console.warn(`[STT] Custom endpoint error: ${customError.message}. Falling back to ZAI SDK.`);
      }
    }

    // Fallback: ZAI SDK with timeout
    const zai = await getZAI();

    // 30s timeout for ZAI SDK ASR using AbortController
    const asrController = new AbortController();
    const asrTimeoutId = setTimeout(() => {
      asrController.abort();
    }, 30000);

    let response;
    try {
      // audio should be base64 encoded audio data
      response = await zai.audio.asr.create({
        file_base64: audio,
      });
    } catch (asrError: any) {
      if (asrController.signal.aborted) {
        return NextResponse.json(
          { error: 'Transcription request timed out. Please try a shorter recording.' },
          { status: 504 }
        );
      }
      throw asrError;
    } finally {
      clearTimeout(asrTimeoutId);
    }

    return NextResponse.json({
      success: true,
      text: response.text || '',
    });
  } catch (error: any) {
    console.error('ASR API error:', error);
    return NextResponse.json(
      { error: error.message || 'Transcription failed' },
      { status: 500 }
    );
  }
}
