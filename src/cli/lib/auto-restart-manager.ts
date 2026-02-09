/**
 * Auto-restart manager for failed modules
 */

export interface AutoRestartConfig {
  enabled: boolean;
  maxRetries: number;
  restartDelay: number; // ms
  backoffMultiplier: number; // Exponential backoff
}

export interface ModuleRestartState {
  moduleName: string;
  retryCount: number;
  lastFailure: Date;
  nextRetryAt: Date | null;
  isRestarting: boolean;
}

export const DEFAULT_AUTO_RESTART_CONFIG: AutoRestartConfig = {
  enabled: true,
  maxRetries: 3,
  restartDelay: 5000, // 5 seconds
  backoffMultiplier: 2, // 5s, 10s, 20s...
};

export class AutoRestartManager {
  private restartStates: Map<string, ModuleRestartState> = new Map();
  private config: AutoRestartConfig;
  private restartTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: AutoRestartConfig = DEFAULT_AUTO_RESTART_CONFIG) {
    this.config = config;
  }

  /**
   * Register a module failure
   */
  registerFailure(moduleName: string): boolean {
    if (!this.config.enabled) return false;

    const state = this.restartStates.get(moduleName) ?? {
      moduleName,
      retryCount: 0,
      lastFailure: new Date(),
      nextRetryAt: null,
      isRestarting: false,
    };

    // Check if max retries exceeded
    if (state.retryCount >= this.config.maxRetries) {
      return false; // Don't restart
    }

    // Update state
    state.retryCount++;
    state.lastFailure = new Date();
    state.isRestarting = false;

    // Calculate next retry time with exponential backoff
    const delay =
      this.config.restartDelay * Math.pow(this.config.backoffMultiplier, state.retryCount - 1);
    state.nextRetryAt = new Date(Date.now() + delay);

    this.restartStates.set(moduleName, state);

    return true; // Should restart
  }

  /**
   * Schedule an auto-restart
   */
  scheduleRestart(
    moduleName: string,
    restartFn: () => Promise<void>,
    onScheduled?: (delay: number) => void
  ): void {
    const state = this.restartStates.get(moduleName);
    if (!state?.nextRetryAt) return;

    // Clear existing timer
    this.cancelRestart(moduleName);

    const delay = state.nextRetryAt.getTime() - Date.now();
    if (delay <= 0) {
      // Restart immediately
      this.executeRestart(moduleName, restartFn);
      return;
    }

    // Schedule restart
    if (onScheduled) {
      onScheduled(delay);
    }

    const timer = setTimeout(() => {
      this.executeRestart(moduleName, restartFn);
    }, delay);

    this.restartTimers.set(moduleName, timer);
  }

  /**
   * Execute the restart
   */
  private async executeRestart(moduleName: string, restartFn: () => Promise<void>): Promise<void> {
    const state = this.restartStates.get(moduleName);
    if (!state) return;

    state.isRestarting = true;
    this.restartStates.set(moduleName, state);

    try {
      await restartFn();
      // Success - reset state
      this.resetState(moduleName);
    } catch (_error) {
      // Failed - register another failure
      state.isRestarting = false;
      this.restartStates.set(moduleName, state);
    }
  }

  /**
   * Cancel a scheduled restart
   */
  cancelRestart(moduleName: string): void {
    const timer = this.restartTimers.get(moduleName);
    if (timer) {
      clearTimeout(timer);
      this.restartTimers.delete(moduleName);
    }
  }

  /**
   * Reset restart state for a module (on success)
   */
  resetState(moduleName: string): void {
    this.cancelRestart(moduleName);
    this.restartStates.delete(moduleName);
  }

  /**
   * Get restart state for a module
   */
  getState(moduleName: string): ModuleRestartState | null {
    return this.restartStates.get(moduleName) ?? null;
  }

  /**
   * Get all restart states
   */
  getAllStates(): ModuleRestartState[] {
    return Array.from(this.restartStates.values());
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoRestartConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Cleanup all timers
   */
  cleanup(): void {
    this.restartTimers.forEach((timer) => clearTimeout(timer));
    this.restartTimers.clear();
    this.restartStates.clear();
  }
}
