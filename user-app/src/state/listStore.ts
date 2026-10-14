import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PrepareListItem {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

/** A finished list the customer can edit, delete, or send to a shop. */
export interface SavedList {
  id: string;
  name: string;
  items: PrepareListItem[];
  createdAt: string;
  updatedAt: string;
}

/** The list being written right now — a new one, or a copy of a saved one being edited. */
interface Draft {
  listId: string | null;
  name: string;
  items: PrepareListItem[];
}

interface ListState {
  lists: SavedList[];
  draft: Draft;
  isHydrated: boolean;
  // Draft editing
  addItems: (items: Array<Omit<PrepareListItem, 'id'>>) => void;
  updateItem: (id: string, patch: Partial<Omit<PrepareListItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  clearDraftItems: () => void;
  setDraftName: (name: string) => void;
  startNewList: () => void;
  editList: (id: string) => void;
  /** Saves the draft (new list or update) and clears it; returns the list id, or null if it had no items. */
  saveDraft: (fallbackName: string) => string | null;
  discardDraft: () => void;
  deleteList: (id: string) => void;
  setHydrated: () => void;
}

const EMPTY_DRAFT: Draft = { listId: null, name: '', items: [] };

let nextId = 0;
function generateId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${Date.now()}-${nextId}`;
}

/** Only rows with a name are real items — a blank row the user never filled in is dropped. */
function cleanItems(items: PrepareListItem[]): PrepareListItem[] {
  return items
    .map((item) => ({ ...item, name: item.name.trim(), quantity: item.quantity.trim(), unit: item.unit.trim() }))
    .filter((item) => item.name.length > 0);
}

/**
 * Prepare List — the customer's shopping lists, kept only on this device (AsyncStorage via
 * zustand `persist`, same convention as authStore/themeStore). Several lists can be saved; each
 * can be edited, deleted, or sent to a nearby shop to pack (Bazaar orders — the order itself
 * keeps its own copy of the items, so editing a list later never changes a sent order).
 *
 * Version 2 replaced the single `items` list with `lists` + a `draft`; an existing list is
 * carried over as the first saved list.
 */
export const useListStore = create<ListState>()(
  persist(
    (set, get) => ({
      lists: [],
      draft: EMPTY_DRAFT,
      isHydrated: false,
      addItems: (newItems) =>
        set((state) => ({
          draft: {
            ...state.draft,
            items: [...state.draft.items, ...newItems.map((item) => ({ ...item, id: generateId('item') }))],
          },
        })),
      updateItem: (id, patch) =>
        set((state) => ({
          draft: { ...state.draft, items: state.draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) },
        })),
      removeItem: (id) =>
        set((state) => ({ draft: { ...state.draft, items: state.draft.items.filter((item) => item.id !== id) } })),
      clearDraftItems: () => set((state) => ({ draft: { ...state.draft, items: [] } })),
      setDraftName: (name) => set((state) => ({ draft: { ...state.draft, name } })),
      startNewList: () => set({ draft: EMPTY_DRAFT }),
      editList: (id) => {
        const list = get().lists.find((entry) => entry.id === id);
        if (list) set({ draft: { listId: list.id, name: list.name, items: list.items.map((item) => ({ ...item })) } });
      },
      saveDraft: (fallbackName) => {
        const { draft, lists } = get();
        const items = cleanItems(draft.items);
        if (items.length === 0) {
          set({ draft: EMPTY_DRAFT });
          return null;
        }
        const now = new Date().toISOString();
        const name = draft.name.trim() || fallbackName;
        if (draft.listId && lists.some((list) => list.id === draft.listId)) {
          set({
            lists: lists.map((list) => (list.id === draft.listId ? { ...list, name, items, updatedAt: now } : list)),
            draft: EMPTY_DRAFT,
          });
          return draft.listId;
        }
        const id = generateId('list');
        set({ lists: [{ id, name, items, createdAt: now, updatedAt: now }, ...lists], draft: EMPTY_DRAFT });
        return id;
      },
      discardDraft: () => set({ draft: EMPTY_DRAFT }),
      deleteList: (id) => set((state) => ({ lists: state.lists.filter((list) => list.id !== id) })),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'prepare-list-storage',
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ lists: state.lists, draft: state.draft }),
      migrate: (persisted, version) => {
        if (version < 2) {
          const old = (persisted as { items?: PrepareListItem[] }) ?? {};
          const items = cleanItems(old.items ?? []);
          const now = new Date().toISOString();
          return {
            lists: items.length ? [{ id: generateId('list'), name: 'My List', items, createdAt: now, updatedAt: now }] : [],
            draft: EMPTY_DRAFT,
          };
        }
        return persisted as { lists: SavedList[]; draft: Draft };
      },
      // isHydrated must be set via the store's own setHydrated() action (set()), not by
      // mutating `state` directly here — see authStore.ts's identical fix for why a direct
      // mutation bypasses `set()` and can leave subscribers un-notified.
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

/** Display name for a list saved without one, e.g. "List · 14 Oct". */
export function listFallbackName(prefix: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  return `${prefix} · ${now.getDate()} ${months[now.getMonth()]}`;
}
