import type { TextStyle } from 'react-native';
import { tokens } from './tokens';

export type TypographyRole = keyof typeof tokens.typography;

/** One role map prevents ad-hoc Thai font-family/weight pairs in product screens. */
export const typographyStyle = (role: TypographyRole): TextStyle => {
  const token = tokens.typography[role];
  return { fontFamily: token.family, fontSize: token.size, fontWeight: token.weight };
};
