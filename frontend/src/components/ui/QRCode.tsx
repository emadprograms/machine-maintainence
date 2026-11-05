import { useEffect, useRef, useState } from 'react';
import QRCodeLib from 'qrcode';
import { Download } from 'lucide-react';

export function QRCode({ value, size = 180, label }: { value: string; size?: number; label?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: '#e2e8f0', light: 'transparent' },
    });
    QRCodeLib.toDataURL(value, {
      width: size * 2,
      margin: 2,
      color: { dark: '#e2e8f0', light: 'transparent' },
    }).then(setUrl).catch(() => {});
  }, [value, size]);

  function download() {
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr-${label || 'code'}.png`;
    a.click();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-4 rounded-xl bg-card border-card">
        <canvas ref={canvasRef} />
      </div>
      {label && <p className="text-sm text-muted font-medium">{label}</p>}
      {url && (
        <button onClick={download} className="btn-ghost btn-sm">
          <Download className="w-4 h-4" /> Télécharger
        </button>
      )}
    </div>
  );
}
