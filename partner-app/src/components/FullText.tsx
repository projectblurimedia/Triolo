import React, { ReactNode, useRef } from 'react';
import { GestureResponderEvent, NativeSyntheticEvent, Text, TextLayoutEventData, TextProps, ViewProps } from 'react-native';
import { hideFullTextSoon, showFullText } from '@/state/fullTextStore';

// Raw touch events reach a Text too (React Native registers them for every host view); its
// typings just don't list them.
type TouchProps = Pick<
  ViewProps,
  'onTouchStart' | 'onTouchMove' | 'onTouchEnd' | 'onTouchCancel' | 'onMoveShouldSetResponder' | 'onResponderTerminationRequest' | 'onResponderRelease'
>;
const NativeTouchText = Text as unknown as React.ComponentType<TextProps & TouchProps>;

const HOLD_MS = 450;
const MOVE_SLOP = 10;

/** The plain words inside a Text's children (strings, numbers, nested Texts). */
function plainText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(plainText).join('');
  if (React.isValidElement(node)) return plainText((node.props as { children?: ReactNode }).children);
  return '';
}

/**
 * A Text that may be cut off (numberOfLines): when it is, holding it shows the whole text in a
 * bubble above the finger (FullTextHost). It only listens to raw touches, never takes the
 * touch, so a tap still reaches the card around it; the bubble opens as its own window, which
 * makes Android cancel that card's press, so holding doesn't also open the card.
 * (Copied between user-app and partner-app — keep in sync.)
 */
export function FullText({ onTextLayout, onTouchStart, onTouchMove, onTouchEnd, onTouchCancel, children, ...props }: TextProps & TouchProps) {
  const truncated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useRef({ x: 0, y: 0 });
  // The bubble this touch opened (and when): lifting the finger hides it again.
  const openedAt = useRef(0);
  const full = plainText(children);

  const handleLayout = (event: NativeSyntheticEvent<TextLayoutEventData>) => {
    const lines = event.nativeEvent.lines;
    const limit = props.numberOfLines ?? 0;
    const shown = lines.map((line) => line.text).join('').replace(/…$/, '').trim();
    // Cut off: more lines laid out than may show, or what shows is shorter than the text.
    truncated.current = limit > 0 && (lines.length > limit || shown.replace(/\s+/g, '').length < full.replace(/\s+/g, '').length);
    onTextLayout?.(event);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  return (
    <NativeTouchText
      {...props}
      onTextLayout={handleLayout}
      onTouchStart={(event: GestureResponderEvent) => {
        clear();
        const { pageX, pageY } = event.nativeEvent;
        start.current = { x: pageX, y: pageY };
        openedAt.current = 0;
        if (truncated.current && full.trim()) {
          timer.current = setTimeout(() => {
            openedAt.current = Date.now();
            showFullText(full, pageX, pageY);
          }, HOLD_MS);
        }
        onTouchStart?.(event);
      }}
      onTouchMove={(event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        if (Math.abs(pageX - start.current.x) > MOVE_SLOP || Math.abs(pageY - start.current.y) > MOVE_SLOP) clear();
        onTouchMove?.(event);
      }}
      onTouchEnd={(event: GestureResponderEvent) => {
        clear();
        if (openedAt.current) hideFullTextSoon();
        onTouchEnd?.(event);
      }}
      onTouchCancel={(event: GestureResponderEvent) => {
        clear();
        // Cancelled right as the bubble opened (its window took the touch): the lift can't be
        // seen any more, so it closes on its own a little later.
        if (openedAt.current) hideFullTextSoon(Date.now() - openedAt.current < 400 ? 1600 : 700);
        onTouchCancel?.(event);
      }}
      // Once the bubble is open, the next movement takes the touch from the card around it, so
      // letting go doesn't also open the card.
      onMoveShouldSetResponder={() => openedAt.current > 0}
      onResponderTerminationRequest={() => false}
      onResponderRelease={() => {
        if (openedAt.current) hideFullTextSoon();
      }}
    >
      {children}
    </NativeTouchText>
  );
}
