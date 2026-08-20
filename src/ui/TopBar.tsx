import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import type { PressHandler, VariantProps } from './types';

type TopBarVariant = 'default' | 'back' | 'action' | 'plot';

type TopBarProps = VariantProps<TopBarVariant> & {
  title: string;
  actionLabel?: string;
  subtitle?: string;
  onBackPress?: PressHandler;
  onActionPress?: PressHandler;
  onInfoPress?: PressHandler;
};

export function TopBar({ actionLabel, onActionPress, onBackPress, onInfoPress, subtitle, title, variant = 'default' }: TopBarProps) {
  const showBack = variant === 'back' || variant === 'plot';
  const isPlot = variant === 'plot';

  return (
    <View style={[styles.base, isPlot && styles.plot]}>
      {showBack ? (
        <Pressable accessibilityLabel="กลับ" accessibilityRole="button" hitSlop={10} onPress={onBackPress}>
          <Text style={[styles.icon, isPlot && styles.inverseText]}>‹</Text>
        </Pressable>
      ) : (
        <Image accessible={false} resizeMode="contain" source={require('../../assets/brand/takai-mascot-bust.png')} style={styles.mascot} />
      )}
      <View style={styles.titleBlock}>
        <Text numberOfLines={1} style={[styles.brand, isPlot && styles.inverseText]}>TAKAI</Text>
        <Text numberOfLines={1} style={[styles.title, isPlot && styles.inverseText]}>{subtitle ?? title}</Text>
      </View>
      {actionLabel ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onActionPress}>
          <Text style={[styles.action, isPlot && styles.inverseText]}>{actionLabel}</Text>
        </Pressable>
      ) : onInfoPress ? (
        <Pressable accessibilityLabel="วิธีใช้งาน" accessibilityRole="button" hitSlop={10} onPress={onInfoPress} style={styles.infoButton}>
          <Text style={[styles.info, isPlot && styles.inverseText]}>i</Text>
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
  mascot: { height: 34, width: 34 },
  titleBlock: { flex: 1, minWidth: 0 },
  brand: { color: tokens.color.primary.green, fontSize: tokens.typography.caption.size, fontWeight: '800', letterSpacing: 0.8 },
  title: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.body.size,
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
  infoButton: { alignItems: 'center', borderColor: tokens.color.border.soft, borderRadius: 14, borderWidth: 1, height: 28, justifyContent: 'center', width: 28 },
  info: { color: tokens.color.primary.green, fontSize: tokens.typography.metadata.size, fontWeight: '800' },
});
