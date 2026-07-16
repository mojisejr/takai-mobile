import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';
import { tokens } from '../theme/tokens';
import { BottomTabBar } from './BottomTabBar';
import type { ChildrenProps, VariantProps } from './types';

type AppShellVariant = 'tabbed' | 'modal' | 'detail';

type AppShellProps = ChildrenProps &
  VariantProps<AppShellVariant> & {
    showTabs?: boolean;
  };

export function AppShell({ children, showTabs = true, variant = 'tabbed' }: AppShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.base, variant === 'modal' && styles.modal]}>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
        {showTabs && variant === 'tabbed' ? (
          <View style={styles.tabs}>
            <BottomTabBar />
          </View>
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
    padding: tokens.spacing.page,
  },
  tabs: {
    padding: tokens.spacing.page,
    paddingTop: 8,
  },
});
