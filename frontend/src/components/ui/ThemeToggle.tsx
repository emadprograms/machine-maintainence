import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Monitor },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    const next: Theme = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
    const Icon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;
    return (
      <button
        type="button"
        onClick={() => setTheme(next)}
        className="btn-ghost btn-xs rounded-full"
        title={`Thème : ${OPTIONS.find(o => o.value === theme)?.label}`}
        aria-label="Changer le thème"
      >
        <Icon className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="inline-flex rounded-full border border-line-soft bg-surface-muted p-1">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
            theme === value
              ? 'bg-surface text-ink shadow-apple-sm'
              : 'text-ink-faint hover:text-ink'
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
