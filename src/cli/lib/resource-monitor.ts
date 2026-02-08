import { getSystemResources } from '../../utils/resources/index.js';
import type { SystemResources } from '../../utils/resources.js';

export interface ResourceMonitorConfig {
  updateInterval: number; // milliseconds
  enableCPU: boolean;
  enableMemory: boolean;
}

export type ResourceSubscriber = (resources: SystemResources) => void;

/**
 * Monitors system resources asynchronously without blocking the main thread.
 * Implements a pub/sub pattern for efficient updates.
 */
export class AsyncResourceMonitor {
  private config: ResourceMonitorConfig;
  private latestResources: SystemResources;
  private subscribers: Set<ResourceSubscriber> = new Set();
  private updateTimer: NodeJS.Timer | null = null;
  private isPolling: boolean = false;

  constructor(config: Partial<ResourceMonitorConfig> = {}) {
    this.config = {
      updateInterval: 2000,
      enableCPU: true,
      enableMemory: true,
      ...config,
    };

    // Initialize with default values
    this.latestResources = {
      totalMemory: 0,
      usedMemory: 0,
      freeMemory: 0,
      cpuCount: 1,
      cpuUsage: 0,
    };
  }

  /**
   * Start monitoring system resources.
   * Polls asynchronously in the background.
   */
  start(): void {
    if (this.updateTimer) {
      return; // Already started
    }

    // Initial poll
    this.pollResourcesAsync();

    // Start periodic updates
    this.updateTimer = setInterval(() => {
      this.pollResourcesAsync();
    }, this.config.updateInterval);
  }

  /**
   * Stop monitoring system resources.
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Get the latest cached resource values.
   * This is synchronous and non-blocking.
   */
  getLatestResources(): SystemResources {
    return { ...this.latestResources };
  }

  /**
   * Subscribe to resource updates.
   * Returns an unsubscribe function.
   */
  subscribe(callback: ResourceSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately call with current data
    try {
      callback(this.latestResources);
    } catch {
      // Ignore subscriber errors
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Poll system resources asynchronously.
   * This runs in the background and never blocks.
   * Now uses the cached resource monitoring system.
   */
  private async pollResourcesAsync(): Promise<void> {
    if (this.isPolling) {
      return; // Skip if already polling
    }

    this.isPolling = true;

    try {
      // Use the new cached resource monitoring system
      const resources = await getSystemResources();

      // Only update and notify if values actually changed
      if (this.hasChanged(resources)) {
        this.latestResources = resources;
        this.notifySubscribers(resources);
      }
    } catch (error) {
      // Silently fail, keep using last known values
      // Don't log in production to avoid spam
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Check if resources have changed significantly.
   * Avoids unnecessary re-renders.
   */
  private hasChanged(newResources: SystemResources): boolean {
    const threshold = 0.5; // 0.5% change threshold

    const cpuChanged = Math.abs(newResources.cpuUsage - this.latestResources.cpuUsage) > threshold;
    const memChanged = Math.abs(newResources.usedMemory - this.latestResources.usedMemory) > 10; // 10MB

    return cpuChanged || memChanged;
  }

  /**
   * Notify all subscribers of resource changes.
   */
  private notifySubscribers(resources: SystemResources): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(resources);
      } catch (error) {
        // Ignore subscriber errors
      }
    });
  }
}
