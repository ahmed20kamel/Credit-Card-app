'use client';

/**
 * RealtimeVoice – OpenAI Realtime API via WebRTC
 * - Full financial context injected server-side (same data as text chatbot)
 * - Function calling: add_transaction + add_card executed via our API
 * - Browser ↔ OpenAI directly (ultra-low latency)
 * - API key stays server-side; browser only receives a short-lived ephemeral token
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Loader2, X, Volume2, CheckCircle } from 'lucide-react';
import api from '@/app/api/client';
import { useTranslations } from '@/lib/i18n';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

type ConnState = 'idle' | 'connecting' | 'connected' | 'error';

interface TranscriptLine {
  role: 'user' | 'assistant' | 'action';
  text: string;
  id: number;
}

interface SessionData {
  client_secret: string;
  expires_at?: number;
  model: string;
  card_id_map: Record<string, string>;
}

// ── Constant ──────────────────────────────────────────────────────────────────

const REALTIME_MODEL = 'gpt-4o-realtime-preview-2024-12-17';

// ── Component ─────────────────────────────────────────────────────────────────

export default function RealtimeVoice() {
  const { locale } = useTranslations();

  const [isOpen, setIsOpen]                 = useState(false);
  const [connState, setConnState]           = useState<ConnState>('idle');
  const [isMuted, setIsMuted]               = useState(false);
  const [isAISpeaking, setIsAISpeaking]     = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [transcript, setTranscript]         = useState<TranscriptLine[]>([]);

  const transcriptEndRef  = useRef<HTMLDivElement>(null);
  const idCounter         = useRef(0);
  const pcRef             = useRef<RTCPeerConnection | null>(null);
  const dcRef             = useRef<RTCDataChannel | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const cardIdMapRef      = useRef<Record<string, string>>({});

  const ar = (a: string, e: string) => (locale === 'ar' ? a : e);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    dcRef.current?.close();
    pcRef.current?.close();
    pcRef.current    = null;
    dcRef.current    = null;
    streamRef.current = null;
    setIsAISpeaking(false);
    setIsUserSpeaking(false);
    setIsMuted(false);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  // ── Tool Execution ─────────────────────────────────────────────────────────
  // Called when the AI requests a function call via the data channel

  const executeFunction = useCallback(async (
    name: string,
    args: Record<string, any>,
  ): Promise<{ success: boolean; message: string }> => {

    if (name === 'add_transaction') {
      try {
        // Resolve card_last_four → card ID
        let cardId: string | undefined;
        if (args.card_last_four) {
          cardId = cardIdMapRef.current[args.card_last_four]
            || cardIdMapRef.current[String(args.card_last_four).toLowerCase()];
        }

        const payload: Record<string, any> = {
          amount:           args.amount,
          merchant_name:    args.merchant_name,
          transaction_type: args.transaction_type || 'purchase',
          currency:         args.currency || 'AED',
          category:         args.category || 'Other',
          transaction_date: args.transaction_date || new Date().toISOString().split('T')[0],
          source:           'voice',
          description:      args.merchant_name,
        };
        if (cardId) payload.card = cardId;

        await api.post('/transactions/', payload);

        const msg = ar(
          `✓ تمت إضافة معاملة: ${args.merchant_name} – ${args.amount} ${args.currency || 'AED'}`,
          `✓ Transaction added: ${args.merchant_name} – ${args.amount} ${args.currency || 'AED'}`,
        );
        toast.success(msg);
        setTranscript(p => [...p, { role: 'action', text: msg, id: ++idCounter.current }]);
        return { success: true, message: msg };
      } catch (e: any) {
        const msg = ar('فشل في إضافة المعاملة', 'Failed to add transaction');
        toast.error(msg);
        return { success: false, message: msg };
      }
    }

    if (name === 'add_card') {
      try {
        const payload: Record<string, any> = {
          card_name:     args.card_name,
          bank_name:     args.bank_name,
          card_type:     args.card_type || 'credit',
          card_network:  args.card_network || 'visa',
          card_last_four: args.card_last_four || '0000',
          balance_currency: args.currency || 'AED',
          // Placeholder encrypted number (no real number provided via voice)
          card_number:   '0000000000000000',
        };
        if (args.credit_limit)     payload.credit_limit     = args.credit_limit;
        if (args.payment_due_date) payload.payment_due_date = args.payment_due_date;

        const res = await api.post('/cards/', payload);
        const newCard = res.data;

        // Add to local card_id_map for future tool calls in same session
        if (newCard?.id) {
          cardIdMapRef.current[args.card_name.toLowerCase()] = String(newCard.id);
          if (args.card_last_four) cardIdMapRef.current[args.card_last_four] = String(newCard.id);
        }

        const msg = ar(
          `✓ تمت إضافة البطاقة: ${args.card_name} – ${args.bank_name}`,
          `✓ Card added: ${args.card_name} – ${args.bank_name}`,
        );
        toast.success(msg);
        setTranscript(p => [...p, { role: 'action', text: msg, id: ++idCounter.current }]);
        return { success: true, message: msg };
      } catch (e: any) {
        const msg = ar('فشل في إضافة البطاقة', 'Failed to add card');
        toast.error(msg);
        return { success: false, message: msg };
      }
    }

    return { success: false, message: `Unknown function: ${name}` };
  }, [ar]);

  // ── Realtime Event Handler ────────────────────────────────────────────────

  const handleRealtimeEvent = useCallback((ev: any) => {
    switch (ev.type) {

      // User speech transcript
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

      // VAD events
      case 'input_audio_buffer.speech_started':
        setIsUserSpeaking(true);
        break;

      case 'input_audio_buffer.speech_stopped':
        setIsUserSpeaking(false);
        break;

      // AI text response
      case 'response.output_item.done':
        if (ev.item?.type === 'message' && ev.item?.role === 'assistant') {
          const text = (ev.item.content as any[] | undefined)
            ?.filter((c: any) => c.type === 'text' || c.type === 'audio')
            .map((c: any) => c.transcript || c.text || '')
            .join(' ')
            .trim();
          if (text) {
            setTranscript(p => [...p, { role: 'assistant', text, id: ++idCounter.current }]);
          }
        }
        break;

      // AI audio
      case 'response.audio.delta':
        setIsAISpeaking(true);
        break;

      case 'response.audio.done':
      case 'response.done':
        setIsAISpeaking(false);
        break;

      // ── Function call (tool execution) ──────────────────────────────────
      case 'response.function_call_arguments.done': {
        const { name, arguments: argsStr, call_id } = ev;
        let args: Record<string, any> = {};
        try { args = JSON.parse(argsStr); } catch { /* ignore */ }

        // Execute the function and send result back to AI
        executeFunction(name, args).then(result => {
          const dc = dcRef.current;
          if (!dc || dc.readyState !== 'open') return;

          // 1. Send function output
          dc.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type: 'function_call_output',
              call_id,
              output: JSON.stringify(result),
            },
          }));

          // 2. Ask AI to continue response
          dc.send(JSON.stringify({ type: 'response.create' }));
        });
        break;
      }

      case 'error':
        setError(ev.error?.message || 'Realtime error');
        break;
    }
  }, [executeFunction]);

  // ── WebRTC Connect ─────────────────────────────────────────────────────────

  const connect = useCallback(async () => {
    setError(null);
    setConnState('connecting');
    setTranscript([]);

    try {
      // 1. Get ephemeral token + financial context from backend
      const { data } = await api.post<SessionData>('/realtime/session/');
      const { client_secret, card_id_map } = data;

      // Store card_id_map for tool execution
      cardIdMapRef.current = card_id_map || {};

      // 2. Microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 24000 },
      });
      streamRef.current = stream;

      // 3. RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // 4. Remote audio → speakers
      const audio = new Audio();
      audio.autoplay = true;
      pc.ontrack = e => { audio.srcObject = e.streams[0]; };

      // 5. Local mic → OpenAI
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      // 6. Data channel for events + function calls
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onmessage = e => {
        try { handleRealtimeEvent(JSON.parse(e.data as string)); } catch { /* ignore */ }
      };

      // 7. SDP offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 8. Exchange SDP with OpenAI
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

  // ── Actions ───────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    cleanup();
    setConnState('idle');
    setError(null);
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(p => !p);
  }, []);

  const handleOpen  = () => { setIsOpen(true); setConnState('idle'); setError(null); setTranscript([]); };
  const handleClose = () => { disconnect(); setIsOpen(false); };

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
            isAISpeaking    ? 'ai-speaking'   : '',
            isUserSpeaking  ? 'user-speaking' : '',
            connState === 'connected' ? 'connected' : '',
          ].filter(Boolean).join(' ')}>
            {connState === 'connecting' ? <Loader2 size={32} className="realtime-spin" />
              : connState === 'connected' ? <Volume2 size={32} />
              : <Phone size={32} />}
          </div>

          <p className="realtime-orb-label">
            {connState === 'idle'       && ar('اضغط "ابدأ المكالمة" للاتصال', 'Press "Start Call" to connect')}
            {connState === 'connecting' && ar('جاري الاتصال...', 'Connecting to OpenAI...')}
            {connState === 'connected'  && (
              isAISpeaking    ? ar('المساعد يتكلم...', 'Assistant speaking...')
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
                {line.role === 'action' ? (
                  <span className="realtime-action-line">
                    <CheckCircle size={12} />
                    {line.text}
                  </span>
                ) : (
                  <>
                    <span className="realtime-line-role">
                      {line.role === 'user' ? ar('أنت', 'You') : ar('المساعد', 'AI')}
                    </span>
                    <span className="realtime-line-text">{line.text}</span>
                  </>
                )}
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
            'يرد بلغتك • يضيف معاملات وبطاقات بصوتك • OpenAI Realtime',
            'Responds in your language • Adds transactions & cards by voice • OpenAI Realtime',
          )}
        </p>

      </div>
    </div>
  );
}
