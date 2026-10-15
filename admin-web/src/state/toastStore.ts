import { create } from 'zustand';

export interface Toast {
  id: number;
  variant: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

/** Callable from anywhere (like the apps' showToast); gone after a few seconds or on click. */
export function showToast(toast: Omit<Toast, 'id'>): void {
  const id = nextId++;
  useToastStore.setState((state) => ({ toasts: [...state.toasts.slice(-2), { ...toast, id }] }));
  setTimeout(() => useToastStore.getState().dismiss(id), 3800);
}
