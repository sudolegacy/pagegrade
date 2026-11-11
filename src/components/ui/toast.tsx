'use client';
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const Ctx = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex animate-slide-up items-center gap-2.5 rounded-lg bg-ink px-4 py-2.5 text-[13.5px] text-white shadow-pop">
            {t.tone === 'success' ? <CheckCircle2 className="size-4 text-brand-300" aria-hidden /> : <AlertCircle className="size-4 text-red-300" aria-hidden />}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
