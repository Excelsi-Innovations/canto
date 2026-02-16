import { getGlobalResources } from '../../utils/resources/index.js';
import type { GlobalResources } from '../../utils/resources/index.js';

export interface ResourceMonitorConfig {
  updateInterval: number; // milliseconds
}

export type ResourceSubscriber = (resources: GlobalResources) => void;
export type PIDProvider = () => number[];

/**
 * Monitors system and process resources asynchronously without blocking the main thread.
 * Implements a pub/sub pattern for efficient updates.
 * Optimized for Windows by batching all resource requests into a single PowerShell call.
 */
export class AsyncResourceMonitor {
  private config: ResourceMonitorConfig;
  private latestGlobal: GlobalResources;
  private subscribers: Set<ResourceSubscriber> = new Set();
  private updateTimer: NodeJS.Timeout | null = null;
  private isPolling: boolean = false;
  private pidProvider: PIDProvider = () => [];

  constructor(config: Partial<ResourceMonitorConfig> = {}) {
    this.config = {
      updateInterval: 5000,
      ...config,
    };

    // Initialize with default values
    this.latestGlobal = {
      system: {
        totalMemory: 0,
        usedMemory: 0,
        freeMemory: 0,
        cpuCount: 1,
        cpuUsage: 0,
      },
      processes: new Map(),
    };
  }

  /**
   * Set the provider for PIDs to monitor.
   */
  setPIDProvider(provider: PIDProvider): void {
    this.pidProvider = provider;
  }

  /**
   * Start monitoring resources.
   */
  start(): void {
    if (this.updateTimer) {
      return;
    }

    // Initial poll
    this.pollResourcesAsync();

    // Start periodic updates
    this.updateTimer = setInterval(() => {
      this.pollResourcesAsync();
    }, this.config.updateInterval);
  }

  /**
   * Stop monitoring resources.
   */
  stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  /**
   * Get the latest cached resource values.
   */
  getLatestResources(): GlobalResources {
    return {
      system: { ...this.latestGlobal.system },
      processes: new Map(this.latestGlobal.processes),
    };
  }

  /**
   * Subscribe to resource updates.
   */
  subscribe(callback: ResourceSubscriber): () => void {
    this.subscribers.add(callback);

    try {
      callback(this.latestGlobal);
    } catch {
      // Ignore
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Poll resources asynchronously.
   */
  private async pollResourcesAsync(): Promise<void> {
    if (this.isPolling) {
      return;
    }

    this.isPolling = true;

    try {
      const pids = this.pidProvider();
      const resources = await getGlobalResources(pids);

      // Only update and notify if significant changes occurred
      if (this.hasChanged(resources)) {
        this.latestGlobal = resources;
        this.notifySubscribers(resources);
      }
    } catch (_error) {
      // Fail silently
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Check if resources have changed significantly to avoid spamming UI re-renders.
   */
  private hasChanged(newGlobal: GlobalResources): boolean {
    const threshold = 0.5; // 0.5% change threshold for CPU

    const cpuChanged =
      Math.abs(newGlobal.system.cpuUsage - this.latestGlobal.system.cpuUsage) > threshold;
    const memChanged =
      Math.abs(newGlobal.system.usedMemory - this.latestGlobal.system.usedMemory) > 10; // 10MB

    // If PIDs changed, we definitely want a redraw
    if (newGlobal.processes.size !== this.latestGlobal.processes.size) {
      return true;
    }

    return cpuChanged || memChanged;
  }

  /**
   * Notify all subscribers of resource changes.
   */
  private notifySubscribers(resources: GlobalResources): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(resources);
      } catch (_error) {
        // Ignore
      }
    });
  }
}
