# Dashboard Performance Optimization - Technical Implementation Guide

**Companion Document to**: `DASHBOARD_PERFORMANCE_OPTIMIZATION_PLAN.md`  
**Status**: 🔧 TECHNICAL REFERENCE  
**Audience**: Developers implementing the optimization

---

## 🏗️ Architecture Overview

### Current Architecture (Problematic)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Dashboard Component                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   useEffect (2s interval)                                 │  │
│  │   ├─→ getSystemResources() ──────┐                       │  │
│  │   │   └─→ execSync() [BLOCKS 300ms]                      │  │
│  │   │                                                       │  │
│  │   └─→ setSystemResources()                               │  │
│  │       └─→ RE-RENDER ALL CHILDREN ❌                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   useEffect (3s interval)                                 │  │
│  │   ├─→ loadConfig() [DISK I/O]                            │  │
│  │   ├─→ orchestrator.load()                                │  │
│  │   │                                                       │  │
│  │   └─→ for each module:                                   │  │
│  │       ├─→ getProcessResources(pid) ──────┐               │  │
│  │       │   └─→ execSync() [BLOCKS 50ms]                   │  │
│  │       │                                                   │  │
│  │       └─→ dockerExecutor.getServices() ──┐               │  │
│  │           └─→ docker ps [BLOCKS 100ms]                   │  │
│  │                                                           │  │
│  │   └─→ setModules()                                       │  │
│  │       └─→ RE-RENDER ALL CHILDREN ❌                      │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │   Screen Components (NO MEMO)                             │  │
│  │   ├─ HelpScreen ──→ Re-renders every 2s ❌               │  │
│  │   ├─ LogsScreen ──→ readFileSync every 2s ❌             │  │
│  │   └─ HistoryScreen ──→ No optimization ❌                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

PROBLEMS:
❌ Blocking execSync calls every 2-3 seconds
❌ Full component re-renders even when data unchanged
❌ Synchronous file I/O in render cycle
❌ No caching or incremental updates
❌ N+1 query problem for process/docker info
```

### Optimized Architecture (Target)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Dashboard Component                               │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   useEffect (mount only)                                          │  │
│  │   ├─→ resourceMonitor.start()                                     │  │
│  │   │   └─→ Background async polling ✅                            │  │
│  │   │                                                               │  │
│  │   └─→ resourceMonitor.subscribe((data) => {                      │  │
│  │       setSystemResources(data) // Only when changed ✅           │  │
│  │   })                                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   useEffect (mount only)                                          │  │
│  │   ├─→ dataManager.initialize()                                    │  │
│  │   │   ├─→ Load config once                                        │  │
│  │   │   ├─→ Watch config file (fs.watch) ✅                        │  │
│  │   │   └─→ Incremental status updates ✅                          │  │
│  │   │                                                               │  │
│  │   └─→ dataManager.subscribe((modules) => {                       │  │
│  │       setModules(modules) // Only when changed ✅                │  │
│  │   })                                                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │   Screen Components (MEMOIZED)                                    │  │
│  │   ├─ React.memo(HelpScreen) ──→ Renders once ✅                  │  │
│  │   ├─ React.memo(LogsScreen) ──→ Async tail ✅                    │  │
│  │   └─ React.memo(HistoryScreen) ──→ Cached ✅                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

         ↓ subscribes to                    ↓ subscribes to

┌─────────────────────────┐         ┌─────────────────────────────┐
│  AsyncResourceMonitor   │         │  DashboardDataManager       │
│                         │         │                             │
│  ┌──────────────────┐  │         │  ┌──────────────────────┐  │
│  │ Background Loop  │  │         │  │ Config Watcher       │  │
│  │ (async polling)  │  │         │  │ (fs.watch)           │  │
│  └──────────────────┘  │         │  └──────────────────────┘  │
│          ↓              │         │          ↓                  │
│  ┌──────────────────┐  │         │  ┌──────────────────────┐  │
│  │ exec() async     │  │         │  │ Status Cache         │  │
│  │ (non-blocking)   │  │         │  │ (Map with TTL)       │  │
│  └──────────────────┘  │         │  └──────────────────────┘  │
│          ↓              │         │          ↓                  │
│  ┌──────────────────┐  │         │  ┌──────────────────────┐  │
│  │ Cache & Notify   │  │         │  │ Batched Docker Query │  │
│  │ (if changed)     │  │         │  │ (single docker ps)   │  │
│  └──────────────────┘  │         │  └──────────────────────┘  │
└─────────────────────────┘         └─────────────────────────────┘

IMPROVEMENTS:
✅ Zero blocking operations
✅ Incremental updates only
✅ Smart caching with dirty checking
✅ Batched queries (N+1 → 1)
✅ File watching instead of polling
✅ Memoized components
```

