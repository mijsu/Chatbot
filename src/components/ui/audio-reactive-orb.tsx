'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import SiriOrb from '@/components/ui/siri-orb';

type VoicePhase = 'idle' | 'listening' | 'processing' | 'responding';

interface AudioReactiveOrbProps {
  size: string;
  phase: VoicePhase;
  frequencyData: Float32Array | null;
  colors: { bg?: string; c1?: string; c2?: string; c3?: string };
  className?: string;
}

// ─── Phase-specific configuration ───────────────────────────────────────────
const PHASE_CONFIG: Record<
  VoicePhase,
  {
    baseDuration: number;
    breathSpeed: number;
    breathAmplitude: number;
    scaleAmplitude: number;
    glowBaseOpacity: number;
    glowAmplitude: number;
    ringBaseSpeed: number;
    ringAmplitudeMultiplier: number;
    ringMaxOpacity: number;
  }
> = {
  idle: {
    baseDuration: 24,
    breathSpeed: 2800,
    breathAmplitude: 0.03,
    scaleAmplitude: 0,
    glowBaseOpacity: 0.2,
    glowAmplitude: 0,
    ringBaseSpeed: 0,
    ringAmplitudeMultiplier: 0,
    ringMaxOpacity: 0,
  },
  listening: {
    baseDuration: 7,
    breathSpeed: 2000,
    breathAmplitude: 0.045,
    scaleAmplitude: 0.2,
    glowBaseOpacity: 0.5,
    glowAmplitude: 0.6,
    ringBaseSpeed: 0.35,
    ringAmplitudeMultiplier: 1.0,
    ringMaxOpacity: 0.65,
  },

  processing: {
    baseDuration: 5,
    breathSpeed: 1100,
    breathAmplitude: 0.05,
    scaleAmplitude: 0,
    glowBaseOpacity: 0.4,
    glowAmplitude: 0,
    ringBaseSpeed: 0.12,
    ringAmplitudeMultiplier: 0,
    ringMaxOpacity: 0.15,
  },
  responding: {
    baseDuration: 8,
    breathSpeed: 1400,
    breathAmplitude: 0.07,
    scaleAmplitude: 0.22,
    glowBaseOpacity: 0.55,
    glowAmplitude: 0.65,
    ringBaseSpeed: 0.4,
    ringAmplitudeMultiplier: 1.1,
    ringMaxOpacity: 0.7,
  },
};

// Ring glow colors per phase
const RING_STYLES: Record<VoicePhase, { border: string; glow: string }> = {
  idle: { border: 'rgba(200, 200, 200, 0.25)', glow: 'rgba(200, 200, 200, 0.08)' },
  listening: { border: 'rgba(6, 215, 215, 0.45)', glow: 'rgba(6, 215, 215, 0.15)' },

  processing: { border: 'rgba(52, 114, 188, 0.3)', glow: 'rgba(52, 114, 188, 0.1)' },
  responding: { border: 'rgba(255, 120, 80, 0.5)', glow: 'rgba(255, 100, 60, 0.18)' },
};

// Glow gradient per phase
const GLOW_GRADIENTS: Record<VoicePhase, string> = {
  idle: 'radial-gradient(circle, rgba(200,200,200,0.06) 0%, transparent 60%)',
  listening: 'radial-gradient(circle, rgba(6,215,215,0.15) 0%, rgba(52,114,188,0.05) 40%, transparent 70%)',

  processing: 'radial-gradient(circle, rgba(52,114,188,0.12) 0%, rgba(6,215,215,0.04) 40%, transparent 70%)',
  responding: 'radial-gradient(circle, rgba(255,120,80,0.18) 0%, rgba(255,80,40,0.06) 40%, transparent 70%)',
};

// ─── Constants ──────────────────────────────────────────────────────────────
const NUM_RINGS = 4;
const MAX_RING_EXPANSIONS = [0.35, 0.5, 0.6, 0.75]; // Inner → outer ring expansion
const LERP_SCALE = 0.13;
const LERP_GLOW = 0.09;
const LERP_RING_AMP = 0.18;
const LERP_DURATION = 0.03;
const DURATION_UPDATE_THRESHOLD = 1.2; // Seconds — only re-render SiriOrb if duration changes this much

