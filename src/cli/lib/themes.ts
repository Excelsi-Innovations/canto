/**
 * Theme system for the dashboard
 */

export type ThemeName = 'dark' | 'light' | 'ocean' | 'forest' | 'sunset';

export interface Theme {
  name: ThemeName;
  colors: {
    primary: string;
    secondary: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    border: string;
    headerBorder: string;
    textDim: string;
    background: string;
    muted: string;
    highlight: string;
  };
}

export const themes: Record<ThemeName, Theme> = {
  dark: {
    name: 'dark',
    colors: {
      primary: 'cyan',
      secondary: 'blue',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'cyan',
      border: 'gray',
      headerBorder: 'cyan',
      textDim: 'white', // Was gray, now white (will rely on dimColor prop if needed)
      background: 'black',
      muted: '#888888', // Brighter gray
      highlight: '#333',
    },
  },
  light: {
    name: 'light',
    colors: {
      primary: 'blue',
      secondary: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'blue',
      border: 'black',
      headerBorder: 'blue',
      textDim: 'gray',
      background: 'white',
      muted: '#666666',
      highlight: '#eee',
    },
  },
  ocean: {
    name: 'ocean',
    colors: {
      primary: 'cyan',
      secondary: 'blue',
      success: 'cyan',
      warning: 'blue',
      error: 'magenta',
      info: 'cyan',
      border: 'blue',
      headerBorder: 'cyan',
      textDim: 'cyan',
      background: '#001',
      muted: '#6688aa', // Brighter blue-gray
      highlight: '#003',
    },
  },
  forest: {
    name: 'forest',
    colors: {
      primary: 'green',
      secondary: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      info: 'green',
      border: 'green',
      headerBorder: 'green',
      textDim: 'green',
      background: '#010',
      muted: '#66aa66', // Brighter green-gray
      highlight: '#020',
    },
  },
  sunset: {
    name: 'sunset',
    colors: {
      primary: 'magenta',
      secondary: 'yellow',
      success: 'yellow',
      warning: 'yellow',
      error: 'red',
      info: 'magenta',
      border: 'yellow',
      headerBorder: 'magenta',
      textDim: 'yellow',
      background: '#300',
      muted: '#aa6666', // Brighter red-gray
      highlight: '#400',
    },
  },
};

export function getTheme(name: ThemeName): Theme {
  return themes[name] || themes.dark;
}

import { loadPreferences } from '../../utils/preferences.js';

export function useTheme(): Theme {
  // Simple hook to get current theme based on preferences
  // Since we don't have a context or listener for init command specifically,
  // we just read once. If dynamic updates are needed, we'd need a context.
  try {
    const prefs = loadPreferences();
    return getTheme(prefs.theme as ThemeName);
  } catch {
    return themes.dark;
  }
}