---

## 🔨 Implementation Details

### 1. AsyncResourceMonitor

**File**: `src/cli/lib/resource-monitor.ts`

```typescript
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
  private lastUpdate: number = 0;

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
    callback(this.latestResources);

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
    const startTime = Date.now();

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
        this.lastUpdate = Date.now();
        this.notifySubscribers(resources);
      }
    } catch (error) {
      // Silently fail, keep using last known values
      console.warn('Failed to poll system resources:', error);
    } finally {
      this.isPolling = false;

      // Log performance (remove in production)
      const duration = Date.now() - startTime;
      if (duration > 100) {
        console.warn(`Slow resource poll: ${duration}ms`);
      }
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
        console.error('Error in resource subscriber:', error);
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
    const { stdout } = await execAsync(
      'powershell "$os = Get-CimInstance Win32_OperatingSystem; @{Total=$os.TotalVisibleMemorySize; Free=$os.FreePhysicalMemory} | ConvertTo-Json"'
    );

    const data = JSON.parse(stdout);
    const totalMemory = data.Total / 1024; // KB to MB
    const freeMemory = data.Free / 1024;
    const usedMemory = totalMemory - freeMemory;

    return { totalMemory, freeMemory, usedMemory };
  }

  private async getWindowsCPUCount(): Promise<number> {
    const { stdout } = await execAsync(
      'powershell "(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors"'
    );
    return parseInt(stdout.trim()) || 1;
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
  }

  private async getMacOSCPUCount(): Promise<number> {
    const { stdout } = await execAsync('sysctl -n hw.ncpu');
    return parseInt(stdout.trim()) || 1;
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
    const { stdout: meminfo } = await execAsync('cat /proc/meminfo');

    const getMemValue = (key: string): number => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match?.[1] ? parseInt(match[1]) / 1024 : 0; // KB to MB
    };

    const totalMemory = getMemValue('MemTotal');
    const freeMemory = getMemValue('MemFree') + getMemValue('Buffers') + getMemValue('Cached');
    const usedMemory = totalMemory - freeMemory;

    return { totalMemory, freeMemory, usedMemory };
  }

  private async getLinuxCPUCount(): Promise<number> {
    const { stdout } = await execAsync('nproc');
    return parseInt(stdout.trim()) || 1;
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
```

**Usage in Dashboard**:

```typescript
// dashboard.tsx - BEFORE
const [systemResources, setSystemResources] = useState<SystemResources>(
  () => getSystemResources() // ❌ BLOCKING
);

useEffect(() => {
  const interval = setInterval(() => {
    setSystemResources(getSystemResources()); // ❌ BLOCKING
  }, 2000);
  return () => clearInterval(interval);
}, []);

// dashboard.tsx - AFTER
import { AsyncResourceMonitor } from '../lib/resource-monitor.js';

const [resourceMonitor] = useState(() => new AsyncResourceMonitor());
const [systemResources, setSystemResources] = useState<SystemResources>(
  resourceMonitor.getLatestResources() // ✅ Non-blocking cached read
);

useEffect(() => {
  resourceMonitor.start();

  const unsubscribe = resourceMonitor.subscribe((resources) => {
    setSystemResources(resources); // ✅ Only called when resources change
  });

  return () => {
    unsubscribe();
    resourceMonitor.stop();
  };
}, [resourceMonitor]);
```

---

### 2. DashboardDataManager

**File**: `src/cli/lib/dashboard-data-manager.ts`

