import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isCapacitorNative } from './capacitor-notifications';

export type ConnectionMode = 'default' | 'custom';
export type ConnectionStatus = 'disconnected' | 'testing' | 'connected' | 'error';
export type ConnectionType = 'cloudflare' | 'ngrok' | 'local' | 'localhost' | 'server' | 'custom' | null;
export type ApiProvider = 'openai' | 'gemini' | 'glm' | 'anthropic' | 'groq' | 'together' | 'mistral' | 'deepseek' | 'other';

export interface ProviderPreset {
  id: ApiProvider;
  label: string;
  baseUrl: string;
  models: string[];
  requiresApiKey: boolean;
  apiKeyPrefix: string;
  apiKeyPlaceholder: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1', 'o1-mini', 'o3-mini'],
    requiresApiKey: true,
    apiKeyPrefix: 'sk-',
    apiKeyPlaceholder: 'sk-proj-...',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    requiresApiKey: true,
    apiKeyPrefix: 'AI',
    apiKeyPlaceholder: 'AIza...',
  },
  // NOTE: Anthropic is NOT included because it uses a different API format
  // (x-api-key header, anthropic-version header, no system role in messages).
  // Use an OpenAI-compatible proxy (e.g., litellm, openrouter) to connect to Anthropic.
  {
    id: 'glm',
    label: 'GLM (ZhipuAI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas',
    models: ['glm-4-plus', 'glm-4-flash', 'glm-4-air', 'glm-4-long'],
    requiresApiKey: true,
    apiKeyPrefix: '',
    apiKeyPlaceholder: 'your-api-key',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    requiresApiKey: true,
    apiKeyPrefix: 'gsk_',
    apiKeyPlaceholder: 'gsk_...',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1', 'togethercomputer/RedPajama-INCITE-7B-Chat'],
    requiresApiKey: true,
    apiKeyPrefix: '',
    apiKeyPlaceholder: 'your-api-key',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    baseUrl: 'https://api.mistral.ai',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'open-mistral-nemo'],
    requiresApiKey: true,
    apiKeyPrefix: '',
    apiKeyPlaceholder: 'your-api-key',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    requiresApiKey: true,
    apiKeyPrefix: 'sk-',
    apiKeyPlaceholder: 'sk-...',
  },
  {
    id: 'other',
    label: 'Other / Custom',
    baseUrl: '',
    models: [],
    requiresApiKey: false,
    apiKeyPrefix: '',
    apiKeyPlaceholder: 'your-api-key',
  },
];

export function getProviderPreset(id: ApiProvider): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find(p => p.id === id);
}

export interface ApiConfig {
  mode: ConnectionMode;
  provider: ApiProvider;
  baseUrl: string;           // API base URL for DEFAULT mode (provider endpoint)
  customUrl: string;         // Server URL for CUSTOM mode (your own server)
  resolvedUrl: string | null; // The full URL with discovered API path
  modelName: string;         // Model name for the API
  apiKey: string;            // API key for authentication
  status: ConnectionStatus;
  lastTested: number | null;
  latency: number | null;
  connectionType: ConnectionType;
  errorMessage: string | null;
  wasConnected: boolean;
}

const STORAGE_KEY = 'chatbot_api_config';

const defaultConfig: ApiConfig = {
  mode: 'default',
  provider: 'other',
  baseUrl: '',
  customUrl: '',
  resolvedUrl: null,
  modelName: '',
  apiKey: '',
  status: 'disconnected',
  lastTested: null,
  latency: null,
  connectionType: null,
  errorMessage: null,
  wasConnected: false,
};

export function detectConnectionType(url: string): ConnectionType {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes('cloudflare') || lower.includes('trycloudflare')) return 'cloudflare';
  if (lower.includes('ngrok')) return 'ngrok';
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'localhost';
  if (/^(https?:\/\/)?(\d{1,3}\.){3}\d{1,3}/.test(lower)) return 'local';
  return 'custom';
}

