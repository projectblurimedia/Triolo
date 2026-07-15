/**
 * Font family names match the keys @expo-google-fonts/poppins exports via
 * useFonts() in App.tsx — must stay in sync with that call.
 */
export const fonts = {
  regular: 'Poppins_400Regular',
  medium: 'Poppins_500Medium',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
} as const;

export const typography = {
  heading: { fontSize: 22, fontFamily: fonts.bold },
  subheading: { fontSize: 17, fontFamily: fonts.semiBold },
  body: { fontSize: 15, fontFamily: fonts.regular },
  caption: { fontSize: 12, fontFamily: fonts.regular },
};
