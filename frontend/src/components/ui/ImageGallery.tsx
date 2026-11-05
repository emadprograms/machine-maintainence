import { useState } from 'react';
import { X, ImageOff } from 'lucide-react';

export default function ImageGallery({ images, emptyLabel = 'Aucune preuve visuelle' }: { images: string[]; emptyLabel?: string }) {
  const [active, setActive] = useState<string | null>(null);

  if (!images.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-8 text-ink-faint">
        <ImageOff className="h-6 w-6" />
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(src)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-line-soft transition-all hover:border-brand-500 hover:shadow-apple-sm"
          >
            <img src={src} alt={`Cliché ${i + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          </button>
        ))}
      </div>

      {active && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in" onClick={() => setActive(null)}>
          <button className="absolute right-4 top-4 btn-ghost btn-sm" onClick={() => setActive(null)}>
            <X className="h-5 w-5" />
          </button>
          <img src={active} alt="Aperçu" className="max-h-[90vh] max-w-full rounded-xl object-contain shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
