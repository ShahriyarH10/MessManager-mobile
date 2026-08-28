import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { ColorValue } from 'react-native';

/**
 * Semantic icon set — line icons (Ionicons outline) that match the web app's
 * thin-stroke SVG style, replacing emoji throughout the app.
 */
export type IconName =
  | 'dashboard'
  | 'meals'
  | 'bazar'
  | 'utility'
  | 'rent'
  | 'payments'
  | 'more'
  | 'profile'
  | 'monthlyLog'
  | 'broadcast'
  | 'messInfo'
  | 'changePassword'
  | 'notifications'
  | 'audit'
  | 'analytics'
  | 'fund'
  | 'rules'
  | 'members'
  | 'collect'
  | 'calendar'
  | 'lock'
  | 'unlock'
  | 'entry'
  | 'signout'
  | 'chevron'
  | 'add'
  | 'check'
  | 'close'
  | 'trash'
  | 'retry'
  | 'share'
  | 'day'
  | 'night'
  | 'pin'
  | 'warning'
  | 'viewAsMember'
  | 'switchToManager'
  | 'edit'
  | 'absent'
  | 'present'
  | 'info'
  | 'wifi'
  | 'phone'
  | 'trophy'
  | 'clock';

const MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  dashboard: 'grid-outline',
  meals: 'restaurant-outline',
  bazar: 'cart-outline',
  utility: 'flash-outline',
  rent: 'home-outline',
  payments: 'card-outline',
  more: 'ellipsis-horizontal',
  profile: 'person-outline',
  monthlyLog: 'document-text-outline',
  broadcast: 'megaphone-outline',
  messInfo: 'information-circle-outline',
  changePassword: 'key-outline',
  notifications: 'notifications-outline',
  audit: 'time-outline',
  analytics: 'bar-chart-outline',
  fund: 'wallet-outline',
  rules: 'book-outline',
  members: 'people-outline',
  collect: 'cash-outline',
  calendar: 'calendar-outline',
  lock: 'lock-closed-outline',
  unlock: 'lock-open-outline',
  entry: 'create-outline',
  signout: 'log-out-outline',
  chevron: 'chevron-forward',
  add: 'add',
  check: 'checkmark',
  close: 'close',
  trash: 'trash-outline',
  retry: 'refresh',
  share: 'share-outline',
  day: 'sunny-outline',
  night: 'moon-outline',
  pin: 'bookmark',
  warning: 'warning-outline',
  viewAsMember: 'swap-horizontal-outline',
  switchToManager: 'shield-checkmark-outline',
  edit: 'pencil-outline',
  absent: 'close-circle',
  present: 'checkmark-circle',
  info: 'information-circle-outline',
  wifi: 'wifi-outline',
  phone: 'call-outline',
  trophy: 'trophy-outline',
  clock: 'time-outline',
};

export function Icon({
  name,
  size = 20,
  color,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <Ionicons name={MAP[name]} size={size} color={color as string} />;
}
