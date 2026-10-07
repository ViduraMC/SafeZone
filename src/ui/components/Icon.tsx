import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

const ICONS = {
  home: 'home-outline',
  bell: 'notifications-outline',
  alert: 'warning-outline',
  shelter: 'business-outline',
  menu: 'menu',
  check: 'checkmark-done-outline',
  megaphone: 'megaphone-outline',
  plus: 'add-circle-outline',
  users: 'people-outline',
  box: 'cube-outline',
  chart: 'bar-chart-outline',
  grid: 'grid-outline',
  phone: 'call-outline',
  pin: 'location-outline',
  camera: 'camera-outline',
  back: 'chevron-back',
  wifi: 'wifi',
  wifiOff: 'cloud-offline-outline',
  sync: 'sync-outline',
  rescue: 'boat-outline',
  file: 'document-text-outline',
  close: 'close',
  chevron: 'chevron-forward',
  down: 'chevron-down',
} as const satisfies Record<string, ComponentProps<typeof Ionicons>['name']>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={ICONS[name]} size={size} color={color} />;
}
