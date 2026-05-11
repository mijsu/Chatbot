'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * Hook for real-time audio frequency analysis using Web Audio API.
 * Supports both microphone input (for listening) and audio element output (for speaking).
 * Also supports connecting an external stream (shared mic stream) to avoid double mic access.
 */

interface AudioAnalyserResult {
  frequencyData: Float32Array | null;
  isListening: boolean;
  isPlaying: boolean;
  startListening: () => Promise<void>;
  stopListening: () => void;
  /** Connect an external MediaStream (e.g. from getUserMedia) to the analyser.
   *  This avoids creating a second mic stream — use when the caller already has a stream. */
  connectExternalStream: (stream: MediaStream) => void;
  disconnectExternalStream: () => void;
  connectAudioElement: (element: HTMLAudioElement) => void;
  disconnectAudio: () => void;
  error: string | null;
}

export function useAudioAnalyser(fftSize: number = 256): AudioAnalyserResult {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const externalSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [frequencyData, setFrequencyData] = useState<Float32Array | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const animFrameRef = useRef<number>(0);

  const getContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const getAnalyser = useCallback(() => {
    if (!analyserRef.current) {
      const ctx = getContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;
    }
    return analyserRef.current;
  }, [fftSize, getContext]);

  // Start polling frequency data
  const startPolling = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Float32Array(analyser.frequencyBinCount);

    const poll = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getFloatFrequencyData(data);

      // Normalize from dB (-100 to 0) → 0 to 1
      const normalized = new Float32Array(data.length);
      for (let i = 0; i < data.length; i++) {
        normalized[i] = Math.max(0, Math.min(1, (data[i] + 100) / 100));
      }
      setFrequencyData(normalized);
      animFrameRef.current = requestAnimationFrame(poll);
    };

    animFrameRef.current = requestAnimationFrame(poll);
  }, []);

  const stopPolling = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    setFrequencyData(null);
  }, []);

  // ─── Microphone (Listening) — creates its own stream ───

  const startListening = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const ctx = getContext();
      const analyser = getAnalyser();

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Don't connect analyser to destination to avoid feedback

      micStreamRef.current = stream;
      micSourceRef.current = source;
      setIsListening(true);
      startPolling();
    } catch (err: any) {
      const msg = err.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow microphone permissions.'
        : err.name === 'NotFoundError'
          ? 'No microphone found. Please connect a microphone.'
          : `Microphone error: ${err.message}`;
      setError(msg);
      setIsListening(false);
    }
  }, [getContext, getAnalyser, startPolling]);

  const stopListening = useCallback(() => {
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    setIsListening(false);
    stopPolling();
  }, [stopPolling]);

  // ─── External Stream (Listening) — uses a stream the caller already has ───

  const connectExternalStream = useCallback((stream: MediaStream) => {
    try {
      setError(null);
      const ctx = getContext();
      const analyser = getAnalyser();

      // Disconnect previous external source
      if (externalSourceRef.current) {
        externalSourceRef.current.disconnect();
      }

      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      // Don't connect analyser to destination to avoid feedback

      externalSourceRef.current = source;
      setIsListening(true);
      startPolling();
    } catch (err: any) {
      console.warn('External stream connection warning:', err.message);
      setError(`Audio analyser connection failed: ${err.message}`);
    }
  }, [getContext, getAnalyser, startPolling]);

  const disconnectExternalStream = useCallback(() => {
    if (externalSourceRef.current) {
      externalSourceRef.current.disconnect();
      externalSourceRef.current = null;
    }
    setIsListening(false);
    stopPolling();
  }, [stopPolling]);

  // ─── Audio Element (Speaking) ───

  const connectAudioElement = useCallback((element: HTMLAudioElement) => {
    const ctx = getContext();
    const analyser = getAnalyser();

    // Disconnect previous source
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
    }

    try {
      const source = ctx.createMediaElementSource(element);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      audioSourceRef.current = source;
      audioElementRef.current = element;
      setIsPlaying(true);
      startPolling();
    } catch (err: any) {
      // Element may already be connected
      console.warn('Audio element connection warning:', err.message);
      // Still mark as playing even if analyser can't connect
      setIsPlaying(true);
    }
  }, [getContext, getAnalyser, startPolling]);

  const disconnectAudio = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    analyserRef.current?.disconnect();
    audioElementRef.current = null;
    setIsPlaying(false);
    stopPolling();
  }, [stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
      disconnectAudio();
      disconnectExternalStream();
      cancelAnimationFrame(animFrameRef.current);
      if (analyserRef.current) {
        analyserRef.current.disconnect();
        analyserRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopListening, disconnectAudio, disconnectExternalStream]);

  return {
    frequencyData,
    isListening,
    isPlaying,
    startListening,
    stopListening,
    connectExternalStream,
    disconnectExternalStream,
    connectAudioElement,
    disconnectAudio,
    error,
  };
}
