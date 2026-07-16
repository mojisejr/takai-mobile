import { Pressable, StyleSheet, Text, View } from 'react-native';
import { tokens } from '../theme/tokens';

export type BottomTabKey = 'today' | 'plots' | 'activity' | 'cases' | 'menu';

type BottomTabBarProps = {
  activeTab?: BottomTabKey;
  onTabPress?: (tab: BottomTabKey) => void;
};

const tabs: Array<{ key: BottomTabKey; label: string }> = [
  { key: 'today', label: 'วันนี้' },
  { key: 'plots', label: 'แปลง' },
  { key: 'activity', label: 'บันทึก' },
  { key: 'cases', label: 'เคส' },
  { key: 'menu', label: 'เมนู' },
];

export function BottomTabBar({ activeTab = 'today', onTabPress }: BottomTabBarProps) {
  return (
    <View style={styles.base}>
      {tabs.map((tab) => {
        const active = tab.key === activeTab;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={tab.key}
            onPress={() => onTabPress?.(tab.key)}
            style={[styles.item, active && styles.activeItem]}
          >
            <Text style={[styles.label, active && styles.activeLabel]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: tokens.color.surface.card,
    borderColor: tokens.color.border.soft,
    borderRadius: tokens.radius.card,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 58,
    padding: 6,
  },
  item: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  activeItem: {
    backgroundColor: '#EAF4EA',
    borderRadius: tokens.radius.button,
  },
  label: {
    color: tokens.color.text.muted,
    fontSize: tokens.typography.caption.size,
    fontWeight: '600',
  },
  activeLabel: {
    color: tokens.color.primary.green,
  },
});