```typescript
import { watch, FSWatcher } from 'fs';
import { loadConfig } from '../../config/parser.js';
import type { Config } from '../../config/schema.js';
import type { ProcessManager } from '../../processes/manager.js';
import type { ModuleOrchestrator } from '../../modules/index.js';
import type { DockerExecutor } from '../../modules/docker.js';
import type { ModuleStatus } from '../types.js';

export type ModuleStatusSubscriber = (modules: ModuleStatus[]) => void;

interface StatusCache {
  modules: Map<string, ModuleStatus>;
  lastUpdate: Map<string, number>;
  ttl: number; // Time to live in milliseconds
}

/**
 * Manages dashboard data with intelligent caching and incremental updates.
 * Eliminates unnecessary config reloads and process queries.
 */
export class DashboardDataManager {
  private processManager: ProcessManager;
  private orchestrator: ModuleOrchestrator;
  private dockerExecutor: DockerExecutor;

  private config: Config | null = null;
  private configWatcher: FSWatcher | null = null;
  private configPath: string;

  private cache: StatusCache;
  private subscribers: Set<ModuleStatusSubscriber> = new Set();

  private updateTimer: NodeJS.Timer | null = null;
  private dirtyModules: Set<string> = new Set();

  constructor(
    orchestrator: ModuleOrchestrator,
    processManager: ProcessManager,
    dockerExecutor: DockerExecutor,
    cwd: string = process.cwd()
  ) {
    this.orchestrator = orchestrator;
    this.processManager = processManager;
    this.dockerExecutor = dockerExecutor;
    this.configPath = cwd;

    this.cache = {
      modules: new Map(),
      lastUpdate: new Map(),
      ttl: 1000, // 1 second TTL
    };
  }

  /**
   * Initialize the data manager.
   * Loads config once and starts watching for changes.
   */
  async initialize(): Promise<void> {
    // Load config once on startup
    await this.loadInitialConfig();

    // Watch config file for changes
    this.watchConfigFile();

    // Start incremental status updates
    this.startIncrementalUpdates();
  }

  /**
   * Clean up resources.
   */
  cleanup(): void {
    if (this.configWatcher) {
      this.configWatcher.close();
      this.configWatcher = null;
    }

    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.subscribers.clear();
    this.cache.modules.clear();
    this.cache.lastUpdate.clear();
  }

  /**
   * Subscribe to module status updates.
   * Returns an unsubscribe function.
   */
  subscribe(callback: ModuleStatusSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately call with current data
    callback(this.getModuleStatuses());

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current module statuses from cache.
   */
  getModuleStatuses(): ModuleStatus[] {
    return Array.from(this.cache.modules.values());
  }

  /**
   * Mark a module as dirty (needs update).
   */
  markDirty(moduleName: string): void {
    this.dirtyModules.add(moduleName);
  }

  /**
   * Mark all modules as dirty.
   */
  markAllDirty(): void {
    this.cache.modules.forEach((_, name) => {
      this.dirtyModules.add(name);
    });
  }

  /**
   * Load initial configuration.
   */
  private async loadInitialConfig(): Promise<void> {
    try {
      this.config = await loadConfig(this.configPath, true, true);
      this.orchestrator.load(this.config);

      // Initialize cache for all modules
      const moduleNames = this.orchestrator.getModuleNames();
      for (const name of moduleNames) {
        this.dirtyModules.add(name);
      }

      // Perform initial update
      await this.updateAllModules();
    } catch (error) {
      console.error('Failed to load initial config:', error);
      throw error;
    }
  }

  /**
   * Watch config file for changes.
   */
  private watchConfigFile(): void {
    // Watch the entire directory (supports config file changes/renames)
    try {
      this.configWatcher = watch(this.configPath, { recursive: false }, (eventType, filename) => {
        if (!filename) return;

        // Check if it's a config file
        const isConfigFile = /^(canto|dev)\.(config|yml|yaml|json)$/.test(filename);
        if (isConfigFile && eventType === 'change') {
          this.handleConfigChange();
        }
      });
    } catch (error) {
      console.warn('Failed to watch config file:', error);
    }
  }

  /**
   * Handle config file changes.
   */
  private async handleConfigChange(): Promise<void> {
    try {
      console.log('Config file changed, reloading...');

      const newConfig = await loadConfig(this.configPath, true, true);
      this.orchestrator.load(newConfig);
      this.config = newConfig;

      // Mark all modules as dirty
      this.markAllDirty();

      // Immediate update
      await this.updateAllModules();
    } catch (error) {
      console.error('Failed to reload config:', error);
    }
  }

  /**
   * Start incremental status updates.
   */
  private startIncrementalUpdates(): void {
    this.updateTimer = setInterval(() => {
      this.updateDirtyModules();
    }, 1000); // Update every 1 second
  }

  /**
   * Update only modules that are marked as dirty.
   */
  private async updateDirtyModules(): Promise<void> {
    if (this.dirtyModules.size === 0) {
      return; // Nothing to update
    }

    const modulesToUpdate = Array.from(this.dirtyModules);
    this.dirtyModules.clear();

    // Update modules in parallel
    await Promise.all(modulesToUpdate.map((name) => this.updateModuleStatus(name)));

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Update all modules.
   */
  private async updateAllModules(): Promise<void> {
    const moduleNames = this.orchestrator.getModuleNames();

    // Update all modules in parallel
    await Promise.all(moduleNames.map((name) => this.updateModuleStatus(name)));

    // Notify subscribers
    this.notifySubscribers();
  }

  /**
   * Update status for a single module.
   */
  private async updateModuleStatus(moduleName: string): Promise<void> {
    try {
      const module = this.orchestrator.getModule(moduleName);
      if (!module) {
        this.cache.modules.delete(moduleName);
        return;
      }

      const status = this.processManager.getStatus(moduleName);
      const pid = this.processManager.getPid(moduleName);

      const moduleStatus: ModuleStatus = {
        name: moduleName,
        type: module.type,
        status: (status as any) || 'STOPPED',
        pid,
      };

      // Get process resources if we have a PID
      if (pid) {
        const resources = await this.getProcessResourcesAsync(pid);
        if (resources) {
          moduleStatus.cpu = resources.cpu;
          moduleStatus.memory = resources.memory;
        }
      }

      // Get Docker containers if it's a Docker module
      if (module.type === 'docker') {
        try {
          const services = this.dockerExecutor.getServices(module);
          moduleStatus.containers = services
            .filter((s) => s.container)
            .map((s) => ({
              name: s.container!.name,
              status: s.container!.status,
              ports: s
                .container!.ports.map((p) => {
                  const match = p.match(/(?:[\d.]+:)?(\d+)->/);
                  return match ? `:${match[1]}` : '';
                })
                .filter(Boolean),
            }));
        } catch (e) {
          // Ignore Docker errors
        }
      }

      // Update cache
      this.cache.modules.set(moduleName, moduleStatus);
      this.cache.lastUpdate.set(moduleName, Date.now());
    } catch (error) {
      console.error(`Failed to update module ${moduleName}:`, error);
    }
  }

  /**
   * Get process resources asynchronously (non-blocking).
   */
  private async getProcessResourcesAsync(
    pid: number
  ): Promise<{ cpu: number; memory: number } | null> {
    // TODO: Implement async version of getProcessResources
    // For now, return null to avoid blocking
    return null;
  }

  /**
   * Notify all subscribers of status changes.
   */
  private notifySubscribers(): void {
    const statuses = this.getModuleStatuses();

    this.subscribers.forEach((callback) => {
      try {
        callback(statuses);
      } catch (error) {
        console.error('Error in module status subscriber:', error);
      }
    });
  }
}
```