/**
 * Check if a connection type represents a Syntra server
 * (the URL points to a Next.js server, not an AI provider).
 * When connected to a server, the built-in AI SDK is used instead of
 * passing the URL as a customEndpoint.
 */
export function isServerConnection(type: ConnectionType): boolean {
  return type === 'server';
}

/**
 * Safely parse a fetch Response as JSON.
 * Handles the case where the server returns HTML instead of JSON
 * (e.g., Cloudflare error pages, Next.js 404 pages).
 * Returns a fallback object with a helpful error message if parsing fails.
 */
async function safeJsonParse(res: Response, fallback: Record<string, any> = {}): Promise<Record<string, any>> {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    // Content type is not JSON — read as text and check
    const text = await res.text();
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        return JSON.parse(text);
      } catch {
        // Not valid JSON
      }
    }
    // Response is HTML or other non-JSON content
    console.warn('[safeJsonParse] Response is not JSON. Content-Type:', contentType, 'Status:', res.status);
    return {
      ...fallback,
      success: false,
      error: res.status === 404
        ? 'API endpoint not found. Make sure the server is running and the URL is correct.'
        : res.status >= 500
          ? 'Server error. The server may be down or misconfigured.'
          : `Received HTML instead of JSON (status ${res.status}). Make sure the URL points to a Syntra server or an OpenAI-compatible API.`,
    };
  } catch (error: any) {
    if (error.message?.includes('Unexpected token')) {
      return {
        ...fallback,
        success: false,
        error: 'Received HTML instead of JSON. This usually means the URL points to a web page, not an API. Make sure the server is running and the URL is correct.',
      };
    }
    return {
      ...fallback,
      success: false,
      error: error.message || 'Failed to parse server response',
    };
  }
}

/**
 * Test connection in Capacitor native mode (APK).
 *
 * In the APK, the server-side test-connection endpoint doesn't work
 * because fetch('/api/...') gets rewritten by the Capacitor patch.
 * Instead, we test directly from the client:
 *
 * 1. First, try the /api/health endpoint — if it returns JSON with
 *    status "ok", this is a Syntra server. Mark as "server" connection.
 *    The server will use its built-in AI (z-ai-web-dev-sdk).
 *
 * 2. If /api/health fails, try OpenAI-compatible API path discovery
 *    directly from the client (for LM Studio, Ollama, etc.).
 */
