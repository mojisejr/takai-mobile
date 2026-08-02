import { Children, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { tokens } from '../theme/tokens';
import type { PressHandler } from './types';

/** A quiet notebook list: the outer card owns the border, corners, and dividers. */
export function LedgerListCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const rows = Children.toArray(children).filter(Boolean);
  return <View style={[styles.card, style]}>{rows.map((row, index) => <View key={index} style={index < rows.length - 1 ? styles.divider : undefined}>{row}</View>)}</View>;
}

export function LedgerListRow({ accessibilityLabel, children, onPress, style }: { children: ReactNode; onPress?: PressHandler; accessibilityLabel?: string; style?: StyleProp<ViewStyle> }) {
  const content = <View style={[styles.row, style]}>{children}</View>;
  return onPress ? <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={styles.pressable}>{content}</Pressable> : content;
}

export function LedgerTrailing({ children }: { children: ReactNode }) {
  return <View style={styles.trailing}>{children}</View>;
}

export function LedgerRowText({ detail, title }: { title: string; detail?: string }) {
  return <View style={styles.text}><Text numberOfLines={1} style={styles.title}>{title}</Text>{detail ? <Text numberOfLines={2} style={styles.detail}>{detail}</Text> : null}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.card, borderWidth: 1, overflow: 'hidden' },
  divider: { borderBottomColor: tokens.color.border.soft, borderBottomWidth: 1 },
  pressable: { minHeight: 52 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 10, minHeight: 58, paddingHorizontal: tokens.spacing.row, paddingVertical: 10 },
  text: { flex: 1, minWidth: 0 },
  title: { color: tokens.color.text.primary, fontSize: tokens.typography.body.size, fontWeight: '700' },
  detail: { color: tokens.color.text.muted, fontSize: tokens.typography.caption.size, lineHeight: 17, marginTop: 2 },
  trailing: { alignItems: 'flex-end', flexShrink: 0, gap: 4, minWidth: 80 },
});