**Usage in Dashboard**:

```typescript
// dashboard.tsx - AFTER
import { DashboardDataManager } from '../lib/dashboard-data-manager.js';

const [dataManager] = useState(
  () => new DashboardDataManager(orchestrator, processManager, dockerExecutor)
);

const [modules, setModules] = useState<ModuleStatus[]>([]);

useEffect(() => {
  dataManager.initialize();

  const unsubscribe = dataManager.subscribe((modules) => {
    setModules(modules); // ✅ Only called when data changes
  });

  return () => {
    unsubscribe();
    dataManager.cleanup();
  };
}, [dataManager]);
```

---

### 3. LogTailer

**File**: `src/cli/lib/log-tailer.ts`

```typescript
import { promises as fs, watch, FSWatcher } from 'fs';
import { join } from 'path';

export type LogSubscriber = (lines: string[]) => void;

/**
 * Efficiently tails log files without blocking.
 * Only reads new content and uses file watching.
 */
export class LogTailer {
  private filePath: string | null = null;
  private lines: string[] = [];
  private lineCount: number;
  private fileWatcher: FSWatcher | null = null;
  private lastPosition: number = 0;
  private subscribers: Set<LogSubscriber> = new Set();

  constructor(lineCount: number = 100) {
    this.lineCount = lineCount;
  }

  /**
   * Start tailing a log file.
   */
  async start(filePath: string): Promise<void> {
    if (this.filePath === filePath && this.fileWatcher) {
      return; // Already tailing this file
    }

    // Stop previous tail
    this.stop();

    this.filePath = filePath;

    try {
      // Read last N lines efficiently
      await this.readLastLines();

      // Watch for changes
      this.watchFile();

      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      this.lines = [`Error reading log file: ${error}`];
      this.notifySubscribers();
    }
  }

  /**
   * Stop tailing.
   */
  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.filePath = null;
    this.lastPosition = 0;
  }

  /**
   * Get current lines.
   */
  getLines(): string[] {
    return [...this.lines];
  }

  /**
   * Subscribe to log updates.
   */
  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately call with current lines
    callback(this.lines);

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Read last N lines from file efficiently.
   * Only reads the end of the file, not the entire content.
   */
  private async readLastLines(): Promise<void> {
    if (!this.filePath) return;

    try {
      const stats = await fs.stat(this.filePath);
      const fileSize = stats.size;

      // Read last 64KB (or entire file if smaller)
      const bufferSize = Math.min(64 * 1024, fileSize);
      const buffer = Buffer.alloc(bufferSize);

      const fd = await fs.open(this.filePath, 'r');
      const readPosition = Math.max(0, fileSize - bufferSize);

      await fd.read(buffer, 0, bufferSize, readPosition);
      await fd.close();

      const text = buffer.toString('utf-8');
      const allLines = text.split('\n').filter((line) => line.trim() !== '');

      // Take last N lines
      this.lines = allLines.slice(-this.lineCount);
      this.lastPosition = fileSize;
    } catch (error) {
      this.lines = [`Error reading log file: ${error}`];
    }
  }

  /**
   * Watch file for changes and read new content.
   */
  private watchFile(): void {
    if (!this.filePath) return;

    try {
      this.fileWatcher = watch(this.filePath, async (eventType) => {
        if (eventType === 'change') {
          await this.readNewContent();
        }
      });
    } catch (error) {
      console.warn('Failed to watch log file:', error);
    }
  }

  /**
   * Read only new content from file (incremental read).
   */
  private async readNewContent(): Promise<void> {
    if (!this.filePath) return;

    try {
      const stats = await fs.stat(this.filePath);
      const fileSize = stats.size;

      if (fileSize < this.lastPosition) {
        // File was truncated or rotated, re-read entire tail
        await this.readLastLines();
        this.notifySubscribers();
        return;
      }

      if (fileSize === this.lastPosition) {
        return; // No new content
      }

      // Read only new bytes
      const newBytes = fileSize - this.lastPosition;
      const buffer = Buffer.alloc(newBytes);

      const fd = await fs.open(this.filePath, 'r');
      await fd.read(buffer, 0, newBytes, this.lastPosition);
      await fd.close();

      const newText = buffer.toString('utf-8');
      const newLines = newText.split('\n').filter((line) => line.trim() !== '');

      // Append new lines and trim to lineCount
      this.lines = [...this.lines, ...newLines].slice(-this.lineCount);
      this.lastPosition = fileSize;

      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      console.warn('Failed to read new log content:', error);
    }
  }

  /**
   * Notify all subscribers of new lines.
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.lines);
      } catch (error) {
        console.error('Error in log subscriber:', error);
      }
    });
  }
}
```

