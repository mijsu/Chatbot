'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Mic, VolumeX, MessageSquare, Sparkles, AlertCircle, MicOff } from 'lucide-react';
import AudioReactiveOrb from '@/components/ui/audio-reactive-orb';
import { useAudioAnalyser } from '@/hooks/use-audio-analyser';
import { useAI } from '@/hooks/use-ai';
import { useOfflineTasks, useOfflineReminders, useOfflineProfile, useOfflineSettings, useOfflineGoals, useOfflineHabits, useOfflineMoods } from '@/hooks/use-offline-data';
import { formatTime12 } from '@/lib/offline-db';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendMessage?: (message: string) => void;
}

// ─── Voice Exchange type for conversation ───

interface VoiceExchange {
  id: string;
  userText: string;
  aiText: string;
  timestamp: number;
  type: 'chat' | 'task' | 'reminder' | 'plan' | 'image';
}

/* ─── State Machine (Gemini Live / Siri style)
   idle → listening → processing → responding → listening (loop)
     ↑                                        │
     └── user closes or taps idle ─────────────┘
   NO manual review step — auto-send after transcription
*/

type VoicePhase = 'idle' | 'listening' | 'processing' | 'responding';

/* ─── Voice Command Detection ─── */

type VoiceCommandType = 'task' | 'reminder' | 'image' | 'plan' | 'chat';

function detectVoiceCommand(transcript: string): { type: VoiceCommandType; description: string } {
  const lower = transcript.toLowerCase().trim();

  const planPatterns = [
    /^\s*(plan|create a plan|make a plan|make plans|create plan|prepare a plan|prepare plans|build a plan|generate a plan)\b/i,
    /\bplan\s+(my|for|the|tomorrow|today|this|next|me)\b/i,
    /\bmake\s+me\s+plans?\b/i,
    /\b(create|make|prepare|build|generate)\s+.*\b(plans?|schedule|itinerary|timetable)\b/i,
    /\b(plan my day|plan my week|plan my schedule|plan for tomorrow|plan for today|plan for next)\b/i,
    /\bschedule\s+(my|the|our)\s+(day|week|morning|afternoon|evening|schedule|time)\b/i,
    /\borganize\s+(my|the|our)\s+(day|week|morning|afternoon|evening|schedule|time)\b/i,
    /\b(i want|i need|i'd like)\s+(a\s+)?(plan|schedule|itinerary)\b/i,
    /\badd\s+.*\bto\s+(my\s+)?plan\b/i,
    /\bfor\s+my\s+plan\b/i,
    /\btime[- ]?block/i,
    /\b(can you|could you|would you|will you|please|i want you to|i'd like you to|help me)\s+.*\b(plan|schedule|organize)\b/i,
    /\bprepare\s+.*\bplans?\b/i,
  ];
  for (const pattern of planPatterns) {
    if (lower.match(pattern)) return { type: 'plan', description: transcript };
  }

  const reminderPatterns = [
    /^\s*(remind me to|remind me|set a reminder|create a reminder|create reminder|set reminder|add a reminder|add reminder|remind)\b/i,
    /\bremind\s+me\b/i,
    /\b(set|create|add|make)\s+(a\s+)?reminder\b/i,
    /\b(set me a reminder|give me a reminder|i need a reminder)\b/i,
    /\bdon'?t\s+(forget|let me forget)\b/i,
    /\b(can you|could you|would you|please|i want you to|help me)\s+.*\b(remind|reminder)\b/i,
  ];
  for (const pattern of reminderPatterns) {
    if (lower.match(pattern)) return { type: 'reminder', description: transcript };
  }

  const taskPatterns = [
    /^\s*(create a task|add a task|new task|create task|add task|make a task|make me a task)\b/i,
    /\b(create a task|add a task|new task|create task|add task|make a task)\b/i,
    /\badd\s+(those|these|them|it)\s+to\s+(my\s+)?tasks?\b/i,
    /\bi\s+(need|have)\s+to\b/i,
    /^\s*i\s+should\s+/i,
    /\b(can you|could you|would you|please|i want you to|help me)\s+.*\b(tasks?)\b/i,
    /\bsuggestions?\s+for\s+.*\btasks?\b/i,
  ];
  for (const pattern of taskPatterns) {
    if (lower.match(pattern)) return { type: 'task', description: transcript };
  }

  const imagePatterns = [
    /^\s*(generate an image|create an image|draw|generate image|create image|make an image|draw me)\b/i,
    /\b(generate an image|create an image|generate image|create image|make an image)\b/i,
    /\bdraw\s+me\b/i,
    /\b(can you|could you|would you|please|i want you to|help me)\s+.*\b(image|picture|photo|drawing|illustration)\b/i,
  ];
  for (const pattern of imagePatterns) {
    if (lower.match(pattern)) return { type: 'image', description: transcript };
  }

  return { type: 'chat', description: transcript };
}

/* ─── Get best supported mimeType for MediaRecorder ─── */

function getSupportedMimeType(): { mimeType: string; extension: string } {
  const types = [
    { mimeType: 'audio/webm;codecs=opus', extension: 'webm' },
    { mimeType: 'audio/webm', extension: 'webm' },
    { mimeType: 'audio/ogg;codecs=opus', extension: 'ogg' },
    { mimeType: 'audio/mp4', extension: 'mp4' },
    { mimeType: 'audio/mpeg', extension: 'mp3' },
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t.mimeType)) {
      return t;
    }
  }
  return { mimeType: '', extension: 'webm' };
}

