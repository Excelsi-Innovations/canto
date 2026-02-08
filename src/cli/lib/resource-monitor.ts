import { exec } from 'child_process';
import { promisify } from 'util';
import { platform } from 'os';
import type { SystemResources } from '../../utils/resources.js';

const execAsync = promisify(exec);

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
   */
  private async pollResourcesAsync(): Promise<void> {
    if (this.isPolling) {
      return; // Skip if already polling
    }

    this.isPolling = true;

    try {
      const os = platform();
      let resources: SystemResources;

      if (os === 'win32') {
        resources = await this.getWindowsResources();
      } else if (os === 'darwin') {
        resources = await this.getMacOSResources();
      } else {
        resources = await this.getLinuxResources();
      }

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

  /**
   * Get system resources on Windows (async).
   */
  private async getWindowsResources(): Promise<SystemResources> {
    // Use parallel queries for better performance
    const [memData, cpuCount, cpuUsage] = await Promise.all([
      this.getWindowsMemory(),
      this.getWindowsCPUCount(),
      this.getWindowsCPUUsage(),
    ]);

    return {
      ...memData,
      cpuCount,
      cpuUsage,
    };
  }

  private async getWindowsMemory() {
    try {
      const { stdout } = await execAsync(
        'powershell "$os = Get-CimInstance Win32_OperatingSystem; @{Total=$os.TotalVisibleMemorySize; Free=$os.FreePhysicalMemory} | ConvertTo-Json"'
      );

      const data = JSON.parse(stdout);
      const totalMemory = data.Total / 1024; // KB to MB
      const freeMemory = data.Free / 1024;
      const usedMemory = totalMemory - freeMemory;

      return { totalMemory, freeMemory, usedMemory };
    } catch {
      return { totalMemory: 0, freeMemory: 0, usedMemory: 0 };
    }
  }

  private async getWindowsCPUCount(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'powershell "(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors"'
      );
      return parseInt(stdout.trim()) || 1;
    } catch {
      return 1;
    }
  }

  private async getWindowsCPUUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync(
        'powershell "(Get-Counter \'\\\\Processor(_Total)\\\\% Processor Time\').CounterSamples[0].CookedValue"'
      );
      return parseFloat(stdout.trim()) || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get system resources on macOS (async).
   */
  private async getMacOSResources(): Promise<SystemResources> {
    const [memData, cpuCount, cpuUsage] = await Promise.all([
      this.getMacOSMemory(),
      this.getMacOSCPUCount(),
      this.getMacOSCPUUsage(),
    ]);

    return {
      ...memData,
      cpuCount,
      cpuUsage,
    };
  }

  private async getMacOSMemory() {
    try {
      const { stdout: vmStat } = await execAsync('vm_stat');
      const pageSize = 4096;

      const getPages = (line: string | undefined) => {
        if (!line) return 0;
        const match = line.match(/:\s+(\d+)/);
        return match?.[1] ? parseInt(match[1]) : 0;
      };

      const lines = vmStat.split('\n');
      const freePages = getPages(lines.find((l) => l.includes('Pages free')));
      const activePages = getPages(lines.find((l) => l.includes('Pages active')));
      const inactivePages = getPages(lines.find((l) => l.includes('Pages inactive')));
      const wiredPages = getPages(lines.find((l) => l.includes('Pages wired down')));

      const { stdout: memSize } = await execAsync('sysctl hw.memsize');
      const totalMemory = parseInt(memSize.match(/\d+/)?.[0] || '0') / (1024 * 1024);
      const freeMemory = (freePages * pageSize) / (1024 * 1024);
      const usedMemory = ((activePages + inactivePages + wiredPages) * pageSize) / (1024 * 1024);

      return { totalMemory, freeMemory, usedMemory };
    } catch {
      return { totalMemory: 0, freeMemory: 0, usedMemory: 0 };
    }
  }

  private async getMacOSCPUCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('sysctl -n hw.ncpu');
      return parseInt(stdout.trim()) || 1;
    } catch {
      return 1;
    }
  }

  private async getMacOSCPUUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('top -l 1 -n 0 | grep "CPU usage"');
      const match = stdout.match(/(\d+\.\d+)% user/);
      return match?.[1] ? parseFloat(match[1]) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Get system resources on Linux (async).
   */
  private async getLinuxResources(): Promise<SystemResources> {
    const [memData, cpuCount, cpuUsage] = await Promise.all([
      this.getLinuxMemory(),
      this.getLinuxCPUCount(),
      this.getLinuxCPUUsage(),
    ]);

    return {
      ...memData,
      cpuCount,
      cpuUsage,
    };
  }

  private async getLinuxMemory() {
    try {
      const { stdout: meminfo } = await execAsync('cat /proc/meminfo');

      const getMemValue = (key: string): number => {
        const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
        return match?.[1] ? parseInt(match[1]) / 1024 : 0; // KB to MB
      };

      const totalMemory = getMemValue('MemTotal');
      const freeMemory = getMemValue('MemFree') + getMemValue('Buffers') + getMemValue('Cached');
      const usedMemory = totalMemory - freeMemory;

      return { totalMemory, freeMemory, usedMemory };
    } catch {
      return { totalMemory: 0, freeMemory: 0, usedMemory: 0 };
    }
  }

  private async getLinuxCPUCount(): Promise<number> {
    try {
      const { stdout } = await execAsync('nproc');
      return parseInt(stdout.trim()) || 1;
    } catch {
      return 1;
    }
  }

  private async getLinuxCPUUsage(): Promise<number> {
    try {
      const { stdout } = await execAsync('cat /proc/stat | grep "^cpu "');
      const values = stdout.trim().split(/\s+/).slice(1).map(Number);
      const idle = values[3] ?? 0;
      const total = values.reduce((a, b) => a + b, 0);
      return total > 0 ? ((total - idle) / total) * 100 : 0;
    } catch {
      return 0;
    }
  }
}