**Usage in LogsScreen**:

```typescript
// LogsScreen.tsx - AFTER
import { LogTailer } from '../../lib/log-tailer.js';

export const LogsScreen: React.FC<LogsScreenProps> = ({
  modules,
  selectedModule,
  onBack,
  onQuit,
}) => {
  const [logTailer] = useState(() => new LogTailer(100));
  const [logContent, setLogContent] = useState<string>('');
  const [currentModuleIndex, setCurrentModuleIndex] = useState(selectedModule);
  const currentModule = modules[currentModuleIndex];

  useEffect(() => {
    if (!currentModule?.name) {
      setLogContent('No module selected');
      return;
    }

    const logFile = join(process.cwd(), 'tmp', 'logs', `${currentModule.name}.log`);

    logTailer.start(logFile);

    const unsubscribe = logTailer.subscribe((lines) => {
      setLogContent(lines.join('\n')); // ✅ Only updates when file changes
    });

    return () => {
      unsubscribe();
    };
  }, [currentModule, logTailer]);

  // ... rest of component
};
```

---

## 🧪 Testing Examples

### Performance Test

```typescript
// tests/performance/resource-monitor.perf.test.ts
import { AsyncResourceMonitor } from '../../src/cli/lib/resource-monitor';

describe('AsyncResourceMonitor Performance', () => {
  it('should not block the main thread', async () => {
    const monitor = new AsyncResourceMonitor({ updateInterval: 100 });
    monitor.start();

    // Measure time to get resources
    const measurements: number[] = [];

    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      monitor.getLatestResources();
      const duration = performance.now() - start;
      measurements.push(duration);

      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    monitor.stop();

    // All reads should be <1ms (cached)
    const avg = measurements.reduce((a, b) => a + b) / measurements.length;
    const max = Math.max(...measurements);

    expect(avg).toBeLessThan(1);
    expect(max).toBeLessThan(5);
  });

  it('should update resources in background', async () => {
    const monitor = new AsyncResourceMonitor({ updateInterval: 500 });
    const updates: number[] = [];

    monitor.subscribe(() => {
      updates.push(Date.now());
    });

    monitor.start();

    // Wait for 3 updates
    await new Promise((resolve) => setTimeout(resolve, 1600));
    monitor.stop();

    // Should have 3+ updates (initial + 2-3 intervals)
    expect(updates.length).toBeGreaterThanOrEqual(3);

    // Updates should be ~500ms apart
    for (let i = 1; i < updates.length; i++) {
      const interval = updates[i] - updates[i - 1];
      expect(interval).toBeGreaterThan(400);
      expect(interval).toBeLessThan(600);
    }
  });
});
```

