import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
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
    background: string; // Background color (for shadows/depth)
    muted: string; // Muted/secondary text
    highlight: string; // Highlight color for selected items
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
 * Built-in themes with professional hex colors
 */
export const THEMES: Record<string, Theme> = {
  default: {
    name: 'Pessoa',
    colors: {
      primary: '#D8B4FE', // Soft Purple
      success: '#4ADE80', // Bright Green
      error: '#F87171', // Soft Red
      warning: '#FBBF24', // Amber
      info: '#60A5FA', // Blue
      border: '#4C1D95', // Deep Purple
      headerBorder: '#A78BFA', // Light Purple
      background: '#1E1B4B', // Very Dark Purple
      muted: '#8B5CF6', // Muted Purple
      highlight: '#5B21B6', // Purple Highlight
    },
  },
  phosphor: {
    name: 'Phosphor Amber',
    colors: {
      primary: '#FFB000', // Classic amber
      success: '#CCAA00', // Amber-gold
      error: '#FF6633', // Orange-red
      warning: '#FFD700', // Bright gold
      info: '#CC8800', // Dark amber
      border: '#3D2B00', // Dark amber border
      headerBorder: '#FFB000', // Amber
      background: '#0D0A00', // Near black
      muted: '#7A6020', // Muted amber
      highlight: '#4D3500', // Amber selection
    },
  },
  ocean: {
    name: 'Ocean Deep',
    colors: {
      primary: '#7EB8C9', // Desaturated cyan
      success: '#6EBAA8', // Muted aqua
      error: '#C97171', // Soft coral
      warning: '#C9AD5D', // Muted gold
      info: '#8B8FC9', // Soft indigo
      border: '#1E3A5A', // Deep blue
      headerBorder: '#5A9AB5', // Steel blue
      background: '#0F172A', // Slate dark
      muted: '#5A6A7A', // Slate gray
      highlight: '#1E3A5A', // Blue selection
    },
  },
  sunset: {
    name: 'Sunset Glow',
    colors: {
      primary: '#D48BA5', // Muted rose
      success: '#5CB88A', // Soft emerald
      error: '#C95555', // Muted red
      warning: '#C9A040', // Warm amber
      info: '#9A7FC9', // Soft purple
      border: '#5A2A3A', // Dark rose
      headerBorder: '#B56A8A', // Muted pink
      background: '#1F1B24', // Purple-black
      muted: '#7A7580', // Warm gray
      highlight: '#6A2A4A', // Rose selection
    },
  },
  forest: {
    name: 'Forest Night',
    colors: {
      primary: '#5AAA7A', // Soft emerald
      success: '#7AC9A0', // Light sage
      error: '#C97171', // Muted red
      warning: '#C9AD5D', // Soft gold
      info: '#6A9AC9', // Muted blue
      border: '#1A3A2A', // Dark green
      headerBorder: '#4A8A6A', // Forest green
      background: '#14191F', // Dark forest
      muted: '#5A6A5A', // Green gray
      highlight: '#1A4A3A', // Deep green
    },
  },
  tokyo: {
    name: 'Tokyo Night',
    colors: {
      primary: '#7AA2F7', // Blue
      success: '#9ECE6A', // Green
      error: '#F7768E', // Red
      warning: '#E0AF68', // Orange
      info: '#7DCFFF', // Cyan
      border: '#1A1B26', // Background dark
      headerBorder: '#BB9AF7', // Purple
      background: '#16161E', // Darker background
      muted: '#565F89', // Gray blue
      highlight: '#283457', // Selection
    },
  },
  dracula: {
    name: 'Dracula',
    colors: {
      primary: '#BD93F9', // Purple
      success: '#50FA7B', // Green
      error: '#FF5555', // Red
      warning: '#F1FA8C', // Yellow
      info: '#8BE9FD', // Cyan
      border: '#44475A', // Gray
      headerBorder: '#FF79C6', // Pink
      background: '#282A36', // Background
      muted: '#6272A4', // Comment
      highlight: '#44475A', // Selection
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
      prefs.history = prefs.history.map((h: Record<string, unknown>) => ({
        ...h,
        timestamp: new Date(h['timestamp'] as string | number | Date),
      }));

      return prefs;
    }
  } catch (_error) {
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
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(PREFS_FILE, JSON.stringify(prefs, null, 2), 'utf-8');
  } catch (_error) {
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
  return THEMES[prefs.theme] ?? THEMES['default'] ?? ({} as Theme);
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
