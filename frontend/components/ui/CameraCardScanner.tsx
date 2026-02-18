'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Camera, RotateCcw, Zap, ZapOff, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { scanCardImage, type CardOcrResult } from '@/lib/cardOcr';

type Props = {
  open: boolean;
  onClose: () => void;
  onResult: (result: CardOcrResult) => void;
};

export function CameraCardScanner({ open, onClose, onResult }: Props) {
  const { t } = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasCamera, setHasCamera] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [error, setError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    setCameraReady(false);
    setError('');

    // Stop any existing stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }

      // Check torch capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities?.();
      if (capabilities && 'torch' in capabilities) {
        setHasTorch(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setHasCamera(false);
      setError(t('cards.cameraNotAvailable') || 'Camera not available. Please check permissions.');
    }
  }, [t]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setHasTorch(false);
    setTorchOn(false);
  }, []);

  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, facingMode, startCamera, stopCamera]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchOn } as MediaTrackConstraintSet],
      });
      setTorchOn(!torchOn);
    } catch {
      // Torch not supported
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current || processing) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Capture frame at full resolution
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    setProcessing(true);
    setProgress(0);

    try {
      // Convert canvas to blob for OCR
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.95)
      );

      if (!blob) {
        setError(t('cards.scanFailed') || 'Failed to capture image');
        setProcessing(false);
        return;
      }

      const file = new File([blob], 'card-capture.jpg', { type: 'image/jpeg' });
      const result = await scanCardImage(file, (p) => setProgress(p));

      const fieldsFound = Object.keys(result).filter(k => result[k as keyof typeof result]);

      if (fieldsFound.length > 0) {
        onResult(result);
        onClose();
      } else {
        setError(t('cards.scanNoData') || 'Could not read card details. Try adjusting the angle or lighting.');
      }
    } catch (err) {
      console.error('Scan error:', err);
      setError(t('cards.scanFailed') || 'Failed to scan card.');
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  if (!open) return null;

  return (
    <div className="camera-scanner-overlay">
      <div className="camera-scanner-modal">
        {/* Header */}
        <div className="camera-scanner-header">
          <h3>{t('cards.scanCard') || 'Scan Card'}</h3>
          <button className="camera-scanner-close" onClick={onClose} type="button">
            <X size={24} />
          </button>
        </div>

        {/* Camera View */}
        <div className="camera-scanner-view">
          {!hasCamera ? (
            <div className="camera-scanner-error">
              <Camera size={48} />
              <p>{error || (t('cards.cameraNotAvailable') || 'Camera not available')}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="camera-scanner-video"
                playsInline
                muted
                autoPlay
              />
              {/* Card Overlay Guide */}
              {cameraReady && (
                <div className="camera-scanner-guide">
                  <div className="camera-scanner-card-frame">
                    <div className="camera-frame-corner camera-frame-tl" />
                    <div className="camera-frame-corner camera-frame-tr" />
                    <div className="camera-frame-corner camera-frame-bl" />
                    <div className="camera-frame-corner camera-frame-br" />
                  </div>
                  <p className="camera-scanner-instruction">
                    {t('cards.scanInstruction') || 'Position your card within the frame'}
                  </p>
                </div>
              )}
              {!cameraReady && !error && (
                <div className="camera-scanner-loading">
                  <Loader2 size={32} className="scan-spinner" />
                  <p>{t('common.loading') || 'Loading...'}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Processing overlay */}
        {processing && (
          <div className="camera-scanner-processing">
            <Loader2 size={40} className="scan-spinner" />
            <p>{t('cards.scanning') || 'Scanning card...'}</p>
            {progress > 0 && (
              <div className="scan-progress-bar" style={{ width: '200px' }}>
                <div className="scan-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {error && hasCamera && (
          <div className="camera-scanner-error-msg">
            <p>{error}</p>
            <p className="camera-scanner-error-hint">
              {t('cards.scanTiltHint') || 'Tilt the card slightly to create shadows on embossed numbers'}
            </p>
          </div>
        )}

        {/* Controls */}
        <div className="camera-scanner-controls">
          {hasTorch && (
            <button
              type="button"
              className={`camera-scanner-btn camera-scanner-btn-secondary ${torchOn ? 'active' : ''}`}
              onClick={toggleTorch}
              disabled={processing}
            >
              {torchOn ? <ZapOff size={20} /> : <Zap size={20} />}
            </button>
          )}

          <button
            type="button"
            className="camera-scanner-btn camera-scanner-btn-capture"
            onClick={captureAndScan}
            disabled={processing || !cameraReady}
          >
            <div className="camera-capture-ring">
              <Camera size={28} />
            </div>
          </button>

          <button
            type="button"
            className="camera-scanner-btn camera-scanner-btn-secondary"
            onClick={switchCamera}
            disabled={processing}
          >
            <RotateCcw size={20} />
          </button>
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
