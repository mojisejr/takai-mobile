import type { ReactNode } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';

export type VariantProps<T extends string> = {
  variant?: T;
};

export type ChildrenProps = {
  children?: ReactNode;
};

export type PressHandler = (event: GestureResponderEvent) => void;

export type SurfaceProps<T extends string> = ChildrenProps &
  VariantProps<T> & {
    style?: StyleProp<ViewStyle>;
    testID?: string;
  };
