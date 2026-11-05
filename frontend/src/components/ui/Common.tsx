import { useEffect, useRef, useState } from 'react';

export function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  subtitle?: string;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const numValue = typeof value === 'number' ? value : parseInt(value as string) || 0;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!ref.current || hasAnimated.current) return;
    hasAnimated.current = true;
    let start = 0;
    const duration = 800;
    const step = Math.ceil(numValue / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= numValue) { setDisplayValue(numValue); clearInterval(timer); }
      else setDisplayValue(start);
    }, 16);
    return () => clearInterval(timer);
  }, [numValue]);

  const colors: Record<string, string> = {
    'bg-brand-600/20 text-brand-400': 'from-brand-500/20 to-brand-600/10 border-brand-500/20 shadow-brand-500/10',
    'bg-red-500/20 text-red-400': 'from-red-500/20 to-red-600/10 border-red-500/20 shadow-red-500/10',
    'bg-green-500/20 text-green-400': 'from-green-500/20 to-green-600/10 border-green-500/20 shadow-green-500/10',
    'bg-amber-500/20 text-amber-400': 'from-amber-500/20 to-amber-600/10 border-amber-500/20 shadow-amber-500/10',
  };
  const gradientClass = colors[color] || 'from-slate-500/20 to-slate-600/10';

  return (
    <div className="card card-hover flex items-start gap-4">
      <div className={`p-3 rounded-2xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-ink tracking-tight">{value}</p>
        <p className="text-sm text-ink-soft">{title}</p>
        {subtitle && <p className="text-xs text-ink-faint mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

export function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const colorMap: Record<string, string> = {
    submitted: 'bg-blue-50 text-blue-700 border-blue-200',
    analysis: 'bg-purple-50 text-purple-700 border-purple-200',
    inspection: 'bg-amber-50 text-amber-700 border-amber-200',
    validation: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    manufacturing: 'bg-orange-50 text-orange-700 border-orange-200',
    delivery: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    closed: 'bg-green-50 text-green-700 border-green-200',
    active: 'bg-green-50 text-green-700 border-green-200',
    maintenance: 'bg-amber-50 text-amber-700 border-amber-200',
    retired: 'bg-zinc-100 text-ink-soft border-line',
    pending: 'bg-zinc-100 text-ink-soft border-line',
    ordered: 'bg-blue-50 text-blue-700 border-blue-200',
    received: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    installed: 'bg-green-50 text-green-700 border-green-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
    critical: 'bg-red-50 text-red-700 border-red-200',
    high: 'bg-orange-50 text-orange-700 border-orange-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-green-50 text-green-700 border-green-200',
  };
  return (
    <span className={`badge border ${colorMap[status] || 'bg-zinc-100 text-ink-soft border-line'}`}>
      {labels[status] || status}
    </span>
  );
}

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-[2.5px] border-brand-500/25 border-t-brand-500 rounded-full animate-spin" />
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-lg rounded-3xl border border-line-soft bg-surface shadow-apple-lg animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <h2 className="text-base font-semibold text-ink tracking-tight">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn-xs text-lg leading-none">&times;</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-10">
      <div className="animate-slide-up">
        <h1 className="text-3xl lg:text-4xl font-bold text-main tracking-tight">{title}</h1>
        {description && <p className="text-base lg:text-lg text-muted mt-2">{description}</p>}
      </div>
      {action && <div className="animate-scale-in">{action}</div>}
    </div>
  );
}
