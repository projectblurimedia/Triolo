import { create } from 'zustand';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastState {
  toast: ToastMessage | null;
  hideToast: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toast: null,
  hideToast: () => set({ toast: null }),
}));

/** Imperative, callable from anywhere (mutation onSuccess/onError, not just component bodies) — mirrors how Alert.alert was used before. */
export function showToast(toast: Omit<ToastMessage, 'id'>): void {
  nextId += 1;
  useToastStore.setState({ toast: { ...toast, id: nextId } });
}
