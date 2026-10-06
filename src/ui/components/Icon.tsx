const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0',
  alert: 'M12 3 2 20h20L12 3zm0 6v5m0 3v.01',
  shelter: 'M12 3 3 9v12h18V9zM9 21v-7h6v7',
  menu: 'M4 6h16M4 12h16M4 18h16',
  check: 'M9 12l2 2 4-4M5 4h14v16H5z',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zm13-3a5 5 0 0 1 0 8',
  plus: 'M12 5v14M5 12h14',
  users: 'M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6m13 9v-1a4 4 0 0 0-3-3.87M16 4.13a3 3 0 0 1 0 5.75',
  box: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  chart: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  grid: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
  camera: 'M4 7h3l2-3h6l2 3h3v13H4zm8 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  back: 'M15 18l-6-6 6-6',
  wifi: 'M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5v.01',
  wifiOff: 'M2 2l20 20M8.5 16a5 5 0 0 1 7 0M12 19.5v.01M5 12.5a10 10 0 0 1 5-2.7M16.7 10.9a10 10 0 0 1 2.3 1.6M2 9a15 15 0 0 1 4.6-3M11 5a15 15 0 0 1 11 4',
  sync: 'M4 4v5h5M20 20v-5h-5M5.5 15a7 7 0 0 0 12.4 2M18.5 9A7 7 0 0 0 6.1 7',
  rescue: 'M3 17h18l-2 4H5zM12 3v10m-5-5 5 5 5-5',
  file: 'M14 3H6v18h12V7zm0 0v4h4M9 13h6M9 17h6',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
