import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { takaiIconMap, type TakaiIconKey } from '../theme/icons';
import { tokens } from '../theme/tokens';
import { typographyStyle } from '../theme/typography';

/** A quiet, reusable icon anchor for summaries and navigation — never a status by itself. */
export function IconDisc({ icon, tone = 'sage', size = 40 }: { icon: TakaiIconKey; tone?: 'sage' | 'gold' | 'green'; size?: number }) {
  return <View style={[styles.iconDisc, styles[`iconDisc${tone}`], { borderRadius: size / 2, height: size, width: size }]}><MaterialDesignIcons color={tone === 'green' ? tokens.color.text.inverse : tokens.color.primary.green} name={takaiIconMap[icon]} size={Math.round(size * 0.52)} /></View>;
}

export function AmountSummary({ items }: { items: Array<{ label: string; value: string; icon?: TakaiIconKey }> }) {
  return <View style={styles.amountSummary}>{items.map((item) => <View key={item.label} style={styles.amountItem}>{item.icon ? <IconDisc icon={item.icon} size={32} /> : null}<View style={styles.amountText}><Text numberOfLines={1} style={styles.amountLabel}>{item.label}</Text><Text numberOfLines={1} style={styles.amountValue}>{item.value}</Text></View></View>)}</View>;
}

/** Keep long Thai titles and a money/state slot from competing for the same width. */
export function ListRowTrailing({ children }: { children: ReactNode }) {
  return <View style={styles.trailing}>{children}</View>;
}

/** Native abstract garden shape for hero surfaces; no generated illustration or character reuse. */
export function GardenAccent() {
  return <View pointerEvents="none" style={styles.gardenAccent}><View style={styles.leafOne} /><View style={styles.leafTwo} /><View style={styles.seed} /></View>;
}

const styles = StyleSheet.create({
  iconDisc: { alignItems: 'center', justifyContent: 'center' },
  iconDiscsage: { backgroundColor: tokens.color.surface.sage },
  iconDiscgold: { backgroundColor: tokens.color.surface.gold },
  iconDiscgreen: { backgroundColor: tokens.color.primary.green },
  amountSummary: { flexDirection: 'row', gap: 8 },
  amountItem: { alignItems: 'center', backgroundColor: tokens.color.surface.card, borderColor: tokens.color.border.soft, borderRadius: tokens.radius.row, borderWidth: 1, flex: 1, flexDirection: 'row', gap: 8, minWidth: 0, padding: 10 },
  amountText: { flex: 1, minWidth: 0 },
  amountLabel: { color: tokens.color.text.muted, ...typographyStyle('caption') },
  amountValue: { color: tokens.color.text.primary, fontVariant: ['tabular-nums'], ...typographyStyle('h3') },
  trailing: { alignItems: 'flex-end', flexShrink: 0, gap: 4, minWidth: 80 },
  gardenAccent: { bottom: -18, height: 82, overflow: 'hidden', position: 'absolute', right: -4, width: 130 },
  leafOne: { backgroundColor: tokens.color.surface.sage, borderRadius: 42, height: 86, position: 'absolute', right: 24, top: 18, transform: [{ rotate: '-32deg' }], width: 48 },
  leafTwo: { backgroundColor: tokens.color.surface.gold, borderRadius: 38, height: 70, position: 'absolute', right: -2, top: 4, transform: [{ rotate: '26deg' }], width: 42 },
  seed: { backgroundColor: tokens.color.primary.leaf, borderRadius: 12, height: 24, position: 'absolute', right: 77, top: 13, width: 24 },
});
