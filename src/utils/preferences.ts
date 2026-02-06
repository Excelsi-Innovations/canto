import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * Color theme configuration
 */
export interface Theme {
  name: string;
  colors: {
    primary: string; // Main accent color
    success: string; // Success states
    error: string; // Error states
    warning: string; // Warning states
    info: string; // Info messages
    border: string; // Border color
    headerBorder: string; // Header border
  };
}

/**
 * User preferences
 */
export interface UserPreferences {
  theme: string; // Theme name
  favorites: string[]; // Favorite module names
  history: CommandHistory[];
  refreshInterval: number; // Dashboard refresh interval in ms
}

/**
 * Command history entry
 */
export interface CommandHistory {
  command: string;
  module?: string;
  timestamp: Date;
  success: boolean;
}

/**
 * Built-in themes
 */
export const THEMES: Record<string, Theme> = {
  default: {
    name: 'Default (Cyan)',
    colors: {
      primary: 'cyan',
      success: 'green',
      error: 'red',
      warning: 'yellow',
      info: 'blue',
      border: 'gray',
      headerBorder: 'cyan',
    },
  },
  ocean: {
    name: 'Ocean (Blue)',
    colors: {
      primary: 'blue',
      success: 'cyan',
      error: 'red',
      warning: 'yellow',
      info: 'magenta',
      border: 'blue',
      headerBorder: 'blue',
    },
  },
  sunset: {
    name: 'Sunset (Magenta)',
    colors: {
      primary: 'magenta',
      success: 'green',
      error: 'red',
      warning: 'yellow',
      info: 'cyan',
      border: 'magenta',
      headerBorder: 'magenta',
    },
  },
  forest: {
    name: 'Forest (Green)',
    colors: {
      primary: 'green',
      success: 'cyan',
      error: 'red',
      warning: 'yellow',
      info: 'blue',
      border: 'green',
      headerBorder: 'green',
    },
  },
  monochrome: {
    name: 'Monochrome (Gray)',
    colors: {
      primary: 'white',
      success: 'white',
      error: 'white',
      warning: 'white',
      info: 'white',
      border: 'gray',
      headerBorder: 'white',
    },
  },
};

const PREFS_FILE = join(homedir(), '.canto', 'preferences.json');

/**
 * Load user preferences from disk
 *
 * @returns User preferences
 */
export function loadPreferences(): UserPreferences {
  try {
    if (existsSync(PREFS_FILE)) {
      const data = readFileSync(PREFS_FILE, 'utf-8');
      const prefs = JSON.parse(data);
      
      // Convert history timestamps back to Date objects
      prefs.history = prefs.history.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp),
      }));
      
      return prefs;
    }
  } catch (error) {
    // Ignore errors, return defaults
  }

  return {
    theme: 'default',
    favorites: [],
    history: [],
    refreshInterval: 3000,
  };
}

/**
 * Save user preferences to disk
 *
 * @param prefs - User preferences to save
 */
export function savePreferences(prefs: UserPreferences): void {
  try {
    const dir = join(homedir(), '.canto');
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }

    writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail
  }
}

/**
 * Add a module to favorites
 *
 * @param moduleName - Name of the module
 */
export function addFavorite(moduleName: string): void {
  const prefs = loadPreferences();
  if (!prefs.favorites.includes(moduleName)) {
    prefs.favorites.push(moduleName);
    savePreferences(prefs);
  }
}

/**
 * Remove a module from favorites
 *
 * @param moduleName - Name of the module
 */
export function removeFavorite(moduleName: string): void {
  const prefs = loadPreferences();
  prefs.favorites = prefs.favorites.filter((f) => f !== moduleName);
  savePreferences(prefs);
}

/**
 * Check if a module is favorited
 *
 * @param moduleName - Name of the module
 * @returns True if favorited
 */
export function isFavorite(moduleName: string): boolean {
  const prefs = loadPreferences();
  return prefs.favorites.includes(moduleName);
}

/**
 * Add a command to history
 *
 * @param command - Command executed
 * @param module - Module name (optional)
 * @param success - Whether command succeeded
 */
export function addToHistory(command: string, module?: string, success: boolean = true): void {
  const prefs = loadPreferences();
  
  prefs.history.unshift({
    command,
    module,
    timestamp: new Date(),
    success,
  });

  // Keep only last 100 commands
  prefs.history = prefs.history.slice(0, 100);
  
  savePreferences(prefs);
}

/**
 * Get command history
 *
 * @param limit - Maximum number of entries to return
 * @returns Command history
 */
export function getHistory(limit: number = 20): CommandHistory[] {
  const prefs = loadPreferences();
  return prefs.history.slice(0, limit);
}

/**
 * Set the active theme
 *
 * @param themeName - Name of the theme
 */
export function setTheme(themeName: string): void {
  if (!THEMES[themeName]) {
    throw new Error(`Theme "${themeName}" not found`);
  }

  const prefs = loadPreferences();
  prefs.theme = themeName;
  savePreferences(prefs);
}

/**
 * Get the current theme
 *
 * @returns Theme configuration
 */
export function getTheme(): Theme {
  const prefs = loadPreferences();
  return THEMES[prefs.theme] ?? THEMES['default']!;
}

/**
 * Get all available themes
 *
 * @returns Array of theme names and descriptions
 */
export function getAvailableThemes(): Array<{ name: string; description: string }> {
  return Object.entries(THEMES).map(([key, theme]) => ({
    name: key,
    description: theme.name,
  }));
}
