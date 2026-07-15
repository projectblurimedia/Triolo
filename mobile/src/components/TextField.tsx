import React from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors, typography, useThemeColors } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
}

export function TextField({ label, error, style, ...inputProps }: TextFieldProps) {
  const { colors: themeColors } = useThemeColors();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: themeColors.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { borderColor: themeColors.border, color: themeColors.text },
          error ? styles.inputError : null,
          style,
        ]}
        placeholderTextColor={themeColors.textMuted}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { ...typography.caption, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...typography.body,
  },
  inputError: { borderColor: colors.error },
  error: { ...typography.caption, color: colors.error, marginTop: 4 },
});