async function testConnectionCapacitor(
  serverUrl: string,
  apiKey?: string,
  modelName?: string,
): Promise<boolean> {
  console.log(`[testConnectionCapacitor] Testing connection to: ${serverUrl}`);

  // Step 1: Try Syntra server health check
  try {
    const healthStart = Date.now();
    const healthController = new AbortController();
    const healthTimeout = setTimeout(() => healthController.abort(), 8000);

    const healthUrl = `${serverUrl}/api/health`;
    console.log(`[testConnectionCapacitor] Step 1: Health check at ${healthUrl}`);

    const healthRes = await fetch(healthUrl, {
      method: 'GET',
      signal: healthController.signal,
    });
    clearTimeout(healthTimeout);

    const healthLatency = Date.now() - healthStart;
    const healthData = await safeJsonParse(healthRes);

    if (healthData.status === 'ok' && healthData.service === 'syntra-server') {
      console.log('[testConnectionCapacitor] ✅ Syntra server detected! Using built-in AI.');

      // This is a Syntra server — use built-in AI, no customEndpoint needed
      useApiConfig.setState({
        status: 'connected',
        latency: healthLatency,
        lastTested: Date.now(),
        errorMessage: null,
        wasConnected: true,
        connectionType: 'server',
        resolvedUrl: null, // No customEndpoint — server uses built-in AI
      });

      // Sync server URL to Capacitor API routing
      try {
        const { setCapacitorServerUrl } = await import('./capacitor-api');
        setCapacitorServerUrl(serverUrl);
        console.log(`[testConnectionCapacitor] Synced server URL: ${serverUrl}`);
      } catch (e) {
        console.warn('[testConnectionCapacitor] Failed to sync Capacitor server URL:', e);
      }

      return true;
    }
  } catch (healthError: any) {
    console.log('[testConnectionCapacitor] Health check failed:', healthError.message);
    // Health check failed — continue to Step 2 (maybe it's an AI provider, not a Syntra server)
  }

  // Step 2: Try OpenAI-compatible API path discovery
  console.log('[testConnectionCapacitor] Step 2: Trying OpenAI-compatible API discovery...');

  const API_PATHS = [
    '/v1/chat/completions',
    '/chat/completions',
    '/v1/completions',
    '/api/v1/chat/completions',
    '/openai/v1/chat/completions',
  ];

  // Build headers with optional API key
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey && apiKey.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  }

  // First, verify the base server is reachable
  try {
    const baseController = new AbortController();
    const baseTimeout = setTimeout(() => baseController.abort(), 8000);
    await fetch(serverUrl, {
      method: 'GET',
      headers,
      signal: baseController.signal,
    });
    clearTimeout(baseTimeout);
  } catch (baseError: any) {
    useApiConfig.setState({
      status: 'error',
      errorMessage: `Cannot reach ${serverUrl}. Make sure the server is running and the URL is correct. Error: ${baseError.message}`,
      lastTested: Date.now(),
    });
    return false;
  }

  // Try each API path
  let discoveredPath: string | null = null;
  let bestLatency = 0;
  let detectedModel: string | null = null;

  for (const path of API_PATHS) {
    try {
      const testUrl = `${serverUrl}${path}`;
      const start = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const testRes = await fetch(testUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      bestLatency = Date.now() - start;

      const status = testRes.status;
      if (status === 200 || status === 401 || status === 403 || status === 400 || status === 422) {
        discoveredPath = path;
        console.log(`[testConnectionCapacitor] Found API path: ${path} (status ${status})`);
        break;
      }
    } catch {
      // Continue to next path
    }
  }

  // Try to auto-detect model
  if (discoveredPath) {
    try {
      const modelsController = new AbortController();
      const modelsTimeout = setTimeout(() => modelsController.abort(), 5000);
      const modelsRes = await fetch(`${serverUrl}/v1/models`, {
        method: 'GET',
        headers,
        signal: modelsController.signal,
      });
      clearTimeout(modelsTimeout);

      if (modelsRes.ok) {
        const modelsData = await safeJsonParse(modelsRes);
        if (modelsData.data && Array.isArray(modelsData.data) && modelsData.data.length > 0) {
          detectedModel = modelsData.data[0].id;
        }
      }
    } catch {
      // Ignore — models endpoint not available
    }

    const resolvedUrl = `${serverUrl}${discoveredPath}`;
    const updates: Partial<ApiConfig> = {
      status: 'connected',
      latency: bestLatency,
      lastTested: Date.now(),
      errorMessage: null,
      wasConnected: true,
      resolvedUrl,
    };

    if (detectedModel && !useApiConfig.getState().modelName?.trim()) {
      updates.modelName = detectedModel;
    }

    useApiConfig.setState(updates);

    // Sync server URL to Capacitor API routing
    try {
      const { setCapacitorServerUrl } = await import('./capacitor-api');
      setCapacitorServerUrl(serverUrl);
    } catch {}

    return true;
  }

  // Server is reachable but no API path found
  useApiConfig.setState({
    status: 'error',
    errorMessage: `Server is reachable but no compatible API was found. If this is a Syntra server, make sure it's running the latest version. If it's an AI provider (LM Studio, Ollama), make sure it's running and accessible.`,
    lastTested: Date.now(),
  });
  return false;
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || !url.trim()) {
    return { valid: false, error: 'URL is required' };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    // Try adding https:// prefix automatically
    try {
      parsedUrl = new URL(`https://${url}`);
    } catch {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return { valid: false, error: 'Only http:// and https:// URLs are supported' };
  }

  // Warn about http for non-local URLs
  if (parsedUrl.protocol === 'http:') {
    const hostname = parsedUrl.hostname;
    const isLocal =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname === '0.0.0.0';

    if (!isLocal) {
      return { valid: false, error: 'HTTP is not secure for remote URLs. Please use HTTPS.' };
    }
  }

  return { valid: true };
}

