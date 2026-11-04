import React, { useRef, useEffect, useState } from 'react';
import jsQR from 'jsqr';
import { Icon } from './SvgIcons';

export default function QrScannerModal({ onScan, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' | 'user'
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  useEffect(() => {
    let active = true;

    async function startCamera() {
      try {
        setCameraError(null);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
        }

        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera is not supported on this device/browser');
        }

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();

          // Check torch capability
          const videoTrack = stream.getVideoTracks()[0];
          const capabilities = videoTrack?.getCapabilities?.() || {};
          if (capabilities.torch) {
            setHasTorch(true);
          }

          startScanningLoop();
        }
      } catch (err) {
        if (!active) return;
        console.error('Camera access error:', err);
        setCameraError(
          err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
            ? 'Camera permission denied. Please grant camera permission in your device settings to scan QR codes.'
            : 'Could not start camera: ' + (err.message || 'Unknown error')
        );
      }
    }

    startCamera();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorch) {
      const nextState = !torchOn;
      try {
        await track.applyConstraints({ advanced: [{ torch: nextState }] });
        setTorchOn(nextState);
      } catch (e) {
        console.warn('Could not toggle torch:', e);
      }
    }
  };

  const toggleFacingMode = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  const startScanningLoop = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let barcodeDetector = null;
    if ('BarcodeDetector' in window) {
      try {
        barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (_) {}
    }

    const scanFrame = async () => {
      const video = videoRef.current;
      if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw === 0 || vh === 0) {
        animFrameRef.current = requestAnimationFrame(scanFrame);
        return;
      }

      // 1. Try native BarcodeDetector API if available (fastest on modern Android WebView)
      if (barcodeDetector) {
        try {
          const barcodes = await barcodeDetector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const val = barcodes[0].rawValue;
            if (val) {
              onScan(val);
              return;
            }
          }
        } catch (_) {}
      }

      // 2. Pure JavaScript jsQR scan
      canvas.width = Math.min(vw, 640);
      canvas.height = Math.round((vh / vw) * canvas.width);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      const code = jsQR(imgData.data, imgData.width, imgData.height, {
        inversionAttempts: 'dontInvert'
      });

      if (code && code.data) {
        onScan(code.data);
        return;
      }

      animFrameRef.current = requestAnimationFrame(scanFrame);
    };

    animFrameRef.current = requestAnimationFrame(scanFrame);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 350,
        padding: '16px'
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: 'var(--surface, #1e293b)',
          borderRadius: '24px',
          border: '1px solid var(--border, rgba(255,255,255,0.15))',
          overflow: 'hidden',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))',
          backgroundColor: 'var(--surface-elevated, #0f172a)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'var(--tag-bg, rgba(99, 102, 241, 0.15))',
              color: 'var(--primary, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Icon name="device" size={17} />
            </span>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: '#ffffff' }}>
                Scan Device QR Code
              </h3>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.65)' }}>
                Point camera at the QR code on the other device
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Viewfinder Video Area */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '340px',
          backgroundColor: '#000000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {cameraError ? (
            <div style={{
              padding: '24px',
              textAlign: 'center',
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '32px' }}>📷</span>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#ef4444' }}>
                Camera Access Needed
              </div>
              <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)', margin: 0, lineHeight: 1.5, maxWidth: '320px' }}>
                {cameraError}
              </p>
              <button
                onClick={onClose}
                style={{
                  marginTop: '10px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  background: 'var(--primary, #6366f1)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Use 6-Digit Code Instead
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />

              {/* Viewfinder Box Frame */}
              <div style={{
                position: 'absolute',
                width: '210px',
                height: '210px',
                border: '2px solid rgba(255, 255, 255, 0.4)',
                borderRadius: '20px',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {/* 4 Corner Accents */}
                <div style={{ position: 'absolute', top: '-2px', left: '-2px', width: '22px', height: '22px', borderTop: '4px solid var(--primary, #6366f1)', borderLeft: '4px solid var(--primary, #6366f1)', borderTopLeftRadius: '14px' }} />
                <div style={{ position: 'absolute', top: '-2px', right: '-2px', width: '22px', height: '22px', borderTop: '4px solid var(--primary, #6366f1)', borderRight: '4px solid var(--primary, #6366f1)', borderTopRightRadius: '14px' }} />
                <div style={{ position: 'absolute', bottom: '-2px', left: '-2px', width: '22px', height: '22px', borderBottom: '4px solid var(--primary, #6366f1)', borderLeft: '4px solid var(--primary, #6366f1)', borderBottomLeftRadius: '14px' }} />
                <div style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '22px', height: '22px', borderBottom: '4px solid var(--primary, #6366f1)', borderRight: '4px solid var(--primary, #6366f1)', borderBottomRightRadius: '14px' }} />

                {/* Animated Green Scanline */}
                <div style={{
                  position: 'absolute',
                  left: '10px',
                  right: '10px',
                  height: '2.5px',
                  background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
                  boxShadow: '0 0 8px #10b981',
                  animation: 'qrScanMove 2.2s ease-in-out infinite'
                }} />
              </div>

              {/* Floating Camera Controls (Torch & Camera Switch) */}
              <div style={{
                position: 'absolute',
                bottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 10
              }}>
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '999px',
                      background: torchOn ? '#f59e0b' : 'rgba(0, 0, 0, 0.65)',
                      color: torchOn ? '#000000' : '#ffffff',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      backdropFilter: 'blur(6px)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    🔦 {torchOn ? 'Flash On' : 'Flash'}
                  </button>
                )}
                <button
                  onClick={toggleFacingMode}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '999px',
                    background: 'rgba(0, 0, 0, 0.65)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.25)',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    backdropFilter: 'blur(6px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  🔄 Switch Camera
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Instructions */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: 'var(--surface-elevated, #0f172a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: '1px solid var(--border, rgba(255,255,255,0.1))'
        }}>
          <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>
            Open <b>Devices & Sync</b> on your other device
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '7px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border, rgba(255,255,255,0.2))',
              background: 'transparent',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes qrScanMove {
          0% { top: 12px; opacity: 0.2; }
          25% { opacity: 1; }
          50% { top: 190px; opacity: 1; }
          75% { opacity: 1; }
          100% { top: 12px; opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
