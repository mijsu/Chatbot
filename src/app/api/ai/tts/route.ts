import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text, voice = 'tongtong', speed = 1.1 } = await req.json();

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    // Limit to 1024 chars per TTS API constraint
    const trimmedText = text.trim().slice(0, 1024);

    // Import ZAI SDK
    const ZAI = (await import('z-ai-web-dev-sdk')).default;

    // Create SDK instance
    const zai = await ZAI.create();

    // Generate TTS audio in wav format (mp3 not supported by this API)
    const response = await zai.audio.tts.create({
      input: trimmedText,
      voice: voice,
      speed: speed,
      response_format: 'wav',
      stream: false,
    });

    // Get array buffer from Response object
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // Return audio as base64 so the client can play it
    const base64Audio = buffer.toString('base64');

    return NextResponse.json({
      success: true,
      audioBase64: base64Audio,
      format: 'wav',
    });
  } catch (error) {
    console.error('TTS API Error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'TTS generation failed',
        success: false,
      },
      { status: 500 }
    );
  }
}
