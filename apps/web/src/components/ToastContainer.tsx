// Toast Container Component
import React from 'react';
import { useToast } from '../hooks/useToast';
import { ToastComponent } from './Toast';

export function ToastContainer(): React.ReactElement {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) {
    return <></>;
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastComponent
            {...toast}
            onDismiss={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}