import React, { Fragment, ReactNode, useEffect, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';

/**
 * Renders content in the app's own root window instead of where it's declared. Menus use this
 * instead of a native Modal: on Android a Modal is a separate window, and the glass blur can
 * only see the tab screen when it's drawn in the same window as it (the tab bar and root toast
 * blur for the same reason). Mount one `<PortalHost />` at the app root, above the navigator.
 */
interface PortalState {
  nodes: Record<string, ReactNode>;
  set: (key: string, node: ReactNode) => void;
  remove: (key: string) => void;
}

const usePortalStore = create<PortalState>((set) => ({
  nodes: {},
  set: (key, node) => set((state) => ({ nodes: { ...state.nodes, [key]: node } })),
  remove: (key) =>
    set((state) => {
      const { [key]: _removed, ...rest } = state.nodes;
      return { nodes: rest };
    }),
}));

export function Portal({ children }: { children: ReactNode }) {
  const key = useId();
  const setNode = usePortalStore((state) => state.set);
  const remove = usePortalStore((state) => state.remove);
  // Re-sent on every render so the portaled content stays in step with its props.
  useEffect(() => {
    setNode(key, children);
  });
  useEffect(() => () => remove(key), [key, remove]);
  return null;
}

export function PortalHost() {
  const nodes = usePortalStore((state) => state.nodes);
  const entries = Object.entries(nodes);
  if (entries.length === 0) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {entries.map(([key, node]) => (
        <Fragment key={key}>{node}</Fragment>
      ))}
    </View>
  );
}