/**
 * Get the URL to use for chat requests.
 * Resolves based on mode:
 * - DEFAULT: resolvedUrl || baseUrl
 * - CUSTOM: resolvedUrl || customUrl
 */
export function getEndpointUrl(config: ApiConfig): string {
  if (config.mode === 'custom') {
    return config.resolvedUrl || config.customUrl;
  }
  return config.resolvedUrl || config.baseUrl;
}

interface ApiConfigStore extends ApiConfig {
  setMode: (mode: ConnectionMode) => void;
  setProvider: (provider: ApiProvider) => void;
  setBaseUrl: (url: string) => void;
  setCustomUrl: (url: string) => void;
  setModelName: (name: string) => void;
  setApiKey: (key: string) => void;
  setStatus: (status: ConnectionStatus, error?: string) => void;
  testConnection: () => Promise<boolean>;
  saveAndConnect: () => void;
  reset: () => void;
  initialize: () => void;
}

export const useApiConfig = create<ApiConfigStore>()(
  persist(
    (set, get) => ({
      ...defaultConfig,

      initialize: () => {
        const state = get();
        // Restore 'connected' status optimistically if we were previously connected
        if (state.wasConnected) {
          const url = state.mode === 'custom' ? state.customUrl : state.baseUrl;
          if (url && state.status === 'disconnected') {
            set({ status: 'connected', errorMessage: null });
          }
        }
      },

      setMode: (mode: ConnectionMode) => {
        set({ mode, status: 'disconnected', errorMessage: null, latency: null, wasConnected: false, resolvedUrl: null });
      },

      setProvider: (provider: ApiProvider) => {
        const preset = getProviderPreset(provider);
        set({
          provider,
          baseUrl: preset?.baseUrl || '',
          // Auto-set model to first in preset if no model selected yet
          modelName: (!get().modelName && preset?.models?.[0]) ? preset.models[0] : get().modelName,
          status: 'disconnected',
          errorMessage: null,
          resolvedUrl: null,
          wasConnected: false,
        });
      },

      setBaseUrl: (url: string) => {
        set({ baseUrl: url, status: 'disconnected', errorMessage: null, resolvedUrl: null, wasConnected: false });
      },

      setCustomUrl: (url: string) => {
        const connectionType = detectConnectionType(url);
        set({ customUrl: url, connectionType, status: 'disconnected', errorMessage: null, resolvedUrl: null, wasConnected: false });
      },

      setModelName: (name: string) => {
        set({ modelName: name });
      },

      setApiKey: (key: string) => {
        set({ apiKey: key });
      },

      setStatus: (status: ConnectionStatus, error?: string) => {
        set({ status, errorMessage: error || null });
      },

      testConnection: async () => {
        const { mode, baseUrl, customUrl, apiKey, modelName, provider } = get();
        const url = mode === 'custom' ? customUrl : baseUrl;

        if (!url) {
          set({ status: 'error', errorMessage: 'No URL provided' });
          return false;
        }

        const validation = validateUrl(url);
        if (!validation.valid) {
          set({ status: 'error', errorMessage: validation.error });
          return false;
        }

        set({ status: 'testing', errorMessage: null });

        // Normalize URL
        let normalizedUrl = url.trim();
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
          normalizedUrl = `https://${normalizedUrl}`;
        }
        // Remove trailing slash
        normalizedUrl = normalizedUrl.replace(/\/+$/, '');

        // ─── Capacitor Native Mode: Client-side connection test ───
        // In the APK, fetch('/api/...') gets rewritten by the Capacitor patch,
        // so server-side testing doesn't work reliably. Instead, we test directly
        // from the client.
        if (isCapacitorNative()) {
          return testConnectionCapacitor(normalizedUrl, apiKey, modelName);
        }

        // ─── Web Mode: Server-side test with auto-discovery ───

        // For local network URLs, try client-side ping first (browser can reach local network)
        const isLocal =
          url.includes('192.168.') ||
          url.includes('localhost') ||
          url.includes('127.0.0.1') ||
          url.includes('10.') ||
          /https?:\/\/172\.(1[6-9]|2\d|3[01])\./.test(url);

        if (isLocal) {
          try {
            const clientStart = Date.now();
            const clientController = new AbortController();
            const clientTimeout = setTimeout(() => clientController.abort(), 5000);

            await fetch(url, {
              method: 'GET',
              signal: clientController.signal,
            });
            clearTimeout(clientTimeout);

            const clientLatency = Date.now() - clientStart;
            // Got any response — server is reachable from the browser
            set({
              status: 'connected',
              latency: clientLatency,
              lastTested: Date.now(),
              errorMessage: null,
              wasConnected: true,
            });

            // Still do server-side test to discover the API path
            try {
              const res = await fetch('/api/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, apiKey, modelName }),
              });
              const data = await safeJsonParse(res);
              if (data.success && data.resolvedUrl) {
                set({ resolvedUrl: data.resolvedUrl });
              }
            } catch {
              // Server-side discovery failed, but client-side works
            }

            return true;
          } catch {
            // Client-side test failed — fall through to server-side test
          }
        }

        // Server-side test (with auto-discovery)
        try {
          const start = Date.now();
          const res = await fetch('/api/test-connection', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, apiKey, modelName }),
          });

          const latency = Date.now() - start;
          const data = await safeJsonParse(res);

          if (data.success) {
            const updates: Partial<ApiConfig> = {
              status: 'connected',
              latency,
              lastTested: Date.now(),
              errorMessage: null,
              wasConnected: true,
            };

            // Store the discovered URL if found
            if (data.resolvedUrl) {
              updates.resolvedUrl = data.resolvedUrl;
            }

            // Auto-save the detected model name if user hasn't set one
            if (data.detectedModel && !get().modelName?.trim()) {
              updates.modelName = data.detectedModel;
              console.log(`[testConnection] Auto-detected model: ${data.detectedModel}`);
            }

            set(updates);
            return true;
          } else {
            set({
              status: 'error',
              latency,
              lastTested: Date.now(),
              errorMessage: data.error || 'Connection failed',
            });
            return false;
          }
        } catch (error: any) {
          set({
            status: 'error',
            errorMessage: error.message || 'Network error',
            lastTested: Date.now(),
          });
          return false;
        }
      },

      saveAndConnect: () => {
        const { mode, baseUrl, customUrl } = get();
        const url = mode === 'custom' ? customUrl : baseUrl;
        // Update connection type — persist middleware handles saving
        set({ connectionType: detectConnectionType(url) });

        // Sync server URL to Capacitor API routing (for APK mode)
        if (isCapacitorNative() && url) {
          import('./capacitor-api').then(({ setCapacitorServerUrl }) => {
            setCapacitorServerUrl(url);
            console.log(`[ApiConfig] Synced server URL to Capacitor API: ${url}`);
          }).catch(() => {});
        }
      },

      reset: () => {
        set(defaultConfig);
      },
    }),
    {
      name: STORAGE_KEY,
      // Only persist these fields (not transient state like 'testing' status)
      partialize: (state) => ({
        mode: state.mode,
        provider: state.provider,
        baseUrl: state.baseUrl,
        customUrl: state.customUrl,
        resolvedUrl: state.resolvedUrl,
        modelName: state.modelName,
        apiKey: state.apiKey,
        lastTested: state.lastTested,
        latency: state.latency,
        connectionType: state.connectionType,
        wasConnected: state.wasConnected,
      }),
      // On rehydration, restore 'connected' status if wasConnected is true
      onRehydrateStorage: () => (state) => {
        if (state && state.wasConnected) {
          const url = state.mode === 'custom' ? state.customUrl : state.baseUrl;
          if (url) {
            state.status = 'connected';
            state.errorMessage = null;
          }
        }
      },
    }
  )
);
