'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Link2,
  Cloud,
  Anchor,
  Home,
  Monitor,
  Globe,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Search,
  Key,
  ArrowRight,
  Copy,
  RefreshCw,
  Unplug,
  Wifi,
  WifiOff,
  Server,
  ChevronDown,
  Box,
} from 'lucide-react';
import { DotmTriangle11 } from '@/components/ui/dotm-triangle-11';
import {
  useApiConfig,
  validateUrl,
  detectConnectionType,
  PROVIDER_PRESETS,
  getProviderPreset,
  type ApiProvider,
} from '@/lib/api-config';

const typeConfig: Record<string, { icon: any; label: string; color: string }> = {
  cloudflare: { icon: Cloud, label: 'Cloudflare', color: '#FB923C' },
  ngrok: { icon: Anchor, label: 'Ngrok', color: '#F7931A' },
  local: { icon: Home, label: 'Local Network', color: '#FFD600' },
  localhost: { icon: Monitor, label: 'Localhost', color: '#FFD600' },
  server: { icon: Server, label: 'Syntra Server', color: '#A78BFA' },
  custom: { icon: Globe, label: 'Custom', color: '#94A3B8' },
};

const exampleServerUrls = [
  { label: 'Cloudflare', url: 'https://xxx.trycloudflare.com' },
  { label: 'Ngrok', url: 'https://abc123.ngrok-free.app' },
  { label: 'LM Studio', url: 'http://localhost:1234' },
  { label: 'Ollama', url: 'http://localhost:11434' },
  { label: 'Local IP', url: 'http://192.168.1.100:8080' },
];

