import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

// Tab-bar colours (used by the tab layout)
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// App-wide colour tokens — kept here so existing imports keep working.
// The full dynamic (theme-aware) version lives in contexts/theme-context.tsx.
export const AppColors = {
  bg: '#000',
  surface: '#111',
  surfaceHigh: '#1A1A1A',
  border: '#333',
  borderSoft: '#222',
  primary: '#FFEB3B',
  purple: '#4A148C',
  deepBlue: '#1A237E',
  blue: '#2196F3',
  blueDark: '#1565C0',
  pink: '#E91E63',
  green: '#4CAF50',
  greenDark: '#1B5E20',
  red: '#F44336',
  redDark: '#4A0000',
  white: '#FFF',
  black: '#000',
  gray1: '#AAA',
  gray2: '#888',
  gray3: '#555',
  gray4: '#444',
  gray5: '#333',
  selectedBg: '#2A1A4A',
  overlay: 'rgba(0,0,0,0.92)',
  overlayLight: 'rgba(0,0,0,0.9)',
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
