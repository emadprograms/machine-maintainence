import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastCtx {
  toasts: Toast[];
  addToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: string) => void;
}

const Ctx = createContext<ToastCtx>(null!);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = crypto.randomUUID();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <Ctx.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      toasts: [],
      addToast: (_message: string, _type?: Toast['type']) => {},
      removeToast: (_id: string) => {},
    };
  }
  return ctx;
}

const typeStyles: Record<Toast['type'], string> = {
    success: 'border-green-500/30 bg-green-500/10 text-green-400 shadow-green-500/10',
    error: 'border-red-500/30 bg-red-500/10 text-red-400 shadow-red-500/10',
    info: 'border-brand-500/30 bg-brand-500/10 text-brand-400 shadow-brand-500/10',
};

const typeIcons: Record<Toast['type'], string> = {
  success: '✓',
  error: '✕',
  info: '●',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  return (
    <div
      className={`toast ${typeStyles[toast.type]} animate-slide-up pointer-events-auto cursor-pointer`}
      onClick={() => onDismiss(toast.id)}
    >
      <span className="text-lg font-bold">{typeIcons[toast.type]}</span>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}
