import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { typographyStyle } from '../theme/typography';
import type { PressHandler, VariantProps } from './types';

type SectionHeaderVariant = 'default' | 'compact' | 'withAction';

type SectionHeaderProps = VariantProps<SectionHeaderVariant> & {
  title: string;
  actionLabel?: string;
  onActionPress?: PressHandler;
};

export function SectionHeader({ actionLabel, onActionPress, title, variant = 'default' }: SectionHeaderProps) {
  return (
    <View style={[styles.base, variant === 'compact' && styles.compact]}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  compact: {
    minHeight: 28,
  },
  title: {
    color: tokens.color.text.primary,
    ...typographyStyle('h2'),
  },
  action: {
    color: tokens.color.primary.green,
    ...typographyStyle('metadata'),
  },
});
