import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolved: 'light' | 'dark';
}

const STORAGE_KEY = 'maintainx.theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content',
    resolved === 'dark' ? '#0f0f12' : '#f5f5f7',
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system';
  });
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : theme,
  );

  useEffect(() => {
    if (theme !== 'system') {
      setResolved(theme);
      applyTheme(theme);
      return;
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      const next = mq.matches ? 'dark' : 'light';
      setResolved(next);
      applyTheme(next);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [theme]);

  function setTheme(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
