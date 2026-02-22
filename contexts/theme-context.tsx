import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ColorSet {
  bg: string;
  surface: string;
  surfaceHigh: string;
  border: string;
  borderSoft: string;
  primary: string;
  purple: string;
  deepBlue: string;
  blue: string;
  blueDark: string;
  pink: string;
  green: string;
  greenDark: string;
  red: string;
  redDark: string;
  white: string;      // primary text / icon color
  black: string;      // text on primary-colored backgrounds (header)
  gray1: string;
  gray2: string;
  gray3: string;
  gray4: string;
  gray5: string;
  selectedBg: string; // selected queue item background
  overlay: string;
  overlayLight: string;
}

export const darkColors: ColorSet = {
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

export const lightColors: ColorSet = {
  bg: '#F2F2F7',
  surface: '#FFFFFF',
  surfaceHigh: '#F0F0F5',
  border: '#D1D1D6',
  borderSoft: '#E5E5EA',
  primary: '#4A148C',   // purple replaces yellow as the accent in light mode
  purple: '#4A148C',
  deepBlue: '#1A237E',
  blue: '#1976D2',
  blueDark: '#1565C0',
  pink: '#C2185B',
  green: '#388E3C',
  greenDark: '#1B5E20',
  red: '#D32F2F',
  redDark: '#FFCDD2',   // light pink for busy court background
  white: '#1C1C1E',     // dark text on light backgrounds
  black: '#FFFFFF',     // light text on primary (purple) header
  gray1: '#3A3A3C',
  gray2: '#636366',
  gray3: '#8E8E93',
  gray4: '#AEAEB2',
  gray5: '#C7C7CC',
  selectedBg: '#EDE7F6',
  overlay: 'rgba(0,0,0,0.6)',
  overlayLight: 'rgba(0,0,0,0.5)',
};

interface ThemeContextType {
  mode: ThemeMode;
  colors: ColorSet;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  colors: darkColors,
  toggleTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then(v => {
      if (v === 'light') setMode('light');
    });
  }, []);

  const toggleTheme = async () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    await AsyncStorage.setItem('theme_mode', next);
  };

  const colors = useMemo(() => (mode === 'dark' ? darkColors : lightColors), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