export default function AudioReactiveOrb({
  size,
  phase,
  frequencyData,
  colors,
  className,
}: AudioReactiveOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const orbWrapperRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<(HTMLDivElement | null)[]>([]);
  const glowRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  // Track latest frequencyData via ref to avoid effect dependency
  const frequencyDataRef = useRef(frequencyData);

  // Track current phase via ref for the animation loop
  const phaseRef = useRef(phase);

  // Rendered animation duration for SiriOrb (only updates when change is significant)
  const [renderedDuration, setRenderedDuration] = useState(PHASE_CONFIG[phase].baseDuration);

  // ─── Mutable animation state (no re-renders) ───────────────────────────
  const animState = useRef({
    currentScale: 1,
    currentGlowOpacity: PHASE_CONFIG[phase].glowBaseOpacity,
    currentGlowScale: 1,
    smoothAmplitude: 0,
    smoothBandAmplitudes: new Float32Array(NUM_RINGS),
    dynamicDuration: PHASE_CONFIG[phase].baseDuration,
    lastRenderedDuration: PHASE_CONFIG[phase].baseDuration,
    lastTimestamp: 0,
    // Ring cycling phases (staggered offsets)
    ringPhases: new Float32Array([0, 0.25, 0.5, 0.75]),
    needsDurationReset: false,
  });

  // ─── Keep refs in sync with props (post-render) ────────────────────────
  useEffect(() => {
    frequencyDataRef.current = frequencyData;
  });

  useEffect(() => {
    phaseRef.current = phase;
    // Signal the animation loop that duration needs reset
    animState.current.needsDurationReset = true;
  }, [phase]);

  // ─── Initialize ring DOM properties ─────────────────────────────────────
  useEffect(() => {
    ringsRef.current.forEach((el) => {
      if (el) {
        el.style.opacity = '0';
        el.style.transform = 'scale(1)';
        el.style.willChange = 'transform, opacity, box-shadow';
      }
    });
    if (orbWrapperRef.current) {
      orbWrapperRef.current.style.willChange = 'transform';
    }
    if (glowRef.current) {
      glowRef.current.style.willChange = 'transform, opacity';
    }
  }, []);

  // ─── Compute amplitude from frequencyData ──────────────────────────────
  const computeAmplitude = useCallback(
    (data: Float32Array | null): { avg: number; bands: Float32Array } => {
      if (!data || data.length === 0) {
        return { avg: 0, bands: new Float32Array(NUM_RINGS) };
      }

      const len = data.length;
      let sum = 0;
      for (let i = 0; i < len; i++) {
        sum += data[i];
      }
      const avg = sum / len;

      // Split into frequency bands
      const bands = new Float32Array(NUM_RINGS);
      const bandSize = Math.floor(len / NUM_RINGS);
      for (let b = 0; b < NUM_RINGS; b++) {
        let bandSum = 0;
        const start = b * bandSize;
        const end = b === NUM_RINGS - 1 ? len : (b + 1) * bandSize;
        for (let i = start; i < end; i++) {
          bandSum += data[i];
        }
        bands[b] = bandSum / (end - start);
      }

      // Map bands to rings:
      // bands[0] = low freq → ring 3 (outermost, expands most)
      // bands[3] = high freq → ring 0 (innermost, expands least)
      const mapped = new Float32Array(NUM_RINGS);
      for (let i = 0; i < NUM_RINGS; i++) {
        mapped[i] = bands[NUM_RINGS - 1 - i];
      }

      return { avg, bands: mapped };
    },
    [],
  );

  // ─── Main animation loop ───────────────────────────────────────────────
  useEffect(() => {
    const state = animState.current;

    const animate = (timestamp: number) => {
      const dt = state.lastTimestamp
        ? Math.min((timestamp - state.lastTimestamp) / 1000, 0.1)
        : 0.016;
      state.lastTimestamp = timestamp;

      const currentPhase = phaseRef.current;
      const config = PHASE_CONFIG[currentPhase];

      // Handle phase transition — reset duration tracking
      if (state.needsDurationReset) {
        state.needsDurationReset = false;
        state.dynamicDuration = config.baseDuration;
        state.lastRenderedDuration = config.baseDuration;
        // Schedule a setState outside the animation frame
        setRenderedDuration(config.baseDuration);
      }
      const { avg: rawAmplitude, bands: rawBands } = computeAmplitude(
        frequencyDataRef.current,
      );

      // ── Simulated amplitude for phases with no real audio data ──────
      // When responding/listening but no frequencyData (e.g. browser SpeechSynthesis),
      // generate a speech-like pulsing pattern so the orb still animates
      let effectiveAmplitude = rawAmplitude;
      let effectiveBands = rawBands;
      const hasRealAudio = frequencyDataRef.current !== null && rawAmplitude > 0.005;

      if (!hasRealAudio && (currentPhase === 'responding' || currentPhase === 'listening')) {
        const t = timestamp / 1000;

        if (currentPhase === 'responding') {
          // ── Speech-like pulsing with syllable bursts ──
          // Simulates natural speech rhythm: bursts of energy (syllables)
          // separated by brief pauses, with varying intensity
          const syllableRate = 3.8; // ~3.8 syllables/sec (natural English)
          const syllablePhase = (t * syllableRate) % 1;
          // Syllable envelope: sharp attack, gradual decay
          const syllableEnvelope = Math.pow(Math.max(0, 1 - syllablePhase * 2.5), 1.5);
          // Add natural variation
          const variation =
            0.15 * Math.sin(t * 1.7 * Math.PI + 0.3) +
            0.10 * Math.sin(t * 0.8 * Math.PI + 1.1) +
            0.08 * Math.sin(t * 5.3 * Math.PI + 2.1);
          // Occasional pauses between phrases (every ~3-4 seconds)
          const phrasePause = Math.max(0, Math.sin(t * 0.6 * Math.PI) * 0.5 + 0.5);
          const speechLike = Math.max(0, Math.min(1,
            0.15 + syllableEnvelope * 0.55 * phrasePause + variation
          ));
          effectiveAmplitude = speechLike;

          // Band amplitudes — simulate frequency spread of speech
          effectiveBands = new Float32Array(NUM_RINGS);
          for (let i = 0; i < NUM_RINGS; i++) {
            const bandPhase = (t * syllableRate + i * 0.15) % 1;
            const bandEnvelope = Math.pow(Math.max(0, 1 - bandPhase * 2.2), 1.8);
            effectiveBands[i] = Math.max(0, Math.min(1,
              0.12 +
              bandEnvelope * 0.5 * phrasePause +
              0.12 * Math.sin(t * (3 + i * 1.5) * Math.PI + i * 0.9) +
              0.08 * Math.sin(t * (6 + i * 2.5) * Math.PI + i * 1.4)
            ));
          }
        } else {
          // Listening — mic input simulation
          const speechLike =
            0.22 +
            0.18 * Math.sin(t * 4.2 * Math.PI) +
            0.12 * Math.sin(t * 7.8 * Math.PI + 1.3) +
            0.08 * Math.sin(t * 12.1 * Math.PI + 2.7) +
            0.06 * Math.sin(t * 2.1 * Math.PI + 0.5);
          effectiveAmplitude = Math.max(0, Math.min(1, speechLike));

          effectiveBands = new Float32Array(NUM_RINGS);
          for (let i = 0; i < NUM_RINGS; i++) {
            effectiveBands[i] = Math.max(0, Math.min(1,
              0.18 +
              0.15 * Math.sin(t * (4 + i * 2) * Math.PI + i * 1.2) +
              0.10 * Math.sin(t * (8 + i * 3) * Math.PI + i * 0.8)
            ));
          }
        }
      }

      // ── Smooth amplitude values ──────────────────────────────────────
      state.smoothAmplitude +=
        (effectiveAmplitude - state.smoothAmplitude) * LERP_SCALE;
      for (let i = 0; i < NUM_RINGS; i++) {
        state.smoothBandAmplitudes[i] +=
          (effectiveBands[i] - state.smoothBandAmplitudes[i]) * LERP_RING_AMP;
      }

      // ── Compute target scale ─────────────────────────────────────────
      let targetScale: number;
      const audioScale = state.smoothAmplitude * config.scaleAmplitude;
      const breathValue = Math.sin(
        (timestamp / config.breathSpeed) * Math.PI * 2,
      );
      const breathScale = breathValue * config.breathAmplitude;

      // Audio takes priority; breathing fills in when audio is silent
      if (config.scaleAmplitude > 0) {
        targetScale = 1 + Math.max(audioScale, breathScale);
      } else if (config.breathAmplitude > 0) {
        targetScale = 1 + breathScale;
      } else {
        targetScale = 1;
      }

      // Lerp scale
      state.currentScale +=
        (targetScale - state.currentScale) * LERP_SCALE;

      // Apply scale to orb wrapper
      if (orbWrapperRef.current) {
        orbWrapperRef.current.style.transform = `scale(${state.currentScale})`;
      }

      // ── Compute and apply glow ──────────────────────────────────────
      const targetGlowOpacity =
        config.glowBaseOpacity + state.smoothAmplitude * config.glowAmplitude;
      state.currentGlowOpacity +=
        (targetGlowOpacity - state.currentGlowOpacity) * LERP_GLOW;

      const targetGlowScale = 1 + state.smoothAmplitude * 0.12;
      state.currentGlowScale +=
        (targetGlowScale - state.currentGlowScale) * LERP_GLOW;

      if (glowRef.current) {
        glowRef.current.style.opacity = String(state.currentGlowOpacity);
        glowRef.current.style.transform = `scale(${state.currentGlowScale})`;
      }

      // ── Update rings ────────────────────────────────────────────────
      const ringStyle = RING_STYLES[currentPhase];
      for (let i = 0; i < NUM_RINGS; i++) {
        const ringEl = ringsRef.current[i];
        if (!ringEl) continue;

        const bandAmp = state.smoothBandAmplitudes[i];

        if (config.ringBaseSpeed > 0 || config.ringMaxOpacity > 0) {
          // Advance ring cycling phase
          const speed =
            config.ringBaseSpeed +
            bandAmp * config.ringAmplitudeMultiplier;
          state.ringPhases[i] = (state.ringPhases[i] + dt * speed) % 1;

          const progress = state.ringPhases[i];
          const maxExpansion = MAX_RING_EXPANSIONS[i];
          const ringScale = 1 + progress * maxExpansion;

          // Opacity: fades quadratically as ring expands, intensity from band amplitude
          const fadeCurve = (1 - progress) * (1 - progress);
          const ringOpacity = bandAmp * fadeCurve * config.ringMaxOpacity;

          // Dynamic glow: brighter near origin, fades with expansion
          const glowIntensity = bandAmp * fadeCurve * 14;
          const glowSpread = glowIntensity * 0.35;

          ringEl.style.transform = `scale(${ringScale})`;
          ringEl.style.opacity = String(Math.max(0, Math.min(1, ringOpacity)));
          ringEl.style.boxShadow = `0 0 ${glowIntensity}px ${glowSpread}px ${ringStyle.glow}`;
          ringEl.style.borderColor = ringStyle.border;
        } else {
          // Phase doesn't use rings — fade them out smoothly
          const currentOpacity = parseFloat(ringEl.style.opacity || '0');
          const newOpacity = Math.max(0, currentOpacity - dt * 1.5);
          ringEl.style.opacity = String(newOpacity);

          // Also fade the glow
          if (currentOpacity > 0.01) {
            const glowIntensity = currentOpacity * 10;
            ringEl.style.boxShadow = `0 0 ${glowIntensity}px ${glowIntensity * 0.3}px ${ringStyle.glow}`;
          } else {
            ringEl.style.boxShadow = 'none';
          }
        }
      }

      // ── Compute dynamic SiriOrb duration ────────────────────────────
      // Faster rotation when amplitude is higher (up to 40% faster)
      const targetDuration =
        config.baseDuration * (1 - state.smoothAmplitude * 0.4);
      state.dynamicDuration +=
        (targetDuration - state.dynamicDuration) * LERP_DURATION;

      // Only trigger a re-render if the duration changed significantly
      if (
        Math.abs(state.dynamicDuration - state.lastRenderedDuration) >
        DURATION_UPDATE_THRESHOLD
      ) {
        state.lastRenderedDuration = state.dynamicDuration;
        setRenderedDuration(Math.max(2, Math.round(state.dynamicDuration * 10) / 10));
      }

      animFrameRef.current = requestAnimationFrame(animate);
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [computeAmplitude]);

  // ─── Ring style for current phase (for JSX) ───────────────────────────
  const ringStyle = RING_STYLES[phase];
  const glowGradient = GLOW_GRADIENTS[phase];

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: size, height: size }}
    >
      {/* Ambient glow */}
      <div
        ref={glowRef}
        style={{
          position: 'absolute',
          inset: '-40%',
          borderRadius: '50%',
          pointerEvents: 'none',
          background: glowGradient,
          transition: 'background 0.5s ease',
        }}
      />

      {/* Expanding wave rings */}
      {Array.from({ length: NUM_RINGS }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            ringsRef.current[i] = el;
          }}
          style={{
            position: 'absolute',
            inset: '0',
            borderRadius: '50%',
            pointerEvents: 'none',
            border: `1.5px solid ${ringStyle.border}`,
          }}
        />
      ))}

      {/* Orb wrapper — scale animated via ref */}
      <div
        ref={orbWrapperRef}
        style={{
          position: 'absolute',
          inset: 0,
        }}
      >
        <SiriOrb
          size={size}
          colors={colors}
          animationDuration={renderedDuration}
        />
      </div>
    </div>
  );
}
