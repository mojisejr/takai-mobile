import { tokens } from './theme/tokens';
import {
  AppShell,
  BottomTabBar,
  FieldCard,
  PrimaryButton,
  SectionHeader,
  StatusChip,
  TopBar,
} from './ui';

export const designContract = {
  tokens,
  navigation: ['today', 'work', 'record', 'people', 'more'] as const,
  primitives: {
    AppShell,
    BottomTabBar,
    FieldCard,
    PrimaryButton,
    SectionHeader,
    StatusChip,
    TopBar,
  },
};
