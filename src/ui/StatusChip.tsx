import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export type StatusChipVariant =
  | 'today'
  | 'dueSoon'
  | 'overdue'
  | 'active'
  | 'paid'
  | 'unpaid'
  | 'closed'
  | 'archived'
  | 'offline';

type StatusChipProps = {
  label: string;
  variant?: StatusChipVariant;
  testID?: string;
};

export function StatusChip({ label, testID, variant = 'today' }: StatusChipProps) {
  return (
    <View testID={testID} style={[styles.base, styles[variant]]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: tokens.radius.chip,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  today: {
    backgroundColor: '#EAF4EA',
  },
  dueSoon: {
    backgroundColor: '#FFF2CF',
  },
  overdue: {
    backgroundColor: '#FFE1DC',
  },
  active: {
    backgroundColor: '#EAF4EA',
  },
  paid: {
    backgroundColor: '#EAF4EA',
  },
  unpaid: {
    backgroundColor: '#FFE1DC',
  },
  closed: {
    backgroundColor: tokens.color.surface.muted,
  },
  archived: {
    backgroundColor: '#E7F0FB',
  },
  offline: {
    backgroundColor: '#EFE7E2',
  },
  label: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.caption.size,
    fontWeight: '600',
  },
});
