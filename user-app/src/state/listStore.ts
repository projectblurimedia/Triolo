import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrepareListItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface ListState {
  items: PrepareListItem[];
  isHydrated: boolean;
  addItems: (items: Array<Omit<PrepareListItem, 'id'>>) => void;
  updateItem: (id: string, patch: Partial<Omit<PrepareListItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  clearAll: () => void;
  setHydrated: () => void;
}

let nextId = 0;
function generateId(): string {
  nextId += 1;
  return `item-${Date.now()}-${nextId}`;
}

/**
 * Prepare List items live only on this device (AsyncStorage via zustand `persist`, same
 * convention as authStore/themeStore/settingsStore — see those files) — deliberately never
 * synced to the backend. This is a personal scratch list for voice-drafting a shopping/
 * service list before booking/ordering, not a persisted business record; there is no
 * backend module for it and none is planned (see PrepareListScreen's own doc comment).
 */
export const useListStore = create<ListState>()(
  persist(
    (set) => ({
      items: [],
      isHydrated: false,
      addItems: (newItems) =>
        set((state) => ({
          items: [...state.items, ...newItems.map((item) => ({ ...item, id: generateId() }))],
        })),
      updateItem: (id, patch) =>
        set((state) => ({
          items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        })),
      removeItem: (id) => set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
      clearAll: () => set({ items: [] }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'prepare-list-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ items: state.items }),
      // isHydrated must be set via the store's own setHydrated() action (set()), not by
      // mutating `state` directly here — see authStore.ts's identical fix for why a direct
      // mutation bypasses `set()` and can leave subscribers un-notified.
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
