import { Pressable, StyleSheet, Text } from 'react-native';
import { tokens } from '../theme/tokens';
import type { PressHandler, VariantProps } from './types';

type PrimaryButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';

type PrimaryButtonProps = VariantProps<PrimaryButtonVariant> & {
  label: string;
  disabled?: boolean;
  onPress?: PressHandler;
  testID?: string;
};

export function PrimaryButton({ disabled, label, onPress, testID, variant = 'primary' }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, variant !== 'primary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: tokens.radius.button,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: tokens.color.primary.green,
  },
  secondary: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderWidth: 1,
  },
  tertiary: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.state.danger,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: tokens.color.text.inverse,
    fontSize: tokens.typography.body.size,
    fontWeight: '700',
  },
  secondaryLabel: {
    color: tokens.color.primary.green,
  },
});
