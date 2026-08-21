import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { BottomTabBar } from './BottomTabBar';
import type { BottomTabKey } from './BottomTabBar';
import type { ChildrenProps, VariantProps } from './types';

type AppShellVariant = 'tabbed' | 'modal' | 'detail';

type AppShellProps = ChildrenProps &
  VariantProps<AppShellVariant> & {
    activeTab?: BottomTabKey;
    onTabPress?: (tab: BottomTabKey) => void;
    showTabs?: boolean;
    /** A screen with its own FlatList must own the vertical scroll surface. */
    scrollEnabled?: boolean;
  };

export function AppShell({ activeTab, children, onTabPress, showTabs = true, scrollEnabled = true, variant = 'tabbed' }: AppShellProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={[styles.base, variant === 'modal' && styles.modal]}>
        <ScrollView contentContainerStyle={styles.content} scrollEnabled={scrollEnabled} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {showTabs && variant === 'tabbed' ? (
          <SafeAreaView edges={['bottom']} style={styles.tabs}>
            <BottomTabBar activeTab={activeTab} onTabPress={onTabPress} />
          </SafeAreaView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: tokens.color.surface.sand,
    flex: 1,
  },
  base: {
    backgroundColor: tokens.color.surface.sand,
    flex: 1,
  },
  modal: {
    backgroundColor: tokens.color.surface.card,
  },
  content: {
    alignItems: 'stretch',
    gap: tokens.spacing.section,
    padding: tokens.spacing.page,
    paddingBottom: 8,
  },
  tabs: {
    backgroundColor: tokens.color.surface.sand,
    padding: tokens.spacing.page,
    paddingTop: 8,
  },
});
