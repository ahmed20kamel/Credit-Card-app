'use client';

/**
 * RealtimeVoice – OpenAI Realtime API via WebRTC
 * Browser ↔ OpenAI directly (ultra-low latency).
 * API key stays server-side; browser only receives a short-lived ephemeral token.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Loader2, X, Volume2 } from 'lucide-react';
import api from '@/app/api/client';
import { useTranslations } from '@/lib/i18n';

// ── Types ────────────────────────────────────────────────────────────────────

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

interface TranscriptLine {
  role: 'user' | 'assistant';
  text: string;
  id: number;
}

// ── Constant ─────────────────────────────────────────────────────────────────

const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RealtimeVoice() {
  const { locale } = useTranslations();

  const [isOpen, setIsOpen]             = useState(false);
  const [connState, setConnState]       = useState<ConnState>('idle');
  const [isMuted, setIsMuted]           = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [transcript, setTranscript]     = useState<TranscriptLine[]>([]);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const idCounter        = useRef(0);
  const pcRef            = useRef<RTCPeerConnection | null>(null);
  const dcRef            = useRef<RTCDataChannel | null>(null);
  const streamRef        = useRef<MediaStream | null>(null);

  const ar = (a: string, e: string) => (locale === 'ar' ? a : e);

  // ── Scroll transcript ──────────────────────────────────────────────────────

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current   = null;
    dcRef.current   = null;
    streamRef.current = null;
    setIsAISpeaking(false);
    setIsUserSpeaking(false);
    setIsMuted(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Realtime event handler (defined BEFORE connect to satisfy deps order) ──

  const handleRealtimeEvent = useCallback((ev: any) => {
    switch (ev.type) {

      case 'conversation.item.input_audio_transcription.completed':
        if (ev.transcript?.trim()) {
          setTranscript(p => [...p, {
            role: 'user',
            text: ev.transcript.trim(),
            id: ++idCounter.current,
          }]);
        }
        setIsUserSpeaking(false);
        break;

      case 'input_audio_buffer.speech_started':
        setIsUserSpeaking(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsUserSpeaking(false);
        break;

      case 'response.output_item.done':
        if (ev.item?.type === 'message' && ev.item?.role === 'assistant') {
          const text = (ev.item.content as any[])
            ?.filter(c => c.type === 'text' || c.type === 'audio')
            .map(c => c.transcript || c.text || '')
            .join(' ')
            .trim();
          if (text) {
            setTranscript(p => [...p, { role: 'assistant', text, id: ++idCounter.current }]);
          }
        }
        break;

      case 'response.audio.delta':
        setIsAISpeaking(true);
        break;

      case 'response.audio.done':
      case 'response.done':
        setIsAISpeaking(false);
        break;

      case 'error':
        setError(ev.error?.message || 'Realtime error');
        break;
    }
  }, []); // setState functions are stable – no extra deps needed

  // ── WebRTC connect ─────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setError(null);
    setConnState('connecting');
    setTranscript([]);

    try {
      // 1. Get ephemeral token from backend (real key stays server-side)
      const { data } = await api.post<{
        client_secret: string;
        expires_at?: number;
        model: string;
      }>('/realtime/session/');
      const { client_secret } = data;

      // 2. Microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 24000 },
      });
      streamRef.current = stream;

      // 3. RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 4. Remote audio → play through speakers
      const audio = new Audio();
      audio.autoplay = true;
      pc.ontrack = e => { audio.srcObject = e.streams[0]; };

      // 5. Local mic → OpenAI
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 6. Data channel for events + transcripts
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        // Fine-tune VAD and enable user transcription
        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            input_audio_transcription: { model: 'gpt-4o-mini-transcribe' },
            turn_detection: {
              type: 'server_vad',
              silence_duration_ms: 600,
              prefix_padding_ms: 200,
              threshold: 0.5,
            },
          },
        }));
      };

      dc.onmessage = e => {
        try { handleRealtimeEvent(JSON.parse(e.data as string)); } catch { /* ignore */ }
      };

      // 7. SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 8. Exchange SDP with OpenAI (direct browser ↔ OpenAI, ultra-low latency)
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${client_secret}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        },
      );

      if (!sdpRes.ok) {
        const txt = await sdpRes.text();
        throw new Error(`OpenAI SDP error ${sdpRes.status}: ${txt.slice(0, 200)}`);
      }

      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      setConnState('connected');

    } catch (err: any) {
      setError(err.message || 'Connection failed');
      setConnState('error');
      cleanup();
    }
  }, [cleanup, handleRealtimeEvent]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    cleanup();
    setConnState('idle');
    setError(null);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(p => !p);
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    setConnState('idle');
    setError(null);
    setTranscript([]);
  };

  const handleClose = () => {
    disconnect();
    setIsOpen(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!isOpen) {
    return (
      <button
        className="realtime-fab"
        onClick={handleOpen}
        type="button"
        title={ar('مكالمة صوتية مع الذكاء الاصطناعي', 'Live AI Voice Call')}
      >
        <Phone size={20} />
      </button>
    );
  }

  return (
    <div className="realtime-overlay">
      <div className="realtime-modal">

        {/* Header */}
        <div className="realtime-header">
          <div className="realtime-header-title">
            <Volume2 size={18} />
            <span>{ar('مكالمة صوتية مباشرة', 'Live Voice Call')}</span>
            {connState === 'connected' && (
              <span className="realtime-status-pill connected">{ar('متصل', 'Connected')}</span>
            )}
            {connState === 'connecting' && (
              <span className="realtime-status-pill connecting">{ar('جاري الاتصال...', 'Connecting...')}</span>
            )}
          </div>
          <button className="realtime-close-btn" onClick={handleClose} type="button">
            <X size={18} />
          </button>
        </div>

        {/* Orb */}
        <div className="realtime-orb-area">
          <div className={[
            'realtime-orb',
            isAISpeaking   ? 'ai-speaking'   : '',
            isUserSpeaking ? 'user-speaking' : '',
            connState === 'connected' ? 'connected' : '',
          ].filter(Boolean).join(' ')}>
            {connState === 'connecting' ? <Loader2 size={32} className="realtime-spin" />
              : connState === 'connected' ? <Volume2 size={32} />
              : <Phone size={32} />}
          </div>

          <p className="realtime-orb-label">
            {connState === 'idle'      && ar('اضغط "ابدأ المكالمة" للاتصال', 'Press "Start Call" to connect')}
            {connState === 'connecting'&& ar('جاري الاتصال بـ OpenAI...', 'Connecting to OpenAI...')}
            {connState === 'connected' && (
              isAISpeaking     ? ar('المساعد يتكلم...', 'Assistant speaking...')
              : isUserSpeaking ? ar('جاري الاستماع...', 'Listening...')
              : isMuted        ? ar('الميكروفون مكتوم', 'Microphone muted')
              : ar('تكلم الآن...', 'Speak now...')
            )}
            {connState === 'error' && ar('فشل الاتصال', 'Connection failed')}
          </p>

          {error && <p className="realtime-error">{error}</p>}
        </div>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="realtime-transcript">
            {transcript.map(line => (
              <div key={line.id} className={`realtime-line realtime-line-${line.role}`}>
                <span className="realtime-line-role">
                  {line.role === 'user' ? ar('أنت', 'You') : ar('المساعد', 'AI')}
                </span>
                <span className="realtime-line-text">{line.text}</span>
              </div>
            ))}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Controls */}
        <div className="realtime-controls">
          {(connState === 'idle' || connState === 'error') && (
            <button className="realtime-call-btn start" onClick={connect} type="button">
              <Phone size={20} />
              <span>{ar('ابدأ المكالمة', 'Start Call')}</span>
            </button>
          )}
          {connState === 'connecting' && (
            <button className="realtime-call-btn connecting" disabled type="button">
              <Loader2 size={20} className="realtime-spin" />
              <span>{ar('جاري الاتصال...', 'Connecting...')}</span>
            </button>
          )}
          {connState === 'connected' && (
            <>
              <button
                className={`realtime-mute-btn ${isMuted ? 'muted' : ''}`}
                onClick={toggleMute}
                type="button"
                title={isMuted ? ar('إلغاء كتم الصوت', 'Unmute') : ar('كتم الصوت', 'Mute')}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>
              <button className="realtime-call-btn end" onClick={disconnect} type="button">
                <PhoneOff size={20} />
                <span>{ar('إنهاء المكالمة', 'End Call')}</span>
              </button>
            </>
          )}
        </div>

        <p className="realtime-footer-note">
          {ar(
            'يرد بنفس لغتك • مدعوم بـ OpenAI Realtime API',
            'Responds in your language • Powered by OpenAI Realtime API',
          )}
        </p>

      </div>
    </div>
  );
}
