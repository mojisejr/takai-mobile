import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import type { PressHandler, VariantProps } from './types';

type RecordListItemVariant = 'activity' | 'case' | 'labor' | 'material' | 'hole';

type RecordListItemProps = VariantProps<RecordListItemVariant> & {
  title: string;
  meta?: string;
  trailing?: string;
  onPress?: PressHandler;
};

export function RecordListItem({ meta, onPress, title, trailing, variant = 'activity' }: RecordListItemProps) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={styles.base}>
      <View style={[styles.marker, styles[variant]]} />
      <View style={styles.content}>
        <Text style={styles.title}>
          {title}
        </Text>
        {meta ? (
          <Text style={styles.meta}>
            {meta}
          </Text>
        ) : null}
      </View>
      {trailing ? (
        <Text style={styles.trailing}>
          {trailing}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: tokens.color.surface.card,
    borderBottomColor: tokens.color.border.soft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingRight: 12,
    paddingVertical: 8,
  },
  marker: {
    borderRadius: tokens.radius.chip,
    height: 10,
    marginHorizontal: 10,
    width: 10,
  },
  activity: {
    backgroundColor: tokens.color.primary.green,
  },
  case: {
    backgroundColor: tokens.color.state.warning,
  },
  labor: {
    backgroundColor: tokens.color.soil.brown,
  },
  material: {
    backgroundColor: tokens.color.state.info,
  },
  hole: {
    backgroundColor: tokens.color.primary.leaf,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.body.size,
    fontWeight: '600',
  },
  meta: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.caption.size,
    marginTop: 2,
  },
  trailing: {
    color: tokens.color.primary.green,
    flexShrink: 0,
    fontSize: tokens.typography.caption.size,
    fontWeight: '700',
    marginLeft: 8,
    maxWidth: 96,
    textAlign: 'right',
  },
});
