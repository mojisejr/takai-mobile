import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { typographyStyle } from '../theme/typography';
import { IconDisc } from './NotebookPrimitives';
import type { PressHandler, VariantProps } from './types';

type TopBarVariant = 'default' | 'back' | 'action' | 'plot';

type TopBarProps = VariantProps<TopBarVariant> & {
  title: string;
  actionLabel?: string;
  subtitle?: string;
  hideSubtitle?: boolean;
  onBackPress?: PressHandler;
  onActionPress?: PressHandler;
  onInfoPress?: PressHandler;
};

export function TopBar({ actionLabel, hideSubtitle = false, onActionPress, onBackPress, onInfoPress, subtitle, title, variant = 'default' }: TopBarProps) {
  const showBack = variant === 'back' || variant === 'plot';
  const isPlot = variant === 'plot';

  return (
    <View style={[styles.base, isPlot && styles.plot]}>
      {showBack ? (
        <Pressable accessibilityLabel="กลับ" accessibilityRole="button" hitSlop={10} onPress={onBackPress} style={styles.backButton}>
          <Text style={[styles.icon, isPlot && styles.inverseText]}>‹</Text>
        </Pressable>
      ) : (
        <Image accessible={false} resizeMode="contain" source={require('../../assets/brand/takai-mascot-bust.png')} style={styles.mascot} />
      )}
      <View style={styles.titleBlock}>
        <Text numberOfLines={1} style={[styles.brand, isPlot && styles.inverseText]}>TAKAI</Text>
        {!hideSubtitle ? <Text numberOfLines={1} style={[styles.title, isPlot && styles.inverseText]}>{subtitle ?? title}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onActionPress} style={styles.actionButton}>
          <Text style={[styles.action, isPlot && styles.inverseText]}>{actionLabel}</Text>
        </Pressable>
      ) : onInfoPress ? (
        <Pressable accessibilityLabel="วิธีใช้งาน" accessibilityRole="button" hitSlop={10} onPress={onInfoPress} style={styles.infoButton}>
          {isPlot ? <Text style={[styles.info, styles.inverseText]}>i</Text> : <IconDisc icon="info" size={36} tone="sage" />}
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
    gap: 10,
    minHeight: 72,
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
  mascot: { height: 48, width: 48 },
  titleBlock: { flex: 1, minWidth: 0 },
  brand: { color: tokens.color.primary.green, letterSpacing: 0.8, ...typographyStyle('caption') },
  title: {
    color: tokens.color.text.primary,
    ...typographyStyle('h3'),
  },
  action: {
    color: tokens.color.primary.green,
    ...typographyStyle('metadata'),
  },
  inverseText: {
    color: tokens.color.text.inverse,
  },
  actionSlot: { width: 44 },
  actionButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  backButton: { alignItems: 'center', justifyContent: 'center', minHeight: 44, minWidth: 44 },
  infoButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
  info: { color: tokens.color.primary.green, ...typographyStyle('metadata') },
});
