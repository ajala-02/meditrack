import { createContext, useContext, useState, useCallback } from "react";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000); // auto-hide after 5s
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-5 py-3 rounded-xl shadow-xl border text-sm font-medium text-white animate-fade-in flex items-center gap-2 max-w-sm pointer-events-auto ${
              t.type === "critical"
                ? "bg-[rgba(239,68,68,0.9)] border-red-500 shadow-[0_4px_20px_rgba(239,68,68,0.3)]"
                : t.type === "watch"
                ? "bg-[rgba(245,158,11,0.9)] border-amber-500 shadow-[0_4px_20px_rgba(245,158,11,0.3)]"
                : "bg-[rgba(99,102,241,0.9)] border-indigo-500 shadow-[0_4px_20px_rgba(99,102,241,0.3)]"
            }`}
          >
            <span className="text-lg">
              {t.type === "critical" ? "🚨" : t.type === "watch" ? "⚠️" : "ℹ️"}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
