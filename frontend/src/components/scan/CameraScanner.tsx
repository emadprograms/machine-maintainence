import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Camera, RefreshCw, Check, X, Upload, AlertCircle, ScanLine, ImageOff, ChevronRight, RotateCcw,
} from 'lucide-react';

export interface ScanAngle {
  key: string;
  label: string;
  hint: string;
}

export const DEFAULT_ANGLES: ScanAngle[] = [
  { key: 'front', label: 'Face avant', hint: "Cadrez l'équipement de face, bien centré" },
  { key: 'left', label: 'Côté gauche', hint: 'Tournez autour pour capturer le profil gauche' },
  { key: 'right', label: 'Côté droit', hint: 'Capturez le profil droit' },
  { key: 'top', label: 'Vue haute', hint: 'Montrez le dessus / les connexions' },
  { key: 'plate', label: 'Plaque signalétique', hint: 'Cadrez le n° de série et le modèle' },
  { key: 'defect', label: 'Zone du défaut', hint: 'Gros plan net sur le problème constaté' },
];

interface Props {
  angles?: ScanAngle[];
  onComplete: (images: string[]) => void;
  onCancel?: () => void;
  minShots?: number;
}

const MAX_WIDTH = 1080;
const JPEG_QUALITY = 0.7;

function downscaleToDataURL(source: CanvasImageSource, sw: number, sh: number): string {
  const scale = Math.min(1, MAX_WIDTH / sw);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(sw * scale));
  canvas.height = Math.max(1, Math.round(sh * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(downscaleToDataURL(img, img.naturalWidth, img.naturalHeight));
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CameraScanner({ angles = DEFAULT_ANGLES, onComplete, onCancel, minShots = 1 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [shots, setShots] = useState<(string | null)[]>(() => angles.map(() => null));
  const [flash, setFlash] = useState(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setFallback(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
      setFallback(false);
    } catch (err: any) {
      const name = err?.name || '';
      if (name === 'NotAllowedError') setError("Accès caméra refusé. Autorisez la caméra ou importez des photos.");
      else if (name === 'NotFoundError') setError('Aucune caméra détectée sur cet appareil.');
      else setError('Caméra indisponible. Vous pouvez importer des photos.');
      setFallback(true);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capturedCount = shots.filter(Boolean).length;
  const allDone = capturedCount >= angles.length;
  const canFinish = capturedCount >= minShots;

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const dataUrl = downscaleToDataURL(video, video.videoWidth, video.videoHeight);
    if (!dataUrl) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    setShots(prev => {
      const next = [...prev];
      next[activeStep] = dataUrl;
      return next;
    });
    const nextEmpty = shots.findIndex((s, i) => i > activeStep && !s);
    if (nextEmpty !== -1) setActiveStep(nextEmpty);
    else {
      const firstEmpty = shots.findIndex((s, i) => i !== activeStep && !s);
      if (firstEmpty !== -1) setActiveStep(firstEmpty);
    }
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      const urls = await Promise.all(files.map(fileToDataURL));
      setShots(prev => {
        const next = [...prev];
        let idx = 0;
        for (const url of urls) {
          while (idx < next.length && next[idx]) idx++;
          if (idx < next.length) next[idx] = url;
          else next.push(url);
          idx++;
        }
        return next;
      });
    } catch {
      setError('Impossible de lire une des images.');
    } finally {
      e.target.value = '';
    }
  }

  function finish() {
    stopCamera();
    onComplete(shots.filter((s): s is string => !!s));
  }

  function cancel() {
    stopCamera();
    onCancel?.();
  }

  const step = angles[activeStep];

  return (
    <div className="space-y-4">
      {/* Viewport */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black border border-line">
        {!fallback ? (
          <>
            <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
            {/* Guide overlay */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-6 rounded-xl border-2 border-white/30" />
              <div className="absolute left-6 top-6 h-6 w-6 border-l-2 border-t-2 border-accent-400 rounded-tl-lg" />
              <div className="absolute right-6 top-6 h-6 w-6 border-r-2 border-t-2 border-accent-400 rounded-tr-lg" />
              <div className="absolute left-6 bottom-6 h-6 w-6 border-l-2 border-b-2 border-accent-400 rounded-bl-lg" />
              <div className="absolute right-6 bottom-6 h-6 w-6 border-r-2 border-b-2 border-accent-400 rounded-br-lg" />
              <div className="absolute inset-x-6 overflow-hidden" style={{ top: 24, bottom: 24 }}>
                <div className="absolute inset-x-0 h-0.5 bg-accent-400/70 shadow-[0_0_12px_2px_rgba(34,211,238,0.6)] animate-scan-line" />
              </div>
            </div>
            {/* Step badge */}
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 backdrop-blur px-3 py-1.5">
              <ScanLine className="h-3.5 w-3.5 text-accent-400" />
              <span className="text-xs font-medium text-white">{step?.label}</span>
            </div>
            {!ready && !error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-zinc-200">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-500/30 border-t-accent-500" />
                <p className="text-sm">Initialisation de la caméra…</p>
              </div>
            )}
            <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? 'opacity-80' : 'opacity-0'}`} />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <ImageOff className="h-10 w-10 text-zinc-500" />
            <p className="text-sm text-zinc-300">Caméra non disponible — importez des photos depuis l'appareil.</p>
            <label className="btn-accent btn-sm cursor-pointer">
              <Upload className="h-4 w-4" /> Importer des photos
              <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFiles} />
            </label>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Current step hint */}
      {!fallback && step && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-soft bg-surface-muted px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Étape {activeStep + 1}/{angles.length} · {step.label}</p>
            <p className="truncate text-xs text-ink-soft">{step.hint}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-accent-600">{capturedCount}/{angles.length}</span>
        </div>
      )}

      {/* Thumbnails / steps */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {angles.map((a, i) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setActiveStep(i)}
            className={`group relative aspect-square overflow-hidden rounded-lg border text-left transition-all ${
              i === activeStep ? 'border-accent-500 ring-2 ring-accent-500/30' : 'border-line hover:border-ink-faint'
            }`}
            title={a.label}
          >
            {shots[i] ? (
              <>
                <img src={shots[i] as string} alt={a.label} className="h-full w-full object-cover" />
                <span className="absolute right-1 top-1 rounded-full bg-green-500 p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </span>
              </>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-surface-muted px-1">
                <Camera className="h-4 w-4 text-ink-faint" />
                <span className="text-center text-[9px] leading-tight text-ink-faint">{a.label}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!fallback && (
          <button type="button" onClick={capture} disabled={!ready} className="btn-accent flex-1 min-w-[140px]">
            <Camera className="h-4 w-4" /> {shots[activeStep] ? 'Reprendre cette vue' : 'Capturer'}
          </button>
        )}
        {fallback ? (
          <label className="btn-secondary cursor-pointer">
            <Upload className="h-4 w-4" /> Ajouter
            <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleFiles} />
          </label>
        ) : (
          <button type="button" onClick={() => startCamera()} className="btn-secondary btn-sm" title="Relancer la caméra">
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        {capturedCount > 0 && (
          <button type="button" onClick={() => { setShots(angles.map(() => null)); setActiveStep(0); }} className="btn-ghost btn-sm" title="Tout réinitialiser">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
        {onCancel && (
          <button type="button" onClick={cancel} className="btn-ghost btn-sm">
            <X className="h-4 w-4" /> Annuler
          </button>
        )}
        <button type="button" onClick={finish} disabled={!canFinish} className="btn-primary ml-auto">
          {allDone ? 'Valider le scan' : `Valider (${capturedCount})`} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
