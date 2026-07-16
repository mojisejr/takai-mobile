import { StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { FieldCard } from './FieldCard';

type TrackerCardVariant = 'spray' | 'fertilizer' | 'pruning' | 'custom' | 'overdue';

type TrackerCardProps = {
  title: string;
  countLabel: string;
  elapsedLabel: string;
  nextDueLabel?: string;
  progress?: number;
  variant?: TrackerCardVariant;
};

export function TrackerCard({
  countLabel,
  elapsedLabel,
  nextDueLabel,
  progress = 0,
  title,
  variant = 'custom',
}: TrackerCardProps) {
  const clampedProgress = Math.max(0, Math.min(progress, 1));
  return (
    <FieldCard variant={variant === 'overdue' ? 'alert' : 'flat'}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {nextDueLabel ? <Text style={styles.due}>{nextDueLabel}</Text> : null}
      </View>
      <Text style={styles.meta}>{`${countLabel}  ${elapsedLabel}`}</Text>
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${clampedProgress * 100}%` }]} />
      </View>
    </FieldCard>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  title: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.h3.size,
    fontWeight: '700',
  },
  due: {
    color: tokens.color.text.primary,
    fontSize: tokens.typography.metadata.size,
    fontWeight: '700',
  },
  meta: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.metadata.size,
    marginTop: 6,
  },
  track: {
    backgroundColor: tokens.color.surface.muted,
    borderRadius: tokens.radius.chip,
    height: 8,
    marginTop: 10,
    overflow: 'hidden',
  },
  progress: {
    backgroundColor: tokens.color.primary.leaf,
    height: '100%',
  },
});