export default function ApiConnectionSettings() {
  const {
    mode,
    provider,
    baseUrl,
    customUrl,
    resolvedUrl,
    modelName,
    apiKey,
    status,
    lastTested,
    latency,
    connectionType,
    errorMessage,
    setMode,
    setProvider,
    setBaseUrl,
    setCustomUrl,
    setModelName,
    setApiKey,
    testConnection,
    saveAndConnect,
    initialize,
    reset,
  } = useApiConfig();

  const [showApiKey, setShowApiKey] = useState(false);
  const [justConnected, setJustConnected] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const autoTestTimer = useRef<NodeJS.Timeout | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const detectedType = (mode === 'custom' ? customUrl : baseUrl) ? detectConnectionType(mode === 'custom' ? customUrl : baseUrl) : null;
  const typeInfo = detectedType ? typeConfig[detectedType] : null;

  // The actual endpoint URL being used for AI calls
  const activeUrl = resolvedUrl || (mode === 'custom' ? customUrl : baseUrl);

  // Current provider preset
  const currentPreset = getProviderPreset(provider);

  // Auto-test connection when URL changes (with debounce)
  const handleUrlChange = useCallback((url: string, isCustom: boolean) => {
    if (isCustom) {
      setCustomUrl(url);
    } else {
      setBaseUrl(url);
    }
    setJustConnected(false);

    if (autoTestTimer.current) {
      clearTimeout(autoTestTimer.current);
    }

    if (url && url.trim()) {
      const validation = validateUrl(url);
      if (validation.valid) {
        autoTestTimer.current = setTimeout(async () => {
          setJustConnected(true);
          await testConnection();
        }, 1500);
      }
    }

    return () => {
      if (autoTestTimer.current) {
        clearTimeout(autoTestTimer.current);
      }
    };
  }, [setCustomUrl, setBaseUrl, testConnection]);

  const handleManualTest = async () => {
    setJustConnected(true);
    await testConnection();
  };

  const handleSaveAndConnect = () => {
    const url = mode === 'custom' ? customUrl : baseUrl;
    const validation = validateUrl(url);
    if (!validation.valid) {
      useApiConfig.getState().setStatus('error', validation.error);
      return;
    }
    saveAndConnect();
    testConnection();
    setJustConnected(true);
  };

  const handleExampleClick = (url: string) => {
    setCustomUrl(url);
    setTimeout(async () => {
      setJustConnected(true);
      await testConnection();
    }, 500);
  };

  const handleProviderSelect = (p: ApiProvider) => {
    setProvider(p);
  };

  const handleModelSelect = (model: string) => {
    setModelName(model);
    setShowModelDropdown(false);
  };

  const handleDisconnect = () => {
    reset();
    setJustConnected(false);
  };

  const handleCopyEndpoint = () => {
    if (activeUrl) {
      navigator.clipboard.writeText(activeUrl).catch(() => {});
    }
  };

  // Close model dropdown on outside click
  useEffect(() => {
    if (!showModelDropdown) return;
    const handler = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showModelDropdown]);

  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    color: 'var(--nd-text-secondary)',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--nd-black)',
    border: '1px solid var(--nd-border)',
    borderRadius: '8px',
    color: 'var(--nd-text-primary)',
    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
    fontSize: '13px',
  };

  return (
    <div className="space-y-2">
      {/* ── Active Connection Banner ── */}
      <div
        className="p-3"
        style={{
          background: status === 'connected'
            ? 'rgba(74, 158, 92, 0.06)'
            : status === 'error'
              ? 'rgba(215, 25, 33, 0.06)'
              : 'var(--nd-surface)',
          border: `1px solid ${status === 'connected'
            ? 'rgba(74, 158, 92, 0.15)'
            : status === 'error'
              ? 'rgba(215, 25, 33, 0.15)'
              : 'var(--nd-border)'}`,
          borderRadius: '12px',
        }}
      >
        <div className="flex items-center gap-2.5">
          {/* Status icon */}
          <div className="relative flex items-center justify-center flex-shrink-0">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                border: `1px solid ${status === 'connected'
                  ? 'var(--nd-success)'
                  : status === 'error'
                    ? 'var(--nd-accent)'
                    : 'var(--nd-border-visible)'}`,
                background: 'transparent',
              }}
            >
              {status === 'connected' ? (
                <Wifi className="w-3.5 h-3.5" style={{ color: 'var(--nd-success)', strokeWidth: 1.5 }} />
              ) : status === 'error' ? (
                <WifiOff className="w-3.5 h-3.5" style={{ color: 'var(--nd-accent)', strokeWidth: 1.5 }} />
              ) : status === 'testing' ? (
                <DotmTriangle11 size={14} color="var(--nd-text-primary)" speed={2} />
              ) : (
                <Unplug className="w-3.5 h-3.5" style={{ color: 'var(--nd-text-disabled)', strokeWidth: 1.5 }} />
              )}
            </div>
          </div>

          {/* Connection info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p style={{ color: 'var(--nd-text-primary)', fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {status === 'connected' ? 'CONNECTED' : status === 'testing' ? 'CONNECTING...' : status === 'error' ? 'CONNECTION FAILED' : mode === 'custom' ? 'CUSTOM SERVER' : currentPreset?.label?.toUpperCase() || 'API CONFIG'}
              </p>
              {latency !== null && status === 'connected' && (
                <span
                  style={{
                    color: 'var(--nd-success)',
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.04em',
                    padding: '1px 6px',
                    background: 'rgba(74, 158, 92, 0.1)',
                    borderRadius: '4px',
                  }}
                >
                  {latency}ms
                </span>
              )}
              {typeInfo && mode === 'custom' && (
                <span
                  style={{
                    color: typeInfo.color,
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.04em',
                    padding: '1px 6px',
                    background: `${typeInfo.color}15`,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <typeInfo.icon className="w-2.5 h-2.5" strokeWidth={1.5} />
                  {typeInfo.label.toUpperCase()}
                </span>
              )}
            </div>

            {activeUrl ? (
              <p
                className="text-[11px] mt-0.5 truncate"
                style={{
                  color: status === 'connected' ? 'var(--nd-success)' : status === 'error' ? 'var(--nd-accent)' : 'var(--nd-text-secondary)',
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                  fontSize: '10px',
                }}
                title={activeUrl}
              >
                {activeUrl}
              </p>
            ) : (
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--nd-text-disabled)' }}>
                {mode === 'custom' ? 'Paste a server URL below to connect' : 'Select a provider and configure your API'}
              </p>
            )}
          </div>

          {/* Quick actions for connected state */}
          {status === 'connected' && activeUrl && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={handleCopyEndpoint}
                className="p-1.5 transition-colors"
                style={{ borderRadius: '6px', border: '1px solid var(--nd-border)', background: 'transparent' }}
                title="Copy endpoint URL"
              >
                <Copy className="w-3 h-3" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              </button>
              <button
                onClick={handleManualTest}
                className="p-1.5 transition-colors"
                style={{ borderRadius: '6px', border: '1px solid var(--nd-border)', background: 'transparent' }}
                title="Re-test connection"
              >
                <RefreshCw className="w-3 h-3" style={{ color: 'var(--nd-text-secondary)', strokeWidth: 1.5 }} />
              </button>
            </div>
          )}
        </div>

        {/* Error message inline */}
        {errorMessage && (
          <div
            className="flex items-start gap-2 text-xs px-3 py-2 mt-2"
            style={{ color: 'var(--nd-accent)', background: 'rgba(215, 25, 33, 0.06)', border: '1px solid rgba(215, 25, 33, 0.1)', borderRadius: '8px' }}
          >
            <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
            <span style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px' }}>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* ── Mode Toggle ── */}
      <div
        className="p-3 space-y-2.5"
        style={{
          background: 'var(--nd-surface)',
          border: '1px solid var(--nd-border)',
          borderRadius: '12px',
        }}
      >
        <div className="flex gap-2">
          <ModeButton
            active={mode === 'default'}
            onClick={() => setMode('default')}
            label="DEFAULT"
            description="API Provider"
            icon={Zap}
          />
          <ModeButton
            active={mode === 'custom'}
            onClick={() => setMode('custom')}
            label="CUSTOM"
            description="Your own server"
            icon={Server}
          />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DEFAULT MODE — API Provider Configuration
          ══════════════════════════════════════════════════════════════ */}
      {mode === 'default' && (
        <div
          className="p-3 space-y-3"
          style={{
            background: 'var(--nd-surface)',
            border: '1px solid var(--nd-border)',
            borderRadius: '12px',
          }}
        >
          {/* Provider Selection */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <label style={labelStyle}>
                Provider
              </label>
              <span
                style={{
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                  fontSize: '9px',
                  letterSpacing: '0.06em',
                  color: 'var(--nd-text-disabled)',
                  padding: '1px 6px',
                  background: 'var(--nd-surface-raised)',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '4px',
                }}
              >
                OPENAI-COMPATIBLE ONLY
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {PROVIDER_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleProviderSelect(p.id)}
                  className="px-2 py-2 text-center transition-all duration-150"
                  style={{
                    background: provider === p.id ? 'var(--nd-text-display)' : 'var(--nd-black)',
                    border: `1px solid ${provider === p.id ? 'var(--nd-text-display)' : 'var(--nd-border)'}`,
                    borderRadius: '6px',
                    color: provider === p.id ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.04em',
                  }}
                >
                  {p.label.toUpperCase()}
                </button>
              ))}
            </div>
            {/* Deprecation notice for persisted Anthropic config */}
            {provider === 'anthropic' && (
              <div
                className="flex items-start gap-2 text-xs px-3 py-2 mt-2"
                style={{ color: 'var(--nd-accent)', background: 'rgba(215, 25, 33, 0.06)', border: '1px solid rgba(215, 25, 25, 0.1)', borderRadius: '8px' }}
              >
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                <span style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px' }}>
                  Anthropic is no longer supported — its API format is incompatible. Use an OpenAI-compatible proxy (e.g., litellm, openrouter.ai) to connect to Claude models, then select &quot;Other / Custom&quot; above.
                </span>
              </div>
            )}
          </div>

          {/* Base URL Input (auto-filled from provider, but editable) */}
          <div>
            <label className="block mb-1.5" style={labelStyle}>
              Base URL
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <input
                type="url"
                placeholder="https://api.openai.com"
                value={baseUrl}
                onChange={(e) => handleUrlChange(e.target.value, false)}
                className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border)';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveAndConnect();
                  }
                }}
              />
              {status === 'testing' && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <DotmTriangle11 size={12} color="var(--nd-text-primary)" speed={2} />
                </div>
              )}
            </div>
            <p className="mt-1.5" style={{ ...labelStyle, fontSize: '10px', color: 'var(--nd-text-disabled)' }}>
              Auto-filled from provider. Edit for custom endpoints.
            </p>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block mb-1.5" style={labelStyle}>
              API Key
              {currentPreset?.requiresApiKey && (
                <span style={{ color: 'var(--nd-accent)', textTransform: 'none', letterSpacing: '0.02em', marginLeft: '6px' }}>
                  (required)
                </span>
              )}
              {!currentPreset?.requiresApiKey && (
                <span style={{ color: 'var(--nd-text-disabled)', textTransform: 'none', letterSpacing: '0.02em', marginLeft: '6px' }}>
                  (optional)
                </span>
              )}
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                <Key className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder={currentPreset?.apiKeyPlaceholder || 'your-api-key'}
                value={apiKey || ''}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full pl-9 pr-20 py-2.5 text-sm focus:outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border)';
                }}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 transition-colors"
                style={{
                  color: 'var(--nd-text-secondary)',
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                  fontSize: '9px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '4px',
                  background: 'transparent',
                }}
              >
                {showApiKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <p className="mt-1.5" style={{ ...labelStyle, fontSize: '10px', color: 'var(--nd-text-disabled)' }}>
              {currentPreset?.requiresApiKey
                ? `Required for ${currentPreset.label}. ${currentPreset.apiKeyPrefix ? `Starts with ${currentPreset.apiKeyPrefix}` : ''}`
                : 'Some providers don\'t require an API key.'}
            </p>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block mb-1.5" style={labelStyle}>
              Model
              <span style={{ color: 'var(--nd-text-disabled)', textTransform: 'none', letterSpacing: '0.02em', marginLeft: '6px' }}>
                (auto-detected if empty)
              </span>
            </label>
            <div className="relative" ref={modelDropdownRef}>
              <div
                className="relative"
              >
                <div
                  className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
                  style={{ color: 'var(--nd-text-disabled)' }}
                >
                  <Box className="w-3.5 h-3.5" strokeWidth={1.5} />
                </div>
                <button
                  onClick={() => {
                    if (currentPreset?.models && currentPreset.models.length > 0) {
                      setShowModelDropdown(!showModelDropdown);
                    }
                  }}
                  className="w-full pl-9 pr-9 py-2.5 text-sm text-left focus:outline-none transition-colors"
                  style={{
                    ...inputStyle,
                    cursor: currentPreset?.models?.length ? 'pointer' : 'text',
                  }}
                >
                  {modelName || 'Select or type a model name'}
                </button>
                {currentPreset?.models && currentPreset.models.length > 0 && (
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center"
                    style={{ color: 'var(--nd-text-disabled)' }}
                  >
                    <ChevronDown className="w-3.5 h-3.5" strokeWidth={1.5} />
                  </div>
                )}
              </div>

              {/* Model dropdown */}
              {showModelDropdown && currentPreset?.models && (
                <div
                  className="absolute z-50 left-0 right-0 mt-1 py-1 max-h-48 overflow-y-auto"
                  style={{
                    background: 'var(--nd-surface)',
                    border: '1px solid var(--nd-border-visible)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  }}
                >
                  {/* Custom model input at top */}
                  <div className="px-2 py-1.5">
                    <input
                      type="text"
                      placeholder="Type custom model name..."
                      value={modelName}
                      onChange={(e) => {
                        setModelName(e.target.value);
                      }}
                      className="w-full px-2 py-1.5 text-sm focus:outline-none"
                      style={{
                        background: 'var(--nd-black)',
                        border: '1px solid var(--nd-border)',
                        borderRadius: '4px',
                        color: 'var(--nd-text-primary)',
                        fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                        fontSize: '11px',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          setShowModelDropdown(false);
                        }
                      }}
                    />
                  </div>
                  <div style={{ borderTop: '1px solid var(--nd-border)', margin: '0 8px' }} />
                  {currentPreset.models.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleModelSelect(m)}
                      className="w-full px-3 py-2 text-left transition-colors"
                      style={{
                        color: modelName === m ? 'var(--nd-text-display)' : 'var(--nd-text-secondary)',
                        background: modelName === m ? 'var(--nd-surface-raised)' : 'transparent',
                        fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                        fontSize: '11px',
                        letterSpacing: '0.02em',
                      }}
                      onMouseEnter={(e) => {
                        if (modelName !== m) {
                          (e.currentTarget as HTMLElement).style.background = 'var(--nd-surface-raised)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (modelName !== m) {
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1.5" style={{ ...labelStyle, fontSize: '10px', color: 'var(--nd-text-disabled)' }}>
              {currentPreset?.models?.length
                ? `Choose from ${currentPreset.label} models or type a custom name.`
                : 'Enter the model name for your API provider.'}
            </p>
          </div>

          {/* Resolved URL indicator */}
          {resolvedUrl && status === 'connected' && resolvedUrl !== baseUrl && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2"
              style={{ color: 'var(--nd-success)', background: 'rgba(74, 158, 92, 0.08)', border: '1px solid rgba(74, 158, 92, 0.15)', borderRadius: '8px' }}
            >
              <Search className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--nd-success)' }} strokeWidth={1.5} />
              <div>
                <p style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  AUTO-DISCOVERED ENDPOINT
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '11px',
                    wordBreak: 'break-all',
                    color: 'var(--nd-success)',
                  }}
                >
                  {resolvedUrl}
                </p>
              </div>
            </div>
          )}

          {/* Active model indicator */}
          {modelName && status === 'connected' && (
            <div
              className="flex items-center gap-2 text-xs px-3 py-2"
              style={{ color: 'var(--nd-success)', background: 'rgba(74, 158, 92, 0.08)', border: '1px solid rgba(74, 158, 92, 0.15)', borderRadius: '8px' }}
            >
              <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--nd-success)' }} strokeWidth={1.5} />
              <span style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.06em' }}>
                ACTIVE MODEL: {modelName}
              </span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={handleManualTest}
              disabled={!baseUrl || status === 'testing'}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
                color: 'var(--nd-text-primary)',
                fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                minHeight: '34px',
              }}
            >
              {status === 'testing' ? (
                <DotmTriangle11 size={14} color="var(--nd-text-primary)" speed={2} />
              ) : (
                <Search className="w-3 h-3" strokeWidth={1.5} />
              )}
              {status === 'testing' ? 'TESTING...' : 'TEST'}
            </button>
            <button
              onClick={handleSaveAndConnect}
              disabled={!baseUrl}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--nd-text-display)',
                border: 'none',
                borderRadius: '999px',
                color: 'var(--nd-black)',
                fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                minHeight: '34px',
              }}
            >
              <Zap className="w-3 h-3" strokeWidth={1.5} />
              SAVE & CONNECT
            </button>
          </div>

          {/* Disconnect button when connected */}
          {status === 'connected' && (
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--nd-border)',
                borderRadius: '999px',
                color: 'var(--nd-text-secondary)',
                fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--nd-accent)';
                e.currentTarget.style.color = 'var(--nd-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--nd-border)';
                e.currentTarget.style.color = 'var(--nd-text-secondary)';
              }}
            >
              <Unplug className="w-3 h-3" strokeWidth={1.5} />
              DISCONNECT
            </button>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          CUSTOM MODE — Your Own Server (URL + Model, auto-discovery)
          ══════════════════════════════════════════════════════════════ */}
      {mode === 'custom' && (
        <div
          className="p-3 space-y-3"
          style={{
            background: 'var(--nd-surface)',
            border: '1px solid var(--nd-border)',
            borderRadius: '12px',
          }}
        >
          {/* URL Input */}
          <div>
            <label className="block mb-1.5" style={labelStyle}>
              Server URL
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                <Link2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <input
                type="url"
                placeholder="Paste your server URL here..."
                value={customUrl}
                onChange={(e) => handleUrlChange(e.target.value, true)}
                className="w-full pl-9 pr-20 py-2.5 text-sm focus:outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border)';
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSaveAndConnect();
                  }
                }}
              />
              {/* Right side badges */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {typeInfo && (
                  <div
                    className="flex items-center gap-1 px-1.5 py-0.5"
                    style={{
                      background: 'var(--nd-surface-raised)',
                      border: '1px solid var(--nd-border-visible)',
                      borderRadius: '4px',
                      color: typeInfo.color,
                      fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                      fontSize: '9px',
                      letterSpacing: '0.06em',
                    }}
                  >
                    <typeInfo.icon className="w-2.5 h-2.5" strokeWidth={1.5} />
                    {typeInfo.label.toUpperCase()}
                  </div>
                )}
                {status === 'testing' && (
                  <DotmTriangle11 size={12} color="var(--nd-text-primary)" speed={2} />
                )}
              </div>
            </div>
            <p className="mt-1.5" style={{ ...labelStyle, fontSize: '10px', color: 'var(--nd-text-disabled)' }}>
              Paste the base URL — auto-discovers the API path. Press Enter to connect.
            </p>
          </div>

          {/* API Key Input (optional for custom servers) */}
          <div>
            <label className="block mb-1.5" style={labelStyle}>
              API Key
              <span style={{ color: 'var(--nd-text-disabled)', textTransform: 'none', letterSpacing: '0.02em', marginLeft: '6px' }}>
                (optional)
              </span>
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                <Key className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                placeholder="Leave blank if not needed"
                value={apiKey || ''}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full pl-9 pr-20 py-2.5 text-sm focus:outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border)';
                }}
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs px-2 py-1 transition-colors"
                style={{
                  color: 'var(--nd-text-secondary)',
                  fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                  fontSize: '9px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  border: '1px solid var(--nd-border)',
                  borderRadius: '4px',
                  background: 'transparent',
                }}
              >
                {showApiKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <p className="mt-1.5" style={{ ...labelStyle, fontSize: '10px', color: 'var(--nd-text-disabled)' }}>
              Local servers usually don&apos;t need one.
            </p>
          </div>

          {/* Model Name Input */}
          <div>
            <label className="block mb-1.5" style={labelStyle}>
              Model Name
              <span style={{ color: 'var(--nd-text-disabled)', textTransform: 'none', letterSpacing: '0.02em', marginLeft: '6px' }}>
                (auto-detected if empty)
              </span>
            </label>
            <div className="relative">
              <div
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center"
                style={{ color: 'var(--nd-text-disabled)' }}
              >
                <Box className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
              <input
                type="text"
                placeholder="e.g. Gemma-4-E4B-it, llama3, mistral"
                value={modelName || ''}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm focus:outline-none transition-colors"
                style={inputStyle}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--nd-border)';
                }}
              />
            </div>
            <p className="mt-1.5" style={{ ...labelStyle, fontSize: '10px', color: 'var(--nd-text-disabled)' }}>
              Required by LM Studio, Ollama, etc. Leave empty to auto-detect.
            </p>
          </div>

          {/* Server Mode indicator — when connected to a Syntra server */}
          {connectionType === 'server' && status === 'connected' && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2"
              style={{ color: '#A78BFA', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.15)', borderRadius: '8px' }}
            >
              <Server className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#A78BFA' }} strokeWidth={1.5} />
              <div>
                <p style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  SERVER MODE — BUILT-IN AI
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '10px',
                    color: 'var(--nd-text-secondary)',
                  }}
                >
                  Connected to Syntra server. AI is powered by the server&apos;s built-in engine.
                </p>
              </div>
            </div>
          )}

          {/* Resolved URL indicator */}
          {resolvedUrl && status === 'connected' && resolvedUrl !== customUrl && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2"
              style={{ color: 'var(--nd-success)', background: 'rgba(74, 158, 92, 0.08)', border: '1px solid rgba(74, 158, 92, 0.15)', borderRadius: '8px' }}
            >
              <Search className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--nd-success)' }} strokeWidth={1.5} />
              <div>
                <p style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>
                  AUTO-DISCOVERED ENDPOINT
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '11px',
                    wordBreak: 'break-all',
                    color: 'var(--nd-success)',
                  }}
                >
                  {resolvedUrl}
                </p>
              </div>
            </div>
          )}

          {/* Auto-detected model indicator */}
          {modelName && status === 'connected' && (
            <div
              className="flex items-center gap-2 text-xs px-3 py-2"
              style={{ color: 'var(--nd-success)', background: 'rgba(74, 158, 92, 0.08)', border: '1px solid rgba(74, 158, 92, 0.15)', borderRadius: '8px' }}
            >
              <Zap className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--nd-success)' }} strokeWidth={1.5} />
              <span style={{ fontFamily: "var(--font-space-mono), 'Space Mono', monospace", fontSize: '10px', letterSpacing: '0.06em' }}>
                ACTIVE MODEL: {modelName}
              </span>
            </div>
          )}

          {/* Quick examples */}
          <div>
            <p className="mb-1.5" style={labelStyle}>Quick connect</p>
            <div className="flex flex-wrap gap-1.5">
              {exampleServerUrls.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => handleExampleClick(ex.url)}
                  className="px-2.5 py-1.5 transition-colors flex items-center gap-1.5"
                  style={{
                    color: 'var(--nd-text-secondary)',
                    background: 'var(--nd-black)',
                    border: '1px solid var(--nd-border)',
                    borderRadius: '6px',
                    fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                    fontSize: '10px',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--nd-border-visible)';
                    e.currentTarget.style.color = 'var(--nd-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--nd-border)';
                    e.currentTarget.style.color = 'var(--nd-text-secondary)';
                  }}
                >
                  <ArrowRight className="w-2.5 h-2.5" strokeWidth={1.5} />
                  {ex.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5">
            <button
              onClick={handleManualTest}
              disabled={!customUrl || status === 'testing'}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--nd-border-visible)',
                borderRadius: '999px',
                color: 'var(--nd-text-primary)',
                fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                minHeight: '34px',
              }}
            >
              {status === 'testing' ? (
                <DotmTriangle11 size={14} color="var(--nd-text-primary)" speed={2} />
              ) : (
                <Search className="w-3 h-3" strokeWidth={1.5} />
              )}
              {status === 'testing' ? 'DISCOVERING...' : 'TEST & DISCOVER'}
            </button>
            <button
              onClick={handleSaveAndConnect}
              disabled={!customUrl}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-2 font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--nd-text-display)',
                border: 'none',
                borderRadius: '999px',
                color: 'var(--nd-black)',
                fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                minHeight: '34px',
              }}
            >
              <Zap className="w-3 h-3" strokeWidth={1.5} />
              SAVE & CONNECT
            </button>
          </div>

          {/* Contextual tips */}
          {customUrl && customUrl.startsWith('http://') && detectedType === 'custom' && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2"
              style={{ color: 'var(--nd-warning)', background: 'rgba(212, 168, 67, 0.08)', border: '1px solid rgba(212, 168, 67, 0.15)', borderRadius: '8px' }}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--nd-warning)' }} strokeWidth={1.5} />
              <span>HTTP for a remote URL is not secure. Consider HTTPS.</span>
            </div>
          )}

          {detectedType === 'local' && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2"
              style={{ color: 'var(--nd-success)', background: 'rgba(74, 158, 92, 0.08)', border: '1px solid rgba(74, 158, 92, 0.12)', borderRadius: '8px' }}
            >
              <Home className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--nd-success)' }} strokeWidth={1.5} />
              <span>Local network detected. Same WiFi required. Works with LM Studio, Ollama, and any OpenAI-compatible server.</span>
            </div>
          )}

          {detectedType === 'cloudflare' && (
            <div
              className="flex items-start gap-2 text-xs px-3 py-2"
              style={{ color: '#FB923C', background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.12)', borderRadius: '8px' }}
            >
              <Cloud className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FB923C' }} strokeWidth={1.5} />
              <span>Cloudflare Tunnel detected. We&apos;ll auto-discover the API path.</span>
            </div>
          )}

          {/* Disconnect button when connected */}
          {status === 'connected' && (
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid var(--nd-border)',
                borderRadius: '999px',
                color: 'var(--nd-text-secondary)',
                fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
                fontSize: '10px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--nd-accent)';
                e.currentTarget.style.color = 'var(--nd-accent)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--nd-border)';
                e.currentTarget.style.color = 'var(--nd-text-secondary)';
              }}
            >
              <Unplug className="w-3 h-3" strokeWidth={1.5} />
              DISCONNECT
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  description,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string; style?: any; strokeWidth?: number }>;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 p-2.5 text-left transition-all duration-200"
      style={{
        background: active ? 'var(--nd-text-display)' : 'var(--nd-black)',
        border: active ? '1px solid var(--nd-text-display)' : '1px solid var(--nd-border)',
        borderRadius: '8px',
      }}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className="w-3 h-3 flex items-center justify-center"
          style={{
            border: active ? '1.5px solid var(--nd-black)' : '1.5px solid var(--nd-text-disabled)',
            borderRadius: '999px',
          }}
        >
          {active && (
            <div
              className="w-1.5 h-1.5"
              style={{ background: 'var(--nd-black)', borderRadius: '999px' }}
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Icon
            className="w-3 h-3"
            style={{ color: active ? 'var(--nd-black)' : 'var(--nd-text-secondary)', strokeWidth: 1.5 }}
          />
          <p
            style={{
              color: active ? 'var(--nd-black)' : 'var(--nd-text-secondary)',
              fontFamily: "var(--font-space-mono), 'Space Mono', monospace",
              fontSize: '10px',
              letterSpacing: '0.06em',
              fontWeight: 500,
            }}
          >
            {label}
          </p>
        </div>
      </div>
      <p className="text-[10px] ml-4.5 pl-0.5" style={{ color: active ? 'var(--nd-border-visible)' : 'var(--nd-text-disabled)' }}>
        {description}
      </p>
    </button>
  );
}
