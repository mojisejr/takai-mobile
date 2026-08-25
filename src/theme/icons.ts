import type { MaterialDesignIconsIconName } from '@react-native-vector-icons/material-design-icons';

export type TakaiIconKey = 'today' | 'work' | 'record' | 'payment' | 'people' | 'manage' | 'chemical' | 'info' | 'garden';

/** The single supported icon vocabulary for the warm garden notebook. */
export const takaiIconMap: Record<TakaiIconKey, MaterialDesignIconsIconName> = {
  today: 'weather-sunny', work: 'calendar-month-outline', record: 'notebook-edit-outline', payment: 'cash-multiple', people: 'account-group-outline', manage: 'tune-variant', chemical: 'flask-outline', info: 'information-outline', garden: 'sprout-outline',
};
