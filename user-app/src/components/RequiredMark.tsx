import React from 'react';
import { Text } from 'react-native';
import { colors } from '@/theme';

/**
 * The red " *" after a required field's label. Nested inside the label's own <Text>, so it takes
 * the label's font and size. (Copied between user-app and partner-app — keep in sync.)
 */
export function RequiredMark() {
  return <Text style={{ color: colors.error }}> *</Text>;
}
