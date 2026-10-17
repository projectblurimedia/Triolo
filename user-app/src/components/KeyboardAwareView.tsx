import React, { PropsWithChildren, useEffect, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, StyleProp, View, ViewStyle } from 'react-native';

/**
 * Keeps a form's focused field visible above the keyboard. The app draws edge-to-edge, so
 * Android doesn't resize the window for the keyboard: this pads the content by the keyboard's
 * height instead, and the ScrollView inside scrolls the focused input into view. iOS uses
 * KeyboardAvoidingView.
 */
export function KeyboardAwareView({ style, children }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (Platform.OS === 'ios') {
    return (
      <KeyboardAvoidingView style={[{ flex: 1 }, style]} behavior="padding">
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <View style={[{ flex: 1, paddingBottom: keyboardHeight }, style]}>{children}</View>;
}
