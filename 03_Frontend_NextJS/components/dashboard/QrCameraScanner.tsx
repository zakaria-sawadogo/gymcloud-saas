'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Camera, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * §6.x, §14.x — Scan QR par caméra, directement dans le navigateur.
 * Jusqu'ici, "Contrôle d'accès" côté web n'avait qu'un champ texte à
 * remplir (pensé pour un lecteur externe ou une saisie manuelle) —
 * ouvert sur un téléphone ou une tablette, rien ne permettait de
 * scanner réellement avec l'appareil photo.
 *
 * jsQR plutôt que l'API native BarcodeDetector : cette dernière n'est
 * toujours pas prise en charge sur Safari iOS à ce jour, ce qui
 * aurait exclu une bonne partie des téléphones réellement utilisés
 * sur le terrain. jsQR fonctionne partout où getUserMedia fonctionne.
 *
 * `facingMode: 'environment'` demande la caméra arrière par défaut
 * (celle qu'on présente au badge d'un adhérent), pas la caméra
 * selfie — sur desktop sans caméra arrière, le navigateur retombe
 * simplement sur la caméra disponible.
 */
export function QrCameraScanner({
  onScan,
  onClose,
}: {
  onScan: (token: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const hasScannedRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const handleClose = useCallback(() => {
    stopCamera();
    onClose();
  }, [stopCamera, onClose]);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsStarting(false);
        tick();
      } catch (err) {
        if (cancelled) return;
        setIsStarting(false);
        setError(
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? "Accès à la caméra refusé — autorisez-la dans les paramètres du navigateur pour scanner."
            : "Impossible d'accéder à la caméra sur cet appareil.",
        );
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || hasScannedRef.current) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code && code.data) {
            hasScannedRef.current = true;
            stopCamera();
            onScan(code.data);
            return;
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex items-center justify-between bg-black/60 px-4 py-3">
        <span className="text-sm font-medium text-white">Scanner un QR code</span>
        <button
          onClick={handleClose}
          aria-label="Fermer la caméra"
          className="rounded-full p-1.5 text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <canvas ref={canvasRef} className="hidden" />

        {!error && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-64 w-64 rounded-2xl border-4 border-white/70" />
          </div>
        )}

        {isStarting && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <p className="text-sm text-white">Démarrage de la caméra...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
            <Camera className="h-8 w-8 text-white/60" />
            <p className="text-sm text-white">{error}</p>
            <Button variant="secondary" size="sm" onClick={handleClose}>
              Fermer
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
