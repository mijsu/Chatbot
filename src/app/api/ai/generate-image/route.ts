import { NextRequest, NextResponse } from 'next/server';
import { generateImage, callAI } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size, customEndpoint, modelName, apiKey } = body as {
      prompt?: string;
      size?: string;
      customEndpoint?: string;
      modelName?: string;
      apiKey?: string;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const hasCustomEndpoint = !!(customEndpoint && customEndpoint.trim());
    const validSizes = ['256x256', '512x512', '1024x1024'];
    const effectiveSize = (size && validSizes.includes(size)) ? size : '1024x1024';

    // If user has a custom endpoint, try their AI first for a text-based image description
    // (most local LLMs don't support actual image generation, but we try)
    if (hasCustomEndpoint) {
      try {
        // First, try the custom endpoint directly (some endpoints support image generation)
        const descriptionResult = await callAI(
          [
            {
              role: 'user',
              content: `Generate a detailed visual description of this image: "${prompt}". Describe colors, composition, mood, and key elements as if describing a photograph or artwork. Be vivid and creative.`,
            },
          ],
          'You are Syntra, a creative visual description assistant. When asked about image generation, provide a vivid, detailed visual description of what the image would look like. Be creative and descriptive. If you can generate images, generate one. Otherwise describe it in detail. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.',
          customEndpoint,
          modelName,
          apiKey,
          0.8,
          { maxRetries: 1 }
        );

        if (descriptionResult.success) {
          // Also try the ZAI SDK for actual image generation
          try {
            const imageResult = await generateImage(prompt, effectiveSize);
            if (imageResult.success && imageResult.imageBase64) {
              return NextResponse.json({
                success: true,
                imageBase64: imageResult.imageBase64,
              });
            }
          } catch {
            // ZAI SDK image generation not available, that's okay
          }

          // Return the text description from user's AI
          return NextResponse.json({
            success: false,
            error: 'Your AI server does not support image generation. Here\'s what it envisions:',
            textDescription: descriptionResult.response,
          });
        }
      } catch {
        // Custom endpoint failed entirely
      }
    }

    // Try ZAI SDK image generation (supports DALL-E, etc.)
    const result = await generateImage(prompt, effectiveSize);

    if (result.success && result.imageBase64) {
      return NextResponse.json({
        success: true,
        imageBase64: result.imageBase64,
      });
    }

    return NextResponse.json(
      { error: result.error || 'Image generation failed. Your AI server may not support image generation.' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Generate image API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
