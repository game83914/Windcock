export type ToastType = 'default' | 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  hasUndo: boolean;
  onUndo?: () => void | Promise<void>;
}

export interface ConfirmRequest {
  id: number;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number;
  undo?: () => void | Promise<void>;
}

const toasts = ref<ToastItem[]>([]);
const confirms = ref<ConfirmRequest[]>([]);
let nextId = 1;

function pushToast(message: string, options: ToastOptions = {}) {
  const id = nextId++;
  const item: ToastItem = {
    id,
    message,
    type: options.type ?? 'default',
    hasUndo: Boolean(options.undo),
    onUndo: options.undo,
  };
  toasts.value.push(item);
  const duration = options.duration ?? (options.undo ? 6000 : 3200);
  setTimeout(() => dismiss(id), duration);
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((item) => item.id !== id);
}

export function useToast() {
  function show(message: string, options?: ToastOptions) {
    pushToast(message, options);
  }
  function success(message: string, options?: Omit<ToastOptions, 'type'>) {
    pushToast(message, { ...options, type: 'success' });
  }
  function error(message: string, options?: Omit<ToastOptions, 'type'>) {
    pushToast(message, { ...options, type: 'error', duration: 5000 });
  }
  function info(message: string, options?: Omit<ToastOptions, 'type'>) {
    pushToast(message, { ...options, type: 'info' });
  }
  function undoable(message: string, undo?: () => void | Promise<void>, options?: Omit<ToastOptions, 'undo' | 'type'>) {
    pushToast(message, { ...options, type: 'default', undo });
  }

  function confirm(options: Omit<ConfirmRequest, 'id' | 'resolve'>): Promise<boolean> {
    return new Promise((resolve) => {
      confirms.value.push({ ...options, id: nextId++, resolve });
    });
  }

  function resolveConfirm(id: number, ok: boolean) {
    const index = confirms.value.findIndex((item) => item.id === id);
    if (index === -1) return;
    const [item] = confirms.value.splice(index, 1);
    item.resolve(ok);
  }

  return { toasts, confirms, show, success, error, info, undoable, dismiss, confirm, resolveConfirm };
}