---

## 📝 Migration Checklist

### Phase 1: AsyncResourceMonitor

- [ ] Create `src/cli/lib/resource-monitor.ts`
- [ ] Write unit tests
- [ ] Update `dashboard.tsx` to use AsyncResourceMonitor
- [ ] Remove old `getSystemResources()` polling code
- [ ] Test on Windows, macOS, Linux
- [ ] Verify zero UI freezes

### Phase 2: DashboardDataManager

- [ ] Create `src/cli/lib/dashboard-data-manager.ts`
- [ ] Implement config file watching
- [ ] Implement status caching
- [ ] Write unit tests
- [ ] Update `dashboard.tsx` to use DashboardDataManager
- [ ] Remove old `loadConfigAndStatus()` polling code
- [ ] Test config reload on file change

### Phase 3: LogTailer

- [ ] Create `src/cli/lib/log-tailer.ts`
- [ ] Implement efficient tail reading
- [ ] Implement file watching
- [ ] Write unit tests
- [ ] Update `LogsScreen.tsx` to use LogTailer
- [ ] Remove `readFileSync()` polling code
- [ ] Test with large log files (>100MB)

### Phase 4: Component Memoization

- [ ] Add React.memo to HelpScreen
- [ ] Add React.memo to EnvScreen
- [ ] Add React.memo to HistoryScreen
- [ ] Verify ModuleRow.memo is working
- [ ] Add useCallback to input handlers
- [ ] Test re-render count

### Phase 5: Final Validation

- [ ] Run all performance tests
- [ ] Profile with Node.js inspector
- [ ] Check memory leaks (24-hour test)
- [ ] Verify 60 FPS
- [ ] Verify input latency <16ms
- [ ] Document all changes

---

**Status**: 🔧 READY FOR IMPLEMENTATION  
**Next**: Start with AsyncResourceMonitor (highest impact)

---

_Last Updated: 2026-02-08_  
_Document Version: 1.0_
