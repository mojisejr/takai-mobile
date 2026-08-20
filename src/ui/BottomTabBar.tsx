import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { tokens } from '../theme/tokens';

/** `more` remains an internal compatibility key for the preserved legacy surface; it is not rendered in TAKAI Labor navigation. */
export type BottomTabKey = 'today' | 'work' | 'record' | 'payment' | 'people' | 'more';

type BottomTabBarProps = {
  activeTab?: BottomTabKey;
  onTabPress?: (tab: BottomTabKey) => void;
};

const tabs: Array<{ key: BottomTabKey; label: string }> = [
  { key: 'today', label: 'วันนี้' },
  { key: 'work', label: 'งาน' },
  { key: 'record', label: 'บันทึกงาน' },
  { key: 'payment', label: 'จ่ายเงิน' },
  { key: 'people', label: 'คน' },
];

export function BottomTabBar({ activeTab = 'today', onTabPress }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const barWidth = Math.max(0, width - tokens.spacing.page * 2);
  return (
    <View style={[styles.base, { width: barWidth }]}>
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
            <Text
              adjustsFontSizeToFit
              ellipsizeMode="tail"
              minimumFontScale={0.72}
              numberOfLines={1}
              style={[styles.label, active && styles.activeLabel]}
            >
              {tab.label}
            </Text>
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
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  activeItem: {
    backgroundColor: '#EAF4EA',
    borderRadius: tokens.radius.button,
  },
  label: {
    color: tokens.color.text.muted,
    // Five labels must remain legible in the 320 px notebook shell.
    fontSize: 10,
    fontWeight: '600',
    minWidth: 0,
    textAlign: 'center',
  },
  activeLabel: {
    color: tokens.color.primary.green,
  },
});
