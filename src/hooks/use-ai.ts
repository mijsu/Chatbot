'use client';

import { useCallback } from 'react';
import { useApiConfig, isServerConnection } from '@/lib/api-config';
import type { UserContext } from '@/lib/ai-service';

/**
 * Hook that provides AI operations with automatic endpoint resolution.
 * Both DEFAULT (provider API) and CUSTOM (your own server) modes use
 * user-configured endpoints. There is no built-in AI — all AI calls
 * go through the user's configured API.
 *
 * Special case: When the connection type is 'server' (the URL points
 * to a Syntra server via tunnel), no customEndpoint is passed — the
 * server uses its built-in AI (z-ai-web-dev-sdk).
 */
export function useAI() {
  const mode = useApiConfig((s) => s.mode);
  const baseUrl = useApiConfig((s) => s.baseUrl);
  const customUrl = useApiConfig((s) => s.customUrl);
  const resolvedUrl = useApiConfig((s) => s.resolvedUrl);
  const modelName = useApiConfig((s) => s.modelName);
  const apiKey = useApiConfig((s) => s.apiKey);
  const status = useApiConfig((s) => s.status);
  const wasConnected = useApiConfig((s) => s.wasConnected);
  const connectionType = useApiConfig((s) => s.connectionType);

  /** Returns the customEndpoint to send to API routes.
   *  For 'server' connections, returns undefined so the server uses built-in AI.
   */
  const getEndpoint = useCallback((): string | undefined => {
    // If connected to a Syntra server (tunnel), don't pass customEndpoint —
    // the server will use its built-in AI (z-ai-web-dev-sdk)
    if (isServerConnection(connectionType)) {
      return undefined;
    }
    if (mode === 'custom') {
      return resolvedUrl || customUrl || undefined;
    }
    // DEFAULT mode: use provider base URL
    return resolvedUrl || baseUrl || undefined;
  }, [mode, baseUrl, customUrl, resolvedUrl, connectionType]);

  /** Returns the model name if configured */
  const getModelName = useCallback((): string | undefined => {
    if (modelName && modelName.trim()) {
      return modelName.trim();
    }
    return undefined;
  }, [modelName]);

  /** Returns the API key if configured */
  const getApiKey = useCallback((): string | undefined => {
    if (apiKey && apiKey.trim()) {
      return apiKey.trim();
    }
    return undefined;
  }, [apiKey]);

  /** Whether the AI is connected and available */
  const isConnected = status === 'connected' || wasConnected;

  /** Chat with AI - returns the AI response text with optional Reality-Based Intelligence Protocol context */
  const chat = useCallback(async (
    messages: { role: string; content: string }[],
    userContext?: UserContext,
    voiceTone?: string,
    options?: { dataAvailabilityReport?: string; dataAvailabilityReportJson?: object; userDataContext?: string; deepContextMode?: boolean },
  ): Promise<{
    success: boolean;
    response?: string;
    error?: string;
    dataSourcesChecked?: string[];
    wasFiltered?: boolean;
    hallucinationsDetected?: number;
  }> => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          customEndpoint: getEndpoint(),
          modelName: getModelName(),
          apiKey: getApiKey(),
          userContext,
          voiceTone,
          dataAvailabilityReport: options?.dataAvailabilityReport,
          dataAvailabilityReportJson: options?.dataAvailabilityReportJson,
          userDataContext: options?.userDataContext,
          deepContextMode: options?.deepContextMode,
        }),
      });
      if (!res.ok) {
        return { success: false, error: `Chat request failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Generate AI-powered smart suggestions */
  const getSuggestions = useCallback(async (context?: {
    userName?: string;
    timeOfDay?: string;
    pendingTasks?: number;
    upcomingReminders?: number;
    recentTopics?: string[];
    aboutMe?: string;
    role?: string;
    interests?: string;
    activeGoals?: string[];
    todayHabits?: { title: string; streak: number; done: boolean }[];
    mood?: string;
    energy?: number;
  }): Promise<{ suggestions: { icon: string; text: string; prompt: string }[] }> => {
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
      });
      if (!res.ok) {
        return { suggestions: [] };
      }
      return await res.json();
    } catch {
      return { suggestions: [] };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Parse natural language into a structured task */
  const createTaskFromAI = useCallback(async (description: string, date?: string, userContext?: any): Promise<{ task?: any; error?: string }> => {
    try {
      const res = await fetch('/api/ai/task-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, date, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext }),
      });
      if (!res.ok) {
        return { error: `Task creation failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Parse natural language into a structured reminder */
  const createReminderFromAI = useCallback(async (description: string, userContext?: any): Promise<{ reminder?: any; error?: string }> => {
    try {
      const res = await fetch('/api/ai/reminder-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext }),
      });
      if (!res.ok) {
        return { error: `Reminder creation failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Get AI-generated daily summary */
  const getDailySummary = useCallback(async (context?: {
    userName?: string;
    timeOfDay?: string;
    completedTasks?: number;
    pendingTasks?: number;
    totalTasks?: number;
    upcomingReminders?: number;
    activeGoals?: string[];
    todayHabits?: { title: string; streak: number; done: boolean }[];
    mood?: string;
    energy?: number;
    aboutMe?: string;
    role?: string;
    interests?: string;
  }, refreshId?: string): Promise<{
    summary?: {
      greeting: string;
      overview: string;
      highlights: string[];
      tip: string;
      tomorrowPreview: string;
    };
    aiGenerated?: boolean;
    error?: string;
  }> => {
    try {
      const res = await fetch('/api/ai/daily-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), refreshId }),
      });
      if (!res.ok) {
        return { error: `Daily summary failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Generate a daily plan from AI */
  const generatePlan = useCallback(async (request: string, date?: string, userContext?: any): Promise<{ plan?: any[]; error?: string }> => {
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request, date, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey(), userContext }),
      });
      if (!res.ok) {
        return { error: `Plan generation failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Generate an image from a prompt */
  const generateImage = useCallback(async (prompt: string, size?: string): Promise<{ success: boolean; imageBase64?: string; error?: string }> => {
    try {
      const res = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
      });
      if (!res.ok) {
        return { success: false, error: `Image generation failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Analyze an image with AI vision */
  const analyzeImage = useCallback(async (imageBase64: string, question: string): Promise<{ success: boolean; response?: string; error?: string }> => {
    try {
      const res = await fetch('/api/ai/analyze-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, question, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
      });
      if (!res.ok) {
        return { success: false, error: `Image analysis failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Transcribe audio to text */
  const transcribeAudio = useCallback(async (audioBase64: string, format?: string): Promise<{ success: boolean; text?: string; error?: string }> => {
    try {
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: audioBase64, format, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
      });
      if (!res.ok) {
        return { success: false, error: `Transcription failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Synthesize text to speech audio */
  const synthesizeSpeech = useCallback(async (text: string, voice?: string): Promise<Blob | null> => {
    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
      });
      if (res.ok) {
        return await res.blob();
      }
      return null;
    } catch {
      return null;
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Generate ALL dynamic UI content at once */
  const generateContent = useCallback(async (contextString: string, refreshId?: string): Promise<{
    content?: {
      greeting: string;
      statusLine: string;
      suggestionSectionLabel: string;
      suggestions: { icon: string; text: string; prompt: string; category: string }[];
      insightLabel: string;
      progressLabel: string;
      quickActionLabel: string;
    };
    aiGenerated?: boolean;
    error?: string;
  }> => {
    try {
      const res = await fetch('/api/ai/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contextString,
          customEndpoint: getEndpoint(),
          modelName: getModelName(),
          apiKey: getApiKey(),
          refreshId,
        }),
      });
      if (!res.ok) {
        return { error: `Content generation failed: ${res.status}` };
      }
      return await res.json();
    } catch (error: any) {
      return { error: error.message };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  /** Generate AI-powered quick replies based on conversation context */
  const generateQuickReplies = useCallback(async (lastMessage: string, contextString?: string): Promise<{
    replies?: string[];
    aiGenerated?: boolean;
  }> => {
    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            recentTopics: [lastMessage],
            aboutMe: contextString,
          },
          customEndpoint: getEndpoint(),
          modelName: getModelName(),
          apiKey: getApiKey(),
          mode: 'quick-replies',
        }),
      });
      const data = await res.json();
      if (data.suggestions && Array.isArray(data.suggestions)) {
        return {
          replies: data.suggestions.slice(0, 3).map((s: any) => typeof s === 'string' ? s : s.text || s.prompt),
          aiGenerated: true,
        };
      }
      return { replies: undefined, aiGenerated: false };
    } catch {
      return { replies: undefined, aiGenerated: false };
    }
  }, [getEndpoint, getModelName, getApiKey]);

  return {
    isConnected,
    getEndpoint,
    getModelName,
    getApiKey,
    chat,
    getSuggestions,
    getDailySummary,
    createTaskFromAI,
    createReminderFromAI,
    generatePlan,
    generateImage,
    analyzeImage,
    transcribeAudio,
    synthesizeSpeech,
    generateContent,
    generateQuickReplies,
  };
}
