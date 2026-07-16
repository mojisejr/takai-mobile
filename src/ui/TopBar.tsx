import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import type { PressHandler, VariantProps } from './types';

type TopBarVariant = 'default' | 'back' | 'action' | 'plot';

type TopBarProps = VariantProps<TopBarVariant> & {
  title: string;
  actionLabel?: string;
  onBackPress?: PressHandler;
  onActionPress?: PressHandler;
};

export function TopBar({ actionLabel, onActionPress, onBackPress, title, variant = 'default' }: TopBarProps) {
  const showBack = variant === 'back' || variant === 'plot';
  const isPlot = variant === 'plot';

  return (
    <View style={[styles.base, isPlot && styles.plot]}>
      {showBack ? (
        <Pressable accessibilityLabel="กลับ" accessibilityRole="button" hitSlop={10} onPress={onBackPress}>
          <Text style={[styles.icon, isPlot && styles.inverseText]}>‹</Text>
        </Pressable>
      ) : (
        <Text style={styles.icon}>☰</Text>
      )}
      <Text numberOfLines={1} style={[styles.title, isPlot && styles.inverseText]}>
        {title}
      </Text>
      {actionLabel ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onActionPress}>
          <Text style={[styles.action, isPlot && styles.inverseText]}>{actionLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.actionSlot} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: tokens.spacing.page,
  },
  plot: {
    backgroundColor: tokens.color.primary.green,
    borderRadius: tokens.radius.card,
  },
  icon: {
    color: tokens.color.text.primary,
    fontSize: 24,
    width: 28,
  },
  title: {
    color: tokens.color.text.primary,
    flex: 1,
    fontSize: tokens.typography.h2.size,
    fontWeight: '700',
  },
  action: {
    color: tokens.color.primary.green,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
  },
  inverseText: {
    color: tokens.color.text.inverse,
  },
  actionSlot: {
    width: 28,
  },
});
