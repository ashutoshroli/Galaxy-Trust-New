import React, { createContext, useContext, useCallback, useState } from 'react';

const ToastContext = createContext(null);

let idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'info', duration = 3500) => {
      const id = ++idCounter;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (duration > 0) setTimeout(() => remove(id), duration);
      return id;
    },
    [remove]
  );

  const toast = {
    info: (m, d) => push(m, 'info', d),
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => remove(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Fallback so components still work if used outside a provider.
  if (!ctx) {
    return {
      info: (m) => console.log('[toast]', m),
      success: (m) => console.log('[toast:success]', m),
      error: (m) => console.error('[toast:error]', m),
    };
  }
  return ctx;
}
