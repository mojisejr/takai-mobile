import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

type EvidenceTimelineVariant = 'case' | 'hole' | 'activity';

export type EvidenceTimelineItem = {
  id: string;
  dateLabel: string;
  dayLabel?: string;
  title: string;
  note?: string;
};

type EvidenceTimelineProps = {
  items: EvidenceTimelineItem[];
  variant?: EvidenceTimelineVariant;
};

export function EvidenceTimeline({ items, variant = 'case' }: EvidenceTimelineProps) {
  return (
    <View style={styles.base}>
      {items.map((item, index) => (
        <View key={item.id} style={styles.row}>
          <View style={styles.rail}>
            <View style={[styles.dot, styles[variant]]} />
            {index < items.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.content}>
            <Text style={styles.date}>{[item.dateLabel, item.dayLabel].filter(Boolean).join('  ')}</Text>
            <Text style={styles.title}>{item.title}</Text>
            {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    gap: 0,
  },
  row: {
    flexDirection: 'row',
  },
  rail: {
    alignItems: 'center',
    width: 26,
  },
  dot: {
    borderRadius: tokens.radius.chip,
    height: 10,
    marginTop: 5,
    width: 10,
  },
  case: {
    backgroundColor: tokens.color.state.warning,
  },
  hole: {
    backgroundColor: tokens.color.primary.leaf,
  },
  activity: {
    backgroundColor: tokens.color.primary.green,
  },
  line: {
    backgroundColor: tokens.color.border.soft,
    flex: 1,
    marginTop: 4,
    width: 2,
  },
  content: {
    flex: 1,
    paddingBottom: 16,
  },
  date: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.caption.size,
  },
  title: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.body.size,
    fontWeight: '700',
    marginTop: 2,
  },
  note: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.metadata.size,
    marginTop: 4,
  },
});
