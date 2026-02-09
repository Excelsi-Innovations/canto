import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { UserPreferences, CommandHistory } from './preferences.js';

const PREFS_FILE = join(homedir(), '.canto', 'preferences.json');

/**
 * Manages user preferences with batched writes to avoid blocking I/O.
 * Uses in-memory cache and periodic flushing.
 */
export class PreferencesManager {
  private prefs: UserPreferences;
  private dirty: boolean = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushInterval: number = 5000; // 5 seconds
  private isShuttingDown: boolean = false;

  constructor() {
    this.prefs = this.getDefaultPreferences();
  }

  /**
   * Initialize the preferences manager.
   * Loads preferences from disk and starts auto-flush.
   */
  async initialize(): Promise<void> {
    await this.load();
    this.startAutoFlush();
  }

  /**
   * Shutdown the preferences manager.
   * Flushes any pending changes before exit.
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Final flush
    if (this.dirty) {
      await this.flushAsync();
    }
  }

  /**
   * Load preferences from disk.
   */
  private async load(): Promise<void> {
    try {
      const exists = await fs
        .access(PREFS_FILE)
        .then(() => true)
        .catch(() => false);

      if (exists) {
        const data = await fs.readFile(PREFS_FILE, 'utf-8');
        const prefs = JSON.parse(data);

        // Convert history timestamps back to Date objects
        prefs.history = prefs.history.map((h: Record<string, unknown>) => ({
          ...h,
          timestamp: new Date(h['timestamp'] as string | number | Date),
        }));

        this.prefs = prefs;
      }
    } catch (_error) {
      // Use defaults on error
      this.prefs = this.getDefaultPreferences();
    }
  }

  /**
   * Get default preferences.
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      theme: 'default',
      favorites: [],
      history: [],
      refreshInterval: 3000,
    };
  }

  /**
   * Add a command to history (non-blocking).
   */
  addToHistory(command: string, module?: string, success: boolean = true): void {
    this.prefs.history.unshift({
      command,
      module,
      timestamp: new Date(),
      success,
    });

    // Keep only last 100 commands
    this.prefs.history = this.prefs.history.slice(0, 100);

    this.dirty = true;
    // Write will happen in next flush cycle
  }

  /**
   * Get command history.
   */
  getHistory(limit: number = 20): CommandHistory[] {
    return this.prefs.history.slice(0, limit);
  }

  /**
   * Add a module to favorites.
   */
  addFavorite(moduleName: string): void {
    if (!this.prefs.favorites.includes(moduleName)) {
      this.prefs.favorites.push(moduleName);
      this.dirty = true;
    }
  }

  /**
   * Remove a module from favorites.
   */
  removeFavorite(moduleName: string): void {
    this.prefs.favorites = this.prefs.favorites.filter((f) => f !== moduleName);
    this.dirty = true;
  }

  /**
   * Check if a module is favorited.
   */
  isFavorite(moduleName: string): boolean {
    return this.prefs.favorites.includes(moduleName);
  }

  /**
   * Set the active theme.
   */
  setTheme(themeName: string): void {
    this.prefs.theme = themeName;
    this.dirty = true;
  }

  /**
   * Get current theme name.
   */
  getTheme(): string {
    return this.prefs.theme;
  }

  /**
   * Get all preferences.
   */
  getPreferences(): UserPreferences {
    return { ...this.prefs };
  }

  /**
   * Start auto-flush timer.
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.dirty && !this.isShuttingDown) {
        this.flushAsync();
      }
    }, this.flushInterval);
  }

  /**
   * Flush preferences to disk asynchronously.
   */
  private async flushAsync(): Promise<void> {
    if (!this.dirty) return;

    try {
      const dir = join(homedir(), '.canto');

      // Ensure directory exists
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
      }

      // Write to temp file first (atomic write)
      const tempFile = `${PREFS_FILE}.tmp`;
      await fs.writeFile(tempFile, JSON.stringify(this.prefs, null, 2), 'utf-8');

      // Rename to final file (atomic on most systems)
      await fs.rename(tempFile, PREFS_FILE);

      this.dirty = false;
    } catch (_error) {
      // Silently fail on write errors
    }
  }
}

// Singleton instance
let _preferencesManager: PreferencesManager | null = null;

/**
 * Get the global preferences manager instance.
 */
export function getPreferencesManager(): PreferencesManager {
  if (!_preferencesManager) {
    _preferencesManager = new PreferencesManager();
    _preferencesManager.initialize();
  }
  return _preferencesManager;
}

/**
 * Shutdown the global preferences manager.
 */
export async function shutdownPreferencesManager(): Promise<void> {
  if (_preferencesManager) {
    await _preferencesManager.shutdown();
    _preferencesManager = null;
  }
}
