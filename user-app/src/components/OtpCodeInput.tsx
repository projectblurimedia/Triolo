import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { fonts, useThemeColors } from '@/theme';

interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  /** Called once every digit is filled in. */
  onComplete?: (value: string) => void;
  hasError?: boolean;
}

/**
 * One box per digit over a single hidden TextInput — typing, pasting and the phone's SMS-code
 * suggestion all land in the real input; the boxes only show it.
 */
export function OtpCodeInput({ value, onChange, length = 6, onComplete, hasError }: OtpCodeInputProps) {
  const { colors } = useThemeColors();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(true);

  // Tapping the boxes (or a wrong code) must always bring the keyboard back. On Android,
  // focusing an input that still counts as focused doesn't reopen it, so let go first.
  const focusInput = () => {
    const input = inputRef.current;
    if (!input) return;
    if (input.isFocused()) {
      input.blur();
      setTimeout(() => input.focus(), 80);
    } else {
      input.focus();
    }
  };

  useEffect(() => {
    if (hasError) focusInput();
  }, [hasError]);

  return (
    <Pressable onPress={focusInput} style={styles.row} accessible={false}>
      {Array.from({ length }).map((_, index) => {
        const digit = value[index] ?? '';
        const active = focused && index === Math.min(value.length, length - 1);
        return (
          <View
            key={index}
            style={[
              styles.box,
              {
                borderColor: hasError ? colors.error : active ? colors.primary : digit ? `${colors.primary}66` : colors.border,
                backgroundColor: digit ? `${colors.primary}0D` : colors.background,
              },
            ]}
          >
            <Text style={[styles.digit, { color: colors.text }]}>{digit}</Text>
            {active && !digit ? <View style={[styles.caret, { backgroundColor: colors.primary }]} /> : null}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/[^0-9]/g, '').slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={length}
        autoFocus
        caretHidden
        style={styles.hiddenInput}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  box: { flex: 1, height: 56, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  // No Android font padding, so the digit sits in the true centre of its box.
  digit: { fontFamily: fonts.semiBold, fontSize: 22, includeFontPadding: false, textAlignVertical: 'center' },
  caret: { position: 'absolute', width: 2, height: 22, borderRadius: 1 },
  hiddenInput: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
