'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Zap, ZapOff, RotateCcw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { cardsAPI } from '@/app/api/cards';

export type ScanResult = {
  card_number?: string;
  cardholder_name?: string;
  expiry_month?: string;
  expiry_year?: string;
  cvv?: string;
  card_network?: string;
  bank_name?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (result: ScanResult) => void;
};

export function CameraCardScanner({ open, onClose, onResult }: Props) {
  const { t } = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanningRef = useRef(false);

  const [cameraReady, setCameraReady] = useState(false);
  const [hasCamera, setHasCamera] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Start camera
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    setCameraReady(false);
    setStatusText('');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }

      // Check torch
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities?.();
      setHasTorch(!!(caps && 'torch' in caps));
    } catch {
      setHasCamera(false);
      setStatusText(t('cards.cameraNotAvailable') || 'Camera not available. Check permissions.');
      setStatusType('error');
    }
  }, [t]);

  // Stop camera and timers
  const stopAll = useCallback(() => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    scanningRef.current = false;
    setCameraReady(false);
    setHasTorch(false);
    setTorchOn(false);
    setScanning(false);
    setScanCount(0);
  }, []);

  // Capture frame and send to backend
  const captureAndScan = useCallback(async () => {
    if (scanningRef.current || !videoRef.current || !canvasRef.current) return;
    scanningRef.current = true;
    setScanning(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { scanningRef.current = false; setScanning(false); return; }

    ctx.drawImage(video, 0, 0);

    try {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setScanCount(prev => prev + 1);
      setStatusText(t('cards.scanningAuto') || 'Scanning...');
      setStatusType('info');

      const result = await cardsAPI.scanCardImage(dataUrl);

      if (result.error) {
        setStatusText(t('cards.scanRetrying') || 'Adjusting... Hold card steady');
        setStatusType('info');
      } else {
        const fields = Object.keys(result).filter(k => result[k as keyof typeof result]);
        if (fields.length > 0) {
          setStatusText((t('cards.scanSuccess') || 'Card detected!') + ` (${fields.length} ${t('cards.fieldsExtracted') || 'fields'})`);
          setStatusType('success');
          // Stop auto-scan and return result
          if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
          }
          setTimeout(() => {
            onResult(result);
            onClose();
          }, 800);
          return;
        } else {
          setStatusText(t('cards.scanRetrying') || 'Adjusting... Hold card steady');
          setStatusType('info');
        }
      }
    } catch {
      setStatusText(t('cards.scanRetrying') || 'Retrying...');
      setStatusType('info');
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [t, onResult, onClose]);

  // Start auto-scanning when camera is ready
  useEffect(() => {
    if (cameraReady && open) {
      // Initial scan after 1.5s
      const initialTimer = setTimeout(() => {
        captureAndScan();
      }, 1500);

      // Then scan every 3 seconds
      scanTimerRef.current = setInterval(() => {
        if (!scanningRef.current) {
          captureAndScan();
        }
      }, 3500);

      return () => {
        clearTimeout(initialTimer);
        if (scanTimerRef.current) {
          clearInterval(scanTimerRef.current);
          scanTimerRef.current = null;
        }
      };
    }
  }, [cameraReady, open, captureAndScan]);

  // Open/close camera
  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopAll();
    }
    return () => stopAll();
  }, [open, facingMode, startCamera, stopAll]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn } as MediaTrackConstraintSet] });
      setTorchOn(!torchOn);
    } catch { /* not supported */ }
  };

  if (!open) return null;

  return (
    <div className="auto-scanner-overlay">
      <div className="auto-scanner-modal">
        {/* Close button */}
        <button className="auto-scanner-close" onClick={onClose} type="button">
          <X size={24} />
        </button>

        {/* Camera */}
        <div className="auto-scanner-camera">
          {!hasCamera ? (
            <div className="auto-scanner-no-camera">
              <AlertCircle size={48} />
              <p>{statusText}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className="auto-scanner-video" playsInline muted autoPlay />

              {/* Card frame overlay */}
              {cameraReady && (
                <div className="auto-scanner-overlay-guide">
                  <div className="auto-scanner-dim auto-scanner-dim-top" />
                  <div className="auto-scanner-middle-row">
                    <div className="auto-scanner-dim auto-scanner-dim-left" />
                    <div className={`auto-scanner-frame ${scanning ? 'auto-scanner-frame-active' : ''} ${statusType === 'success' ? 'auto-scanner-frame-success' : ''}`}>
                      {/* Corner markers */}
                      <div className="auto-frame-corner auto-frame-tl" />
                      <div className="auto-frame-corner auto-frame-tr" />
                      <div className="auto-frame-corner auto-frame-bl" />
                      <div className="auto-frame-corner auto-frame-br" />
                      {/* Scanning line animation */}
                      {scanning && <div className="auto-scanner-line" />}
                    </div>
                    <div className="auto-scanner-dim auto-scanner-dim-right" />
                  </div>
                  <div className="auto-scanner-dim auto-scanner-dim-bottom" />
                </div>
              )}

              {!cameraReady && (
                <div className="auto-scanner-loading">
                  <Loader2 size={36} className="scan-spinner" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Status bar */}
        <div className="auto-scanner-status">
          <div className={`auto-scanner-status-bar ${statusType}`}>
            {statusType === 'success' ? <CheckCircle size={18} /> :
             statusType === 'error' ? <AlertCircle size={18} /> :
             scanning ? <Loader2 size={18} className="scan-spinner" /> : null}
            <span>
              {statusText || (t('cards.scanInstruction') || 'Position your card within the frame')}
            </span>
          </div>

          {/* Controls */}
          <div className="auto-scanner-controls">
            {hasTorch && (
              <button
                type="button"
                className={`auto-scanner-ctrl-btn ${torchOn ? 'active' : ''}`}
                onClick={toggleTorch}
              >
                {torchOn ? <ZapOff size={20} /> : <Zap size={20} />}
                <span>{torchOn ? 'Flash Off' : 'Flash'}</span>
              </button>
            )}
            <button
              type="button"
              className="auto-scanner-ctrl-btn"
              onClick={() => setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')}
            >
              <RotateCcw size={20} />
              <span>{t('cards.switchCamera') || 'Flip'}</span>
            </button>
          </div>

          {scanCount > 0 && (
            <p className="auto-scanner-hint">
              {t('cards.scanTiltHint') || 'Tilt the card slightly for better results'}
            </p>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
