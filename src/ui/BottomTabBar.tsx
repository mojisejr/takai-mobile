import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { takaiIconMap, type TakaiIconKey } from '../theme/icons';
import { tokens } from '../theme/tokens';

/** `more` remains an internal compatibility key for the preserved legacy surface; it is not rendered in TAKAI Labor navigation. */
export type BottomTabKey = 'today' | 'work' | 'record' | 'payment' | 'people' | 'more';

type BottomTabBarProps = {
  activeTab?: BottomTabKey;
  onTabPress?: (tab: BottomTabKey) => void;
};

const tabs: Array<{ key: BottomTabKey; label: string; icon: TakaiIconKey }> = [
  { key: 'today', label: 'วันนี้', icon: 'today' },
  { key: 'work', label: 'งาน', icon: 'work' },
  { key: 'record', label: 'บันทึกงาน', icon: 'record' },
  { key: 'payment', label: 'จ่ายเงิน', icon: 'payment' },
  { key: 'people', label: 'คน', icon: 'people' },
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
            <MaterialDesignIcons color={active ? tokens.color.primary.green : tokens.color.text.muted} name={takaiIconMap[tab.icon]} size={20} />
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
    minHeight: 68,
    padding: 5,
  },
  item: {
    alignItems: 'center',
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 48,
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
    fontFamily: tokens.typography.metadata.family,
    fontSize: 10,
    fontWeight: tokens.typography.metadata.weight,
    minWidth: 0,
    textAlign: 'center',
  },
  activeLabel: {
    color: tokens.color.primary.green,
  },
});
