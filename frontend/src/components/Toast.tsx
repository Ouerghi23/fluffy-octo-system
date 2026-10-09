import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

type ToastType = "success" | "error";
type ToastItem = { id: number; type: ToastType; message: string };
type PushToast = (toast: { type: ToastType; message: string }) => void;

const ToastContext = createContext<PushToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback<PushToast>(({ type, message }) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-3 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex animate-toast-in items-center gap-3 rounded-2xl bg-forest-950 px-5 py-3.5 text-sm text-cream-50 shadow-2xl ring-1 ring-white/10"
          >
            {t.type === "success" ? (
              <CircleCheck size={18} className="text-wheat-300" />
            ) : (
              <CircleAlert size={18} className="text-clay-500" />
            )}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);