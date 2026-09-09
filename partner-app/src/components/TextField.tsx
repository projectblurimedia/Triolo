import React from 'react';
import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { colors, typography, useThemeColors } from '@/theme';

interface TextFieldProps extends TextInputProps {
  /** Omit to render the input with no label row at all — used when a caller renders the label itself, above a row that also contains a sibling button/element beside the input (see PhoneVerification's Mobile Number field and the "+ Add New" skill/category inputs) so the sibling can align to the input's own box instead of guessing the label's height. */
  label?: string;
  error?: string;
  /** Optional content absolutely positioned inside the input's right edge, vertically centered (e.g. a verified/pending status icon) — used by PhoneVerification's Mobile Number field. */
  rightIcon?: React.ReactNode;
  /** Overrides/merges into the outer container's style — used to zero out the default marginBottom when this field sits inside a row that manages its own spacing. */
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({ label, error, rightIcon, containerStyle, style, ...inputProps }: TextFieldProps) {
  const { colors: themeColors } = useThemeColors();

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={[styles.label, { color: themeColors.textMuted }]}>{label}</Text> : null}
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            { borderColor: themeColors.border, color: themeColors.text },
            rightIcon ? styles.inputWithIcon : null,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={themeColors.textMuted}
          {...inputProps}
        />
        {rightIcon ? <View style={styles.rightIcon}>{rightIcon}</View> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { ...typography.caption, marginBottom: 6 },
  inputWrap: { justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typography.body,
  },
  inputWithIcon: { paddingRight: 40 },
  rightIcon: { position: 'absolute', right: 14 },
  inputError: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error, marginTop: 4 },
});
