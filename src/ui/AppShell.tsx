import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={[styles.base, variant === 'modal' && styles.modal]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {showTabs && variant === 'tabbed' ? (
          <SafeAreaView edges={['bottom']} style={styles.tabs}>
            <BottomTabBar />
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
