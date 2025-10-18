// Toast Management Hook with Context
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast } from '../components/Toast';

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  toasts: Toast[];
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toastData: Omit<Toast, 'id'>): string => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const toast: Toast = {
      id,
      duration: 5000, // Default 5 seconds
      ...toastData,
    };

    setToasts(prev => [...prev, toast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const value: ToastContextType = {
    addToast,
    removeToast,
    removeAllToasts,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
}

// Convenience functions for common toast types
export function useToastHelpers() {
  const { addToast } = useToast();

  const showSuccess = useCallback((title: string, message?: string) => {
    return addToast({
      type: 'success',
      title,
      message,
    });
  }, [addToast]);

  const showError = useCallback((title: string, message?: string, action?: Toast['action']) => {
    return addToast({
      type: 'error',
      title,
      message,
      action,
      duration: 0, // Errors don't auto-dismiss
    });
  }, [addToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    return addToast({
      type: 'warning',
      title,
      message,
      duration: 7000, // Slightly longer for warnings
    });
  }, [addToast]);

  const showInfo = useCallback((title: string, message?: string) => {
    return addToast({
      type: 'info',
      title,
      message,
    });
  }, [addToast]);

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}