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
    background?: string;
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
      textDim: 'gray',
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
      border: 'white',
      headerBorder: 'blue',
      textDim: 'gray',
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
      textDim: 'blue',
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
    },
  },
};

export function getTheme(name: ThemeName): Theme {
  return themes[name] || themes.dark;
}
