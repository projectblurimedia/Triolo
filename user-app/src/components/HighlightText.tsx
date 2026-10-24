import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';
import { fonts, useThemeColors } from '@/theme';

interface HighlightTextProps {
  text: string;
  /** What the person searched; every match (ignoring case) is marked. */
  term?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/** Text with the searched words picked out in blue on a light blue mark. */
export function HighlightText({ text, term, style, numberOfLines }: HighlightTextProps) {
  const { colors } = useThemeColors();
  const needle = term?.trim().toLowerCase() ?? '';
  if (!needle) {
    return (
      <Text style={style} numberOfLines={numberOfLines}>
        {text}
      </Text>
    );
  }
  const parts: { value: string; hit: boolean }[] = [];
  const haystack = text.toLowerCase();
  let from = 0;
  while (from < text.length) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) {
      parts.push({ value: text.slice(from), hit: false });
      break;
    }
    if (at > from) parts.push({ value: text.slice(from, at), hit: false });
    parts.push({ value: text.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, index) =>
        part.hit ? (
          <Text
            key={index}
            style={{ color: colors.primary, fontFamily: fonts.semiBold, backgroundColor: `${colors.primary}1F` }}
          >
            {part.value}
          </Text>
        ) : (
          part.value
        ),
      )}
    </Text>
  );
}

/** True when `text` contains the searched words (ignoring case). */
export function matchesTerm(text: string | null | undefined, term: string): boolean {
  const needle = term.trim().toLowerCase();
  return !!needle && !!text && text.toLowerCase().includes(needle);
}
