import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Button } from '../components/ui/button';

const ConfirmDialogContext = createContext(null);

export function ConfirmDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setDialog({
        title: options.title || 'Please confirm',
        message: message || 'Are you sure?',
        confirmText: options.confirmText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
        resolve,
      });
    });
  }, []);

  const close = (result) => {
    if (!dialog) return;
    const resolver = dialog.resolve;
    setDialog(null);
    resolver(Boolean(result));
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {dialog && (
        <div className="fixed inset-0 z-[120] bg-black/50 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-2xl">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-neutral-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{dialog.title}</h3>
            </div>
            <div className="px-6 py-5 text-sm text-gray-700 dark:text-gray-300">
              {dialog.message}
            </div>
            <div className="px-6 pb-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => close(false)}>
                {dialog.cancelText}
              </Button>
              <Button
                onClick={() => close(true)}
                className={
                  dialog.variant === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : undefined
                }
              >
                {dialog.confirmText}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  return ctx;
}
