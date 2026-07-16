import { StyleSheet, View } from 'react-native';
import { tokens } from '../theme/tokens';
import type { SurfaceProps } from './types';

type FieldCardVariant = 'flat' | 'raised' | 'alert' | 'summary';

export function FieldCard({ children, style, testID, variant = 'flat' }: SurfaceProps<FieldCardVariant>) {
  return <View testID={testID} style={[styles.base, styles[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    padding: 14,
  },
  flat: {},
  raised: {
    shadowColor: tokens.color.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  alert: {
    borderColor: tokens.color.state.warning,
    backgroundColor: '#FFF9E8',
  },
  summary: {
    backgroundColor: tokens.color.surface.muted,
  },
});