const MAX_RECORDING_SECONDS = 30;
const SILENCE_THRESHOLD = 0.015; // RMS threshold for silence detection
const SILENCE_DURATION_MS = 2000; // Auto-stop after 2s of silence
const MIN_RECORDING_MS = 800; // Minimum recording time before silence detection kicks in

/* ─── Time-aware suggestions ─── */

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getSuggestions(): string[] {
  const hour = new Date().getHours();
  const suggestions: string[] = [];

  if (hour < 12) {
    suggestions.push('Plan my day');
    suggestions.push('What should I focus on?');
  } else if (hour < 17) {
    suggestions.push('Help me stay productive');
    suggestions.push('Remind me to take a break');
  } else {
    suggestions.push('Wind down my day');
    suggestions.push('Plan for tomorrow');
  }

  suggestions.push('Set a reminder');
  return suggestions;
}

/* ═══════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════ */

export default function VoiceModal({ isOpen, onClose, onSendMessage }: VoiceModalProps) {
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [transcript, setTranscript] = useState('');
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<'error' | 'info'>('info');
  const [commandLabel, setCommandLabel] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [conversation, setConversation] = useState<VoiceExchange[]>([]);
  const [liveTranscript, setLiveTranscript] = useState(''); // Shows current user speech as subtitle

  const currentAudioUrlRef = useRef<string | null>(null);
  const { getEndpoint, getModelName, getApiKey } = useAI();
  const { tasks: allTasks, addTask: addOfflineTask } = useOfflineTasks();
  const { reminders: allReminders, addReminder: addOfflineReminder } = useOfflineReminders();
  const { profile } = useOfflineProfile();
  const { settings } = useOfflineSettings();
  const { goals } = useOfflineGoals();
  const { habits } = useOfflineHabits();
  const { moods } = useOfflineMoods();
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mimeTypeRef = useRef(getSupportedMimeType());
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const silenceCheckRef = useRef<number>(0);
  const recordingStartRef = useRef<number>(0);

  const {
    frequencyData,
    connectExternalStream,
    disconnectExternalStream,
    connectAudioElement,
    disconnectAudio,
    error: audioError,
  } = useAudioAnalyser(256);

  // Pre-load browser voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      const handleVoicesChanged = () => {};
      window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      };
    }
  }, []);

  // Entrance animation
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => setModalVisible(true));
    } else {
      setModalVisible(false);
    }
  }, [isOpen]);

  const clearTimers = useCallback(() => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (silenceCheckRef.current) {
      cancelAnimationFrame(silenceCheckRef.current);
      silenceCheckRef.current = 0;
    }
  }, []);

  const handleClose = useCallback(() => {
    setModalVisible(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    disconnectExternalStream();
    disconnectAudio();
    clearTimers();
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }
    setPhase('idle');
    setTranscript('');
    setStatusText('');
    setStatusType('info');
    setCommandLabel('');
    setRecordingStartTime(0);
    setConversation([]);
    setLiveTranscript('');
    setTimeout(() => {
      onClose();
    }, 300);
  }, [disconnectExternalStream, disconnectAudio, clearTimers, onClose]);

  /* ─── Silence Detection (VAD) ─── */

  const startSilenceDetection = useCallback((stream: MediaStream) => {
    try {
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Float32Array(analyser.fftSize);
      let silenceStart = 0;
      recordingStartRef.current = Date.now();

      const checkSilence = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getFloatTimeDomainData(dataArray);

        // Calculate RMS
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        const now = Date.now();
        const recordingDuration = now - recordingStartRef.current;
        const minDurationPassed = recordingDuration > MIN_RECORDING_MS;

        if (rms < SILENCE_THRESHOLD && minDurationPassed) {
          if (silenceStart === 0) {
            silenceStart = now;
          }
          if (now - silenceStart > SILENCE_DURATION_MS) {
            // Silence detected — auto-stop
            silenceStart = 0;
            handleStopListeningRef.current();
            return;
          }
        } else {
          silenceStart = 0;
        }

        silenceCheckRef.current = requestAnimationFrame(checkSilence);
      };

      silenceCheckRef.current = requestAnimationFrame(checkSilence);
    } catch {
      // Silently fail — user can still manually tap to stop
    }
  }, []);

  const handleStartListening = useCallback(async () => {
    setTranscript('');
    setStatusText('');
    setStatusType('info');
    setCommandLabel('');
    setLiveTranscript('');
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      connectExternalStream(stream);

      const { mimeType } = mimeTypeRef.current;
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = () => {
        setStatusText('Recording failed. Please try again.');
        setStatusType('error');
        setPhase('idle');
        clearTimers();
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(500);

      setPhase('listening');
      setRecordingStartTime(Date.now());

      // Start silence detection
      startSilenceDetection(stream);

      // Hard limit: auto-stop at 30s
      autoStopTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          handleStopListeningRef.current();
        }
      }, MAX_RECORDING_SECONDS * 1000);

    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setStatusText('Microphone access denied. Allow mic permission and try again.');
        setStatusType('error');
      } else if (err.name === 'NotFoundError') {
        setStatusText('No microphone found. Please connect a microphone.');
        setStatusType('error');
      } else if (err.name === 'NotReadableError') {
        setStatusText('Microphone is being used by another app. Close it and try again.');
        setStatusType('error');
      } else {
        setStatusText('Could not access microphone. Please check your device.');
        setStatusType('error');
      }
      setPhase('idle');
    }
  }, [connectExternalStream, clearTimers, startSilenceDetection]);

  /* ─── Build Rich Context ─── */

  const buildRichContext = useCallback(() => {
    const today = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    const todayMood = moods.find(m => m.date === today);

    const userContext = {
      name: profile.name || 'User',
      aboutMe: profile.aboutMe || '',
      role: settings.role || '',
      interests: settings.interests || '',
      activeGoals: goals.filter(g => !g.completed).map(g => g.title),
      todayHabits: habits.map(h => ({
        title: h.title,
        streak: h.streak,
        done: h.lastCompletedDate === today,
      })),
      mood: todayMood?.mood,
      energy: todayMood?.energy,
    };

    const todayTasks = allTasks.filter(t => t.date === today && !t.completed);
    const activeReminders = allReminders.filter(r => !r.completed);
    const timeOfDay = new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening';

    const systemContext = [
      `Current date: ${today} (${timeOfDay})`,
      todayTasks.length > 0 ? `Today's pending tasks: ${todayTasks.map(t => `${t.title}${t.time ? ` at ${formatTime12(t.time)}` : ''}`).join(', ')}` : 'No pending tasks today.',
      activeReminders.length > 0 ? `Active reminders: ${activeReminders.slice(0, 5).map(r => `${r.title}${r.time ? ` at ${formatTime12(r.time)}` : ''}`).join(', ')}` : 'No active reminders.',
    ].join('\n');

    const voiceTone = settings.voiceTone || 'friendly';

    return { userContext, systemContext, voiceTone, today };
  }, [profile, settings, goals, habits, moods, allTasks, allReminders]);

  /* ─── Browser Speech Fallback ─── */

  const speakWithBrowserFallback = useCallback((text: string) => {
    try {
      if (!('speechSynthesis' in window)) {
        setPhase('idle');
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const trySetVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find(v =>
          v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('samantha') || v.name.toLowerCase().includes('google'))
        ) || voices.find(v =>
          v.lang.startsWith('en') && !v.localService
        ) || voices.find(v =>
          v.lang.startsWith('en')
        );
        if (preferredVoice) utterance.voice = preferredVoice;
      };
      trySetVoice();

      utterance.onend = () => {
        // After speaking, auto-listen again for continuous conversation (Gemini Live style)
        setPhase('idle');
      };
      utterance.onerror = () => {
        setPhase('idle');
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      setPhase('idle');
    }
  }, []);

  /* ─── Text-to-Speech ─── */

  const speakText = useCallback(async (text: string) => {
    setPhase('responding');

    const cleanText = text
      .replace(/[#*_~`>\[\]()]/g, '')
      .replace(/\n+/g, '. ')
      .trim()
      .substring(0, 1024);

    if (!cleanText) {
      setPhase('idle');
      return;
    }

    const endpoint = getEndpoint();
    if (!endpoint) {
      speakWithBrowserFallback(cleanText);
      return;
    }

    try {
      const res = await fetch('/api/voice/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'tongtong', speed: 1.0, customEndpoint: endpoint, modelName: getModelName(), apiKey: getApiKey() }),
      });

      if (!res.ok) throw new Error('TTS API failed');

      const audioBlob = await res.blob();

      if (audioBlob.size < 100 || !audioBlob.type.startsWith('audio/')) {
        throw new Error('Invalid audio response');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      currentAudioUrlRef.current = audioUrl;
      const audio = new Audio(audioUrl);
      audioPlayerRef.current = audio;
      connectAudioElement(audio);

      audio.onended = () => {
        disconnectAudio();
        URL.revokeObjectURL(audioUrl);
        currentAudioUrlRef.current = null;
        audioPlayerRef.current = null;
        // After speaking, go back to idle (Gemini Live style — user taps to continue)
        setPhase('idle');
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        currentAudioUrlRef.current = null;
        audioPlayerRef.current = null;
        disconnectAudio();
        speakWithBrowserFallback(cleanText);
      };

      await audio.play();
    } catch {
      speakWithBrowserFallback(cleanText);
    }
  }, [connectAudioElement, disconnectAudio, getEndpoint, getModelName, getApiKey, speakWithBrowserFallback]);

  /* ─── Process Voice Input (auto-called after transcription) ─── */

  const processVoiceInput = useCallback(async (text: string, commandType?: VoiceCommandType) => {
    const command = commandType
      ? { type: commandType, description: text }
      : detectVoiceCommand(text);

    setPhase('processing');
    const typeLabels: Record<VoiceCommandType, string> = {
      task: 'Creating task...',
      reminder: 'Setting reminder...',
      image: 'Generating image...',
      plan: 'Planning...',
      chat: 'Thinking...',
    };
    setCommandLabel(typeLabels[command.type]);

    try {
      let aiResponseText = '';

      switch (command.type) {
        case 'task': {
          const { userContext, systemContext, today } = buildRichContext();
          const enrichedDescription = systemContext
            ? `[Current situation]\n${systemContext}\n\n[Task request] ${command.description}`
            : command.description;
          const parseRes = await fetch('/api/ai/task-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: enrichedDescription,
              date: today,
              customEndpoint: getEndpoint(),
              modelName: getModelName(),
              apiKey: getApiKey(),
              userContext,
            }),
          });
          if (!parseRes.ok) throw new Error('AI parsing failed');
          const parseData = await parseRes.json();
          const parsed = parseData.task;
          if (!parsed || typeof parsed !== 'object') throw new Error('AI returned invalid task data');

          const taskTitle = parsed.title || 'New Task';
          await addOfflineTask({
            title: taskTitle,
            description: parsed.description || '',
            time: parsed.time || '',
            location: parsed.location || '',
            participants: parsed.participants || '',
            category: parsed.category || 'general',
            priority: 'medium',
            completed: false,
            date: parsed.date || today,
          });

          aiResponseText = `Task created: ${taskTitle}${parsed.time ? ' at ' + formatTime12(parsed.time) : ''}`;
          break;
        }

        case 'reminder': {
          const { userContext, systemContext } = buildRichContext();
          const enrichedDescription = systemContext
            ? `[Current situation]\n${systemContext}\n\n[Reminder request] ${command.description}`
            : command.description;
          const parseRes = await fetch('/api/ai/reminder-create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              description: enrichedDescription,
              customEndpoint: getEndpoint(),
              modelName: getModelName(),
              apiKey: getApiKey(),
              userContext,
            }),
          });
          if (!parseRes.ok) throw new Error('AI parsing failed');
          const parseData = await parseRes.json();
          const parsed = parseData.reminder;
          if (!parsed || typeof parsed !== 'object') throw new Error('AI returned invalid reminder data');

          const reminderTitle = parsed.title || 'New Reminder';
          await addOfflineReminder({
            title: reminderTitle,
            description: parsed.description || '',
            time: parsed.time || '',
            icon: parsed.icon || 'bell',
            recurring: parsed.recurring || '',
            recurringEndDate: parsed.recurringEndDate || '',
            completed: false,
          });

          aiResponseText = `Reminder set: ${reminderTitle}${parsed.time ? ' at ' + formatTime12(parsed.time) : ''}`;
          break;
        }

        case 'image': {
          const genRes = await fetch('/api/ai/generate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: command.description, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
          });
          if (!genRes.ok) throw new Error('Image generation failed');

          aiResponseText = 'Image generated! Check your chat.';
          break;
        }

        case 'plan': {
          const { userContext, systemContext, today } = buildRichContext();
          const enrichedRequest = systemContext
            ? `[Current situation]\n${systemContext}\n\n[Planning request] ${command.description}`
            : command.description;
          const planRes = await fetch('/api/ai/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request: enrichedRequest,
              date: today,
              customEndpoint: getEndpoint(),
              modelName: getModelName(),
              apiKey: getApiKey(),
              userContext,
            }),
          });
          if (!planRes.ok) throw new Error('Plan generation failed');
          const planData = await planRes.json();
          const plan = planData.plan;

          if (Array.isArray(plan)) {
            for (const item of plan) {
              await addOfflineTask({
                title: item.title || 'Planned activity',
                description: item.description || '',
                time: item.time || '',
                location: '',
                participants: '',
                category: item.category || 'general',
                priority: 'medium',
                completed: false,
                date: today,
              });
            }
          }

          aiResponseText = Array.isArray(plan) && plan.length > 0
            ? `Day planned with ${plan.length} activities, starting at ${formatTime12(plan[0].time) || 'now'}`
            : 'Day plan created!';
          break;
        }

        case 'chat':
        default: {
          const { userContext, systemContext, voiceTone } = buildRichContext();
          const chatMessages = [
            { role: 'user' as const, content: text },
          ];
          const chatRes = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: chatMessages,
              userContext,
              voiceTone,
              customEndpoint: getEndpoint(),
              modelName: getModelName(),
              apiKey: getApiKey(),
            }),
          });
          if (!chatRes.ok) throw new Error('Chat API failed');
          const chatData = await chatRes.json();
          aiResponseText = chatData.response || 'I couldn\'t generate a response. Please try again.';
          break;
        }
      }

      // Add to conversation thread
      const newExchange: VoiceExchange = {
        id: Date.now().toString(),
        userText: text,
        aiText: aiResponseText,
        timestamp: Date.now(),
        type: command.type,
      };
      setConversation(prev => [...prev, newExchange]);
      setCommandLabel('');

      // Always speak the response with TTS
      await speakText(aiResponseText);

    } catch {
      setPhase('idle');
      setCommandLabel('');
      setStatusText('Something went wrong. Please try again.');
      setStatusType('error');
    }
  }, [addOfflineTask, addOfflineReminder, buildRichContext, speakText, getEndpoint, getModelName, getApiKey]);

  /* ─── Ref to latest processVoiceInput ─── */

  const processVoiceInputRef = useRef(processVoiceInput);
  useEffect(() => {
    processVoiceInputRef.current = processVoiceInput;
  }, [processVoiceInput]);

  /* ─── Handle Stop Listening ─── */

  const handleStopListening = useCallback(() => {
    setPhase('processing'); // Show thinking while transcribing
    clearTimers();
    disconnectExternalStream();

    // Clean up VAD audio context
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
      analyserRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') {
      setPhase('idle');
      setStatusText('No recording found. Try again.');
      setStatusType('error');
      return;
    }

    const { extension } = mimeTypeRef.current;

    recorder.onstop = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      const mimeTypeMap: Record<string, string> = { mp4: 'audio/mp4', ogg: 'audio/ogg', webm: 'audio/webm', mp3: 'audio/mpeg' };
      const blob = new Blob(chunksRef.current, { type: mimeTypeMap[extension] || 'audio/webm' });
      chunksRef.current = [];
      mediaRecorderRef.current = null;

      if (blob.size < 100) {
        setPhase('idle');
        setStatusText('Recording too short. Please try again.');
        setStatusType('error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const res = await fetch('/api/voice/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, format: extension, customEndpoint: getEndpoint(), modelName: getModelName(), apiKey: getApiKey() }),
          });
          if (!res.ok) {
            setPhase('idle');
            setStatusText('Transcription service unavailable. Please try again.');
            setStatusType('error');
            return;
          }
          const data = await res.json();
          if (data.success && data.text?.trim()) {
            const text = data.text.trim();
            setTranscript(text);
            setLiveTranscript(text);
            // AUTO-SEND — no review step! Like Siri/Gemini
            processVoiceInputRef.current(text);
          } else {
            setPhase('idle');
            setStatusText("Couldn't understand that. Please try speaking clearly.");
            setStatusType('error');
          }
        } catch {
          setPhase('idle');
          setStatusText('Transcription failed. Check your connection.');
          setStatusType('error');
        }
      };
      reader.readAsDataURL(blob);
    };

    recorder.stop();
  }, [disconnectExternalStream, clearTimers, getEndpoint, getModelName, getApiKey]);

  const handleStopListeningRef = useRef(handleStopListening);
  useEffect(() => { handleStopListeningRef.current = handleStopListening; }, [handleStopListening]);

  /* ─── Handle Stop Speaking ─── */

  const handleStopSpeaking = useCallback(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    disconnectAudio();
    setPhase('idle');
  }, [disconnectAudio]);

  /* ─── Continue in Chat ─── */

  const handleContinueInChat = useCallback(() => {
    if (onSendMessage && conversation.length > 0) {
      onSendMessage(conversation[conversation.length - 1].userText);
    }
    handleClose();
  }, [onSendMessage, conversation, handleClose]);

  /* ─── Handle suggestion click ─── */

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setTranscript(suggestion);
    setLiveTranscript(suggestion);
    // Auto-send suggestions too — no review step
    processVoiceInputRef.current(suggestion);
  }, []);

  /* ─── Keyboard shortcuts ─── */

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  /* ─── Cleanup ─── */

  useEffect(() => {
    return () => {
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
      if (currentAudioUrlRef.current) URL.revokeObjectURL(currentAudioUrlRef.current);
      clearTimers();
    };
  }, [clearTimers]);

  /* ═══════════════════════════════════════════════════════════════
     VISUAL CONFIG
     ═══════════════════════════════════════════════════════════════ */

  // SiriOrb colors per phase — vibrant, premium palette
  const orbColors = (() => {
    switch (phase) {
      case 'listening':
        return {
          bg: 'oklch(8% 0.02 240)',
          c1: 'oklch(78% 0.22 185)',
          c2: 'oklch(74% 0.18 220)',
          c3: 'oklch(76% 0.14 260)',
        };
      case 'processing':
        return {
          bg: 'oklch(8% 0.02 260)',
          c1: 'oklch(75% 0.20 260)',
          c2: 'oklch(72% 0.16 290)',
          c3: 'oklch(74% 0.14 320)',
        };
      case 'responding':
        return {
          bg: 'oklch(8% 0.02 350)',
          c1: 'oklch(78% 0.22 25)',
          c2: 'oklch(74% 0.18 350)',
          c3: 'oklch(76% 0.14 15)',
        };
      default: // idle
        return {
          bg: 'oklch(12% 0.02 264)',
          c1: 'oklch(68% 0.12 350)',
          c2: 'oklch(72% 0.10 200)',
          c3: 'oklch(70% 0.11 280)',
        };
    }
  })();

  // Status text per phase
  const getStatusLabel = (): string => {
    switch (phase) {
      case 'listening': return 'Listening...';
      case 'processing': return commandLabel || 'Thinking...';
      case 'responding': return 'Speaking';
      default: return '';
    }
  };

  // Dynamic orb size — larger for visual impact
  const orbSize = phase === 'idle' && conversation.length === 0 ? 220 : 180;
  const orbSizePx = `${orbSize}px`;

  // Last AI response for display
  const lastAiText = conversation.length > 0 ? conversation[conversation.length - 1].aiText : '';
  const lastUserText = conversation.length > 0 ? conversation[conversation.length - 1].userText : '';

  // Current subtitle text (what to show below the orb)
  const subtitleText = (() => {
    if (phase === 'listening') return ''; // No subtitle while listening — orb is the feedback
    if (phase === 'processing') return transcript || '';
    if (phase === 'responding') return lastAiText;
    if (phase === 'idle' && conversation.length > 0) return lastAiText;
    return '';
  })();

  if (!isOpen) return null;

  /* ═══════════════════════════════════════════════════════════════
     RENDER — Premium Gemini Live / Siri style voice assistant
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: modalVisible ? 'rgba(0, 0, 0, 0.97)' : 'rgba(0, 0, 0, 0)',
        transition: 'background 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
      onClick={handleClose}
    >
      <div
        className="relative flex flex-col items-center w-full h-full max-w-lg overflow-hidden"
        style={{
          opacity: modalVisible ? 1 : 0,
          transform: modalVisible ? 'scale(1)' : 'scale(0.96)',
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ══════════════════════════════════════════════
           AMBIENT BACKGROUND — Phase-responsive gradient
           ══════════════════════════════════════════════ */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: (() => {
              switch (phase) {
                case 'listening':
                  return 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(6, 215, 215, 0.10) 0%, rgba(6, 180, 200, 0.04) 40%, transparent 70%)';
                case 'processing':
                  return 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(100, 130, 255, 0.10) 0%, rgba(80, 100, 220, 0.04) 40%, transparent 70%)';
                case 'responding':
                  return 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(255, 120, 80, 0.08) 0%, rgba(255, 80, 50, 0.03) 40%, transparent 70%)';
                default:
                  return 'radial-gradient(ellipse 90% 70% at 50% 40%, rgba(200, 200, 220, 0.04) 0%, transparent 70%)';
              }
            })(),
            transition: 'background 1s ease',
          }}
        />

        {/* ══════════════════════════════════════════════
           TOP BAR — Minimal chrome (close + chat)
           ══════════════════════════════════════════════ */}
        <div className="relative z-10 w-full flex items-center justify-between px-6" style={{ paddingTop: 'max(env(safe-area-inset-top), 20px)' }}>
          {/* Continue in Chat — left */}
          <div style={{ minWidth: '72px' }}>
            {conversation.length > 0 && (
              <button
                onClick={handleContinueInChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all duration-300"
                style={{
                  color: 'rgba(255,255,255,0.4)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: '12px',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                }}
              >
                <MessageSquare className="w-3.5 h-3.5" strokeWidth={1.5} />
                Chat
              </button>
            )}
          </div>

          {/* Center: Status label */}
          <div className="flex items-center justify-center">
            <p
              className="transition-all duration-500"
              style={{
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: phase === 'listening'
                  ? 'rgba(6, 215, 215, 0.7)'
                  : phase === 'responding'
                    ? 'rgba(255, 140, 100, 0.7)'
                    : phase === 'processing'
                      ? 'rgba(140, 160, 255, 0.7)'
                      : 'rgba(255,255,255,0.25)',
                opacity: getStatusLabel() ? 1 : 0,
                transform: getStatusLabel() ? 'translateY(0)' : 'translateY(4px)',
              }}
            >
              {getStatusLabel()}
            </p>
          </div>

          {/* Close — right */}
          <div className="flex justify-end" style={{ minWidth: '72px' }}>
            <button
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                color: 'rgba(255,255,255,0.35)',
                background: 'rgba(255,255,255,0.05)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.9)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
              aria-label="Close"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
           CENTER — Orb + Subtitle
           ══════════════════════════════════════════════ */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 w-full" style={{ minHeight: 0 }}>

          {/* ── Voice Orb ── */}
          <div
            className="flex-shrink-0 flex items-center justify-center"
            style={{
              transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <AudioReactiveOrb
              size={orbSizePx}
              phase={phase}
              frequencyData={frequencyData}
              colors={orbColors}
            />
          </div>

          {/* ── Greeting (idle, no conversation yet) ── */}
          {phase === 'idle' && conversation.length === 0 && (
            <div className="mt-8 text-center" style={{ transition: 'all 0.5s ease' }}>
              <h2
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.9)',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.3,
                }}
              >
                {getGreeting()}
              </h2>
              <p
                className="mt-2"
                style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.3)',
                  fontWeight: 400,
                }}
              >
                Tap the mic to start
              </p>
            </div>
          )}

          {/* ── Subtitle text (Gemini Live style — appears below orb) ── */}
          {subtitleText && phase !== 'idle' && (
            <div
              className="mt-6 text-center max-w-[85%]"
              style={{
                animation: 'fade-in-text 0.4s ease forwards',
              }}
            >
              {/* User transcript shown above AI response during responding */}
              {phase === 'responding' && lastUserText && (
                <p
                  className="mb-2"
                  style={{
                    fontSize: '13px',
                    fontWeight: 400,
                    color: 'rgba(255,255,255,0.3)',
                    lineHeight: 1.4,
                  }}
                >
                  {lastUserText.length > 80 ? lastUserText.substring(0, 80) + '...' : lastUserText}
                </p>
              )}
              <p
                style={{
                  fontSize: phase === 'responding' ? '17px' : '15px',
                  fontWeight: phase === 'responding' ? 500 : 400,
                  color: phase === 'responding'
                    ? 'rgba(255,255,255,0.8)'
                    : 'rgba(255,255,255,0.5)',
                  lineHeight: 1.5,
                }}
              >
                {subtitleText.length > 200 ? subtitleText.substring(0, 200) + '...' : subtitleText}
              </p>
            </div>
          )}

          {/* ── Idle with conversation — show last AI response ── */}
          {phase === 'idle' && conversation.length > 0 && (
            <div
              className="mt-6 text-center max-w-[85%]"
              style={{
                animation: 'fade-in-text 0.4s ease forwards',
              }}
            >
              <p
                style={{
                  fontSize: '17px',
                  fontWeight: 500,
                  color: 'rgba(255,255,255,0.75)',
                  lineHeight: 1.5,
                }}
              >
                {lastAiText.length > 160 ? lastAiText.substring(0, 160) + '...' : lastAiText}
              </p>
              <p
                className="mt-3"
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.25)',
                }}
              >
                Tap to continue
              </p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════
           ERROR MESSAGES
           ══════════════════════════════════════════════ */}
        {statusText && (
          <div
            className="relative z-10 mx-6 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
            style={{
              color: statusType === 'error' ? 'rgba(255, 100, 100, 0.9)' : 'rgba(255,255,255,0.6)',
              background: statusType === 'error' ? 'rgba(255, 50, 50, 0.08)' : 'rgba(255,255,255,0.04)',
              border: statusType === 'error' ? '1px solid rgba(255, 50, 50, 0.12)' : '1px solid rgba(255,255,255,0.06)',
              fontSize: '13px',
            }}
          >
            {statusType === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />}
            {statusText}
          </div>
        )}

        {audioError && phase === 'idle' && (
          <div
            className="relative z-10 mx-6 mb-2 flex items-center gap-2 px-4 py-2.5 rounded-2xl"
            style={{
              color: 'rgba(255, 100, 100, 0.9)',
              background: 'rgba(255, 50, 50, 0.08)',
              border: '1px solid rgba(255, 50, 50, 0.12)',
              fontSize: '13px',
            }}
          >
            <MicOff className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            {audioError}
          </div>
        )}

        {/* ══════════════════════════════════════════════
           BOTTOM — Mic Button + Suggestions
           ══════════════════════════════════════════════ */}
        <div
          className="relative z-10 w-full px-6"
          style={{
            paddingBottom: 'max(env(safe-area-inset-bottom), 28px)',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* ── Suggestion chips (idle, no conversation yet) ── */}
          {phase === 'idle' && conversation.length === 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
              {getSuggestions().map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="px-4 py-2 rounded-full transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.4)',
                    fontSize: '13px',
                    fontWeight: 400,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                  }}
                >
                  <Sparkles className="w-3 h-3 inline-block mr-1.5 opacity-40" strokeWidth={1.5} />
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* ── Main action button ── */}
          <div className="flex items-center justify-center">
            {phase === 'idle' && (
              <button
                onClick={handleStartListening}
                className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-400 cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.8)',
                  boxShadow: '0 0 40px rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                  e.currentTarget.style.transform = 'scale(1.06)';
                  e.currentTarget.style.boxShadow = '0 0 60px rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 40px rgba(255,255,255,0.04)';
                }}
                aria-label="Start listening"
              >
                <Mic className="w-7 h-7" strokeWidth={1.5} />
              </button>
            )}

            {phase === 'listening' && (
              <button
                onClick={handleStopListening}
                className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer"
                style={{
                  background: 'rgba(6, 215, 215, 0.15)',
                  border: '2px solid rgba(6, 215, 215, 0.4)',
                  color: 'rgba(6, 215, 215, 0.9)',
                  boxShadow: '0 0 40px rgba(6, 215, 215, 0.1)',
                }}
                aria-label="Stop listening"
              >
                <Mic className="w-7 h-7" strokeWidth={1.5} />
                {/* Animated pulse rings */}
                <div
                  className="absolute inset-[-8px] rounded-full pointer-events-none"
                  style={{
                    border: '1.5px solid rgba(6, 215, 215, 0.2)',
                    animation: 'pulse-ring 2s ease-out infinite',
                  }}
                />
                <div
                  className="absolute inset-[-16px] rounded-full pointer-events-none"
                  style={{
                    border: '1px solid rgba(6, 215, 215, 0.1)',
                    animation: 'pulse-ring 2s ease-out 0.5s infinite',
                  }}
                />
              </button>
            )}

            {phase === 'responding' && (
              <button
                onClick={handleStopSpeaking}
                className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer"
                style={{
                  background: 'rgba(255, 120, 80, 0.12)',
                  border: '2px solid rgba(255, 120, 80, 0.25)',
                  color: 'rgba(255, 120, 80, 0.8)',
                }}
                aria-label="Stop speaking"
              >
                <VolumeX className="w-7 h-7" strokeWidth={1.5} />
              </button>
            )}

            {phase === 'processing' && (
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{
                  background: 'rgba(140, 160, 255, 0.1)',
                  border: '2px solid rgba(140, 160, 255, 0.2)',
                }}
              >
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    border: '2px solid rgba(140, 160, 255, 0.3)',
                    borderTopColor: 'rgba(140, 160, 255, 0.8)',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════
         GLOBAL ANIMATIONS
         ══════════════════════════════════════════════ */}
      <style>{`
        @keyframes pulse-ring {
          0% {
            transform: scale(1);
            opacity: 1;
          }
          100% {
            transform: scale(1.6);
            opacity: 0;
          }
        }

        @keyframes fade-in-text {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
