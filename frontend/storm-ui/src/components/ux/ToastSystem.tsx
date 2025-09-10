'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
  X,
  Loader2,
  ExternalLink,
  Download,
  Copy,
} from 'lucide-react';
import { Button } from '../ui/button';

interface Toast {
  id: string;
  title: string;
  message?: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  duration?: number;
  persistent?: boolean;
  actions?: ToastAction[];
  data?: any;
}

interface ToastAction {
  label: string;
  action: (data?: any) => void;
  variant?: 'default' | 'outline' | 'ghost';
  icon?: React.ComponentType<any>;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  removeAllToasts: () => void;
  updateToast: (id: string, updates: Partial<Toast>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Toast provider component
export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = {
        ...toast,
        id,
        duration:
          toast.duration ?? (toast.type === 'loading' ? undefined : 5000),
      };

      setToasts(prev => [...prev, newToast]);

      // Auto-remove toast after duration (unless persistent or loading)
      if (
        !newToast.persistent &&
        newToast.type !== 'loading' &&
        newToast.duration
      ) {
        setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
      }

      return id;
    },
    [removeToast]
  );

  const removeAllToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const updateToast = useCallback((id: string, updates: Partial<Toast>) => {
    setToasts(prev =>
      prev.map(toast => (toast.id === id ? { ...toast, ...updates } : toast))
    );
  }, []);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        addToast,
        removeToast,
        removeAllToasts,
        updateToast,
      }}
    >
      {children}
      <ToastContainer />
    </ToastContext.Provider>
  );
};

// Individual toast component
const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
  const { removeToast } = useToast();

  const getToastStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          bg: 'bg-green-50 border-green-200',
          icon: CheckCircle,
          iconColor: 'text-green-500',
          titleColor: 'text-green-800',
          messageColor: 'text-green-700',
        };
      case 'error':
        return {
          bg: 'bg-red-50 border-red-200',
          icon: XCircle,
          iconColor: 'text-red-500',
          titleColor: 'text-red-800',
          messageColor: 'text-red-700',
        };
      case 'warning':
        return {
          bg: 'bg-yellow-50 border-yellow-200',
          icon: AlertCircle,
          iconColor: 'text-yellow-500',
          titleColor: 'text-yellow-800',
          messageColor: 'text-yellow-700',
        };
      case 'loading':
        return {
          bg: 'bg-blue-50 border-blue-200',
          icon: Loader2,
          iconColor: 'text-blue-500',
          titleColor: 'text-blue-800',
          messageColor: 'text-blue-700',
        };
      default:
        return {
          bg: 'bg-gray-50 border-gray-200',
          icon: Info,
          iconColor: 'text-gray-500',
          titleColor: 'text-gray-800',
          messageColor: 'text-gray-700',
        };
    }
  };

  const styles = getToastStyles();
  const IconComponent = styles.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      layout
      className={`w-full max-w-md ${styles.bg} pointer-events-auto rounded-lg border p-4 shadow-lg`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 pt-0.5">
          <IconComponent
            className={`h-5 w-5 ${styles.iconColor} ${toast.type === 'loading' ? 'animate-spin' : ''}`}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${styles.titleColor}`}>
            {toast.title}
          </p>
          {toast.message && (
            <p className={`mt-1 text-sm ${styles.messageColor}`}>
              {toast.message}
            </p>
          )}

          {/* Actions */}
          {toast.actions && toast.actions.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              {toast.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={() => action.action(toast.data)}
                  className="h-8 text-xs"
                >
                  {action.icon && <action.icon className="mr-1.5 h-3 w-3" />}
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Close button */}
        <div className="flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => removeToast(toast.id)}
            className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar for timed toasts */}
      {toast.duration && !toast.persistent && toast.type !== 'loading' && (
        <motion.div
          className="absolute bottom-0 left-0 h-1 rounded-b-lg bg-current opacity-20"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        />
      )}
    </motion.div>
  );
};

// Toast container component
const ToastContainer: React.FC = () => {
  const { toasts } = useToast();

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-md flex-col gap-2">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Convenience hook for common toast patterns
export const useToastActions = () => {
  const { addToast, updateToast, removeToast } = useToast();

  const showSuccess = useCallback(
    (title: string, message?: string, actions?: ToastAction[]) => {
      return addToast({ title, message, type: 'success', actions });
    },
    [addToast]
  );

  const showError = useCallback(
    (title: string, message?: string, actions?: ToastAction[]) => {
      return addToast({
        title,
        message,
        type: 'error',
        actions,
        persistent: true,
      });
    },
    [addToast]
  );

  const showWarning = useCallback(
    (title: string, message?: string, actions?: ToastAction[]) => {
      return addToast({ title, message, type: 'warning', actions });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (title: string, message?: string, actions?: ToastAction[]) => {
      return addToast({ title, message, type: 'info', actions });
    },
    [addToast]
  );

  const showLoading = useCallback(
    (title: string, message?: string) => {
      return addToast({ title, message, type: 'loading', persistent: true });
    },
    [addToast]
  );

  const showProgress = useCallback(
    (title: string, message?: string, duration?: number) => {
      const toastId = addToast({
        title,
        message,
        type: 'loading',
        persistent: true,
        data: { progress: 0 },
      });

      const updateProgress = (progress: number, newMessage?: string) => {
        updateToast(toastId, {
          message: newMessage || message,
          data: { progress: Math.min(100, Math.max(0, progress)) },
        });
      };

      const complete = (successTitle?: string, successMessage?: string) => {
        updateToast(toastId, {
          title: successTitle || title,
          message: successMessage,
          type: 'success',
          persistent: false,
          duration: 3000,
        });
      };

      const fail = (errorTitle?: string, errorMessage?: string) => {
        updateToast(toastId, {
          title: errorTitle || title,
          message: errorMessage,
          type: 'error',
          persistent: true,
        });
      };

      return { toastId, updateProgress, complete, fail };
    },
    [addToast, updateToast]
  );

  const showWithActions = useCallback(
    (
      type: Toast['type'],
      title: string,
      message: string,
      actions: ToastAction[]
    ) => {
      return addToast({ title, message, type, actions, persistent: true });
    },
    [addToast]
  );

  // Pre-configured action creators
  const createCopyAction = useCallback(
    (text: string): ToastAction => ({
      label: 'Copy',
      icon: Copy,
      action: () => {
        navigator.clipboard.writeText(text);
        showSuccess('Copied to clipboard');
      },
    }),
    [showSuccess]
  );

  const createDownloadAction = useCallback(
    (url: string, filename?: string): ToastAction => ({
      label: 'Download',
      icon: Download,
      action: () => {
        const a = document.createElement('a');
        a.href = url;
        if (filename) a.download = filename;
        a.click();
      },
    }),
    []
  );

  const createViewAction = useCallback(
    (url: string): ToastAction => ({
      label: 'View',
      icon: ExternalLink,
      action: () => window.open(url, '_blank'),
    }),
    []
  );

  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showLoading,
    showProgress,
    showWithActions,
    createCopyAction,
    createDownloadAction,
    createViewAction,
    updateToast,
    removeToast,
  };
};
