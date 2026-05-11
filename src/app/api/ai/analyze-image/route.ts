import { NextRequest, NextResponse } from 'next/server';
import { callAI, getZAI, ChatMessage } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageBase64, question, customEndpoint, modelName, apiKey } = body as {
      imageBase64?: string;
      question?: string;
      customEndpoint?: string;
      modelName?: string;
      apiKey?: string;
    };

    if (!imageBase64 || !question) {
      return NextResponse.json(
        { error: 'Image data and question are required' },
        { status: 400 }
      );
    }

    // If custom endpoint is provided, try sending a vision request with the image
    if (customEndpoint) {
      try {
        const visionPrompt = `The user has shared an image and asks: "${question}". Analyze the image and respond helpfully.`;
        
        const { resolveEndpointUrl, discoverApiPath, discoveredPathCache, detectedModelCache } = await import('@/lib/ai-service');
        const { baseUrl, fullUrl, isBase } = resolveEndpointUrl(customEndpoint);
        
        let endpointUrl = fullUrl;
        if (isBase) {
          const discoveredPath = discoveredPathCache.get(baseUrl) || await discoverApiPath(baseUrl);
          endpointUrl = discoveredPath ? `${baseUrl}${discoveredPath}` : `${baseUrl}/v1/chat/completions`;
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKey?.trim()) headers['Authorization'] = `Bearer ${apiKey.trim()}`;

        const requestBody: Record<string, any> = {
          messages: [
            { role: 'system', content: 'You are a vision assistant. Analyze the provided image and answer questions concisely. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.' },
            {
              role: 'user',
              content: [
                { type: 'text', text: visionPrompt },
                { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}` } },
              ],
            },
          ],
          max_tokens: 2048,
          temperature: 0.7,
        };

        if (modelName?.trim()) requestBody.model = modelName.trim();

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60000);
        
        const res = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const aiResponse = data.choices?.[0]?.message?.content || data.response || data.content;
          if (aiResponse) {
            return NextResponse.json({ success: true, response: aiResponse });
          }
        }
      } catch (error) {
        console.error('Custom endpoint vision error:', error);
      }
    }

    // Fallback: use ZAI SDK vision
    try {
      const zai = await getZAI();
      const completion = await zai.chat.completions.createVision({
        messages: [
          {
            role: 'system',
            content: 'You are Syntra vision assistant. Analyze the provided image and answer questions about it concisely and accurately. ANTI-HALLUCINATION RULE: Only reference information that exists in the data provided. Do not invent, assume, or hallucinate any details. If data is missing, acknowledge it rather than making assumptions.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: question },
              { type: 'image_url', image_url: { url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}` } },
            ] as any,
          },
        ],
        thinking: { type: 'disabled' },
      } as any);

      const aiResponse = completion.choices[0]?.message?.content;
      if (aiResponse) {
        return NextResponse.json({ success: true, response: aiResponse });
      }
    } catch (error: any) {
      console.error('ZAI vision error:', error);
    }

    return NextResponse.json(
      { success: false, error: 'Image analysis failed' },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Analyze image API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
