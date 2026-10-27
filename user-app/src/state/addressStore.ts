import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlaceValue } from '@/utils/place';

/*
 * (Copied between user-app and partner-app — keep in sync.)
 */

export type AddressKind = 'home' | 'work' | 'other';

/** A place the person saved on the map, with a label of their own. */
export interface SavedAddress {
  id: string;
  kind: AddressKind;
  /** Their own name for an "other" place (e.g. "Mother's house"); empty otherwise. */
  name: string;
  place: PlaceValue;
}

interface AddressState {
  saved: SavedAddress[];
  /** The address shown on Home; null = where the phone is now. */
  selectedId: string | null;
  save: (address: Omit<SavedAddress, 'id'> & { id?: string }) => string;
  remove: (id: string) => void;
  select: (id: string | null) => void;
}

const newId = () => `addr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Saved addresses — kept on the phone only (like Prepare List's lists). Home shows the chosen
 * one, or the current location when none is chosen.
 */
export const useAddressStore = create<AddressState>()(
  persist(
    (set) => ({
      saved: [],
      selectedId: null,
      save: (address) => {
        const id = address.id ?? newId();
        set((state) => {
          const entry: SavedAddress = { id, kind: address.kind, name: address.name.trim(), place: address.place };
          const exists = state.saved.some((item) => item.id === id);
          return {
            saved: exists ? state.saved.map((item) => (item.id === id ? entry : item)) : [...state.saved, entry],
            selectedId: id,
          };
        });
        return id;
      },
      remove: (id) =>
        set((state) => ({
          saved: state.saved.filter((item) => item.id !== id),
          selectedId: state.selectedId === id ? null : state.selectedId,
        })),
      select: (id) => set({ selectedId: id }),
    }),
    { name: 'saved-addresses', storage: createJSONStorage(() => AsyncStorage), version: 1 },
  ),
);

/** Where the chosen saved address is, or null when "Current location" is chosen. */
export function chosenAddressCoords(): { latitude: number; longitude: number } | null {
  const { saved, selectedId } = useAddressStore.getState();
  const chosen = saved.find((item) => item.id === selectedId);
  return chosen ? { latitude: chosen.place.latitude, longitude: chosen.place.longitude } : null;
}
