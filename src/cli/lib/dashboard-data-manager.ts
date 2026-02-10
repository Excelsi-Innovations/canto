import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import path from 'path';
import { loadConfig } from '../../config/parser.js';
import type { ProcessManager } from '../../processes/manager.js';
import type { ModuleOrchestrator } from '../../modules/index.js';
import type { DockerExecutor } from '../../modules/docker.js';
import type { ModuleStatus } from '../types.js';
import { getProcessResources } from '../../utils/resources.js';

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

  private configWatcher: FSWatcher | null = null;
  private configPath: string;

  private cache: StatusCache;
  private subscribers: Set<ModuleStatusSubscriber> = new Set();

  private updateTimer: NodeJS.Timeout | null = null;
  private dirtyModules: Set<string> = new Set();
  private isInitialized: boolean = false;
  private configChangeDebounceTimer: NodeJS.Timeout | null = null;

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
    if (this.isInitialized) {
      return;
    }
    
    // Load config once on startup
    await this.loadInitialConfig();

    // Watch config file for changes
    this.watchConfigFile();

    // Start incremental status updates
    this.startIncrementalUpdates();

    this.isInitialized = true;
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

    if (this.configChangeDebounceTimer) {
      clearTimeout(this.configChangeDebounceTimer);
      this.configChangeDebounceTimer = null;
    }

    this.subscribers.clear();
    this.cache.modules.clear();
    this.cache.lastUpdate.clear();
    this.isInitialized = false;
  }

  /**
   * Subscribe to module status updates.
   * Returns an unsubscribe function.
   */
  subscribe(callback: ModuleStatusSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately call with current data
    try {
      callback(this.getModuleStatuses());
    } catch {
      // Ignore subscriber errors
    }

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
   * Force an immediate update of all modules.
   */
  async forceUpdate(): Promise<void> {
    this.markAllDirty();
    await this.updateDirtyModules();
  }

  /**
   * Load initial configuration.
   */
  private async loadInitialConfig(): Promise<void> {
    const config = await loadConfig(this.configPath, true, true);
    this.orchestrator.load(config);

    // Initialize cache for all modules
    const moduleNames = this.orchestrator.getModuleNames();
    for (const name of moduleNames) {
      this.dirtyModules.add(name);
    }

    // Perform initial update
    await this.updateAllModules();
  }

  /**
   * Watch config file for changes using chokidar.
   * More reliable and cross-platform than fs.watch.
   */
  private watchConfigFile(): void {
    try {
      // Construct full config file path
      const configPatterns = [
        path.join(this.configPath, 'dev.config.yaml'),
        path.join(this.configPath, 'dev.config.yml'),
        path.join(this.configPath, 'canto.config.yaml'),
        path.join(this.configPath, 'canto.config.yml'),
        path.join(this.configPath, 'canto.config.json'),
      ];

      this.configWatcher = chokidar.watch(configPatterns, {
        persistent: true,
        ignoreInitial: true, // Don't trigger on initial add
        awaitWriteFinish: {
          stabilityThreshold: 100, // Wait for file to be stable
          pollInterval: 50,
        },
      });

      this.configWatcher.on('change', () => {
        this.handleConfigChange();
      });

      this.configWatcher.on('add', () => {
        // Config file was created
        this.handleConfigChange();
      });

      this.configWatcher.on('error', () => {
        // Silently ignore watcher errors
      });
    } catch (_error) {
      // Silently fail if watching not supported
    }
  }

  /**
   * Handle config file changes with debouncing.
   * Prevents multiple rapid reloads when file is saved.
   */
  private handleConfigChange(): void {
    // Clear existing debounce timer
    if (this.configChangeDebounceTimer) {
      clearTimeout(this.configChangeDebounceTimer);
    }

    // Debounce config reload by 200ms
    this.configChangeDebounceTimer = setTimeout(async () => {
      try {
        const newConfig = await loadConfig(this.configPath, true, true);
        this.orchestrator.load(newConfig);

        // Mark all modules as dirty
        this.markAllDirty();

        // Immediate update
        await this.updateAllModules();
      } catch {
        // Ignore errors during reload
      }
    }, 200);
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
      // No dirty modules, but mark all as dirty for next cycle
      // This ensures we still poll regularly but incrementally
      this.markAllDirty();
      return;
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
        status: (status ?? 'STOPPED') as ModuleStatus['status'],
        pid,
      };

      // Get process resources if we have a PID
      if (pid) {
        const resources = await getProcessResources(pid);
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
            .filter((s): s is typeof s & { container: NonNullable<typeof s.container> } => !!s.container)
            .map((s) => {
              const {container} = s;
              return {
                name: container.name,
                status: container.status,
                ports: container.ports
                  .map((p) => {
                    const match = p.match(/(?:[\d.]+:)?(\d+)->/);
                    return match ? `:${match[1]}` : '';
                  })
                  .filter(Boolean),
              };
            });
        } catch {
          // Ignore Docker errors
        }
      }

      // Update cache
      this.cache.modules.set(moduleName, moduleStatus);
      this.cache.lastUpdate.set(moduleName, Date.now());
    } catch {
      // Silently fail for individual module updates
    }
  }

  /**
   * Notify all subscribers of status changes.
   */
  private notifySubscribers(): void {
    const statuses = this.getModuleStatuses();

    this.subscribers.forEach((callback) => {
      try {
        callback(statuses);
      } catch {
        // Ignore subscriber errors
      }
    });
  }
}
