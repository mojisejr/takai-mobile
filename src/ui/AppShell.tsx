import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens';
import { BottomTabBar } from './BottomTabBar';
import { GardenAccent } from './NotebookPrimitives';
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
    /** Shared form surface.  Android behavior remains operator-verified, not assumed. */
    keyboardAware?: boolean;
  };

export function AppShell({ activeTab, children, keyboardAware = false, onTabPress, showTabs = true, scrollEnabled = true, variant = 'tabbed' }: AppShellProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    if (!keyboardAware) return;
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, [keyboardAware]);
  const content = scrollEnabled ? <ScrollView automaticallyAdjustKeyboardInsets={keyboardAware} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    {children}
  </ScrollView> : <View style={styles.staticContent}>{children}</View>;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={[styles.base, variant === 'modal' && styles.modal]}>
        {variant === 'tabbed' ? <GardenAccent /> : null}
        {keyboardAware ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardSurface}>{content}</KeyboardAvoidingView> : content}
        {showTabs && variant === 'tabbed' && !keyboardOpen ? (
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
    overflow: 'hidden',
  },
  keyboardSurface: { flex: 1 },
  modal: {
    backgroundColor: tokens.color.surface.card,
  },
  content: {
    alignItems: 'stretch',
    gap: tokens.spacing.section,
    padding: tokens.spacing.page,
    paddingBottom: tokens.spacing.page,
  },
  staticContent: { flex: 1, gap: tokens.spacing.section, paddingHorizontal: tokens.spacing.page, paddingTop: tokens.spacing.page },
  tabs: {
    backgroundColor: tokens.color.surface.sand,
    padding: tokens.spacing.page,
    paddingTop: 8,
  },
});
