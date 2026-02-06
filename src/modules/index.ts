import type { ProcessManager } from '../processes/manager.js';
import { WorkspaceExecutor } from './workspace.js';
import { DockerExecutor } from './docker.js';
import { CustomExecutor } from './custom.js';
import type { Config, Module } from '../config/schema.js';
import type { ProcessResult } from '../processes/types.js';

type ModuleExecutor = WorkspaceExecutor | DockerExecutor | CustomExecutor;

interface ModuleInstance {
  config: Module;
  executor: ModuleExecutor;
}

/**
 * Orchestrates module execution with dependency management
 * Ensures modules start in correct order based on 'dependsOn' field
 */
export class ModuleOrchestrator {
  private processManager: ProcessManager;
  private workspaceExecutor: WorkspaceExecutor;
  private dockerExecutor: DockerExecutor;
  private customExecutor: CustomExecutor;
  private modules: Map<string, ModuleInstance> = new Map();

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
    this.workspaceExecutor = new WorkspaceExecutor(processManager);
    this.dockerExecutor = new DockerExecutor(processManager);
    this.customExecutor = new CustomExecutor(processManager);
  }

  /**
   * Load configuration and prepare modules
   *
   * @param config - Development configuration
   */
  load(config: Config): void {
    this.modules.clear();

    for (const moduleConfig of config.modules) {
      if (!moduleConfig.enabled) continue;

      const executor = this.getExecutor(moduleConfig);
      this.modules.set(moduleConfig.name, { config: moduleConfig, executor });
    }
  }

  /**
   * Start a module and its dependencies
   *
   * @param name - Module name
   * @returns Promise resolving to array of process results
   */
  async start(name: string): Promise<ProcessResult[]> {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module '${name}' not found`);
    }

    const results: ProcessResult[] = [];
    const started = new Set<string>();

    const startWithDeps = async (moduleName: string): Promise<void> => {
      if (started.has(moduleName)) return;

      const mod = this.modules.get(moduleName);
      if (!mod) return;

      if (mod.config.dependsOn && mod.config.dependsOn.length > 0) {
        for (const depName of mod.config.dependsOn) {
          await startWithDeps(depName);
        }
      }

      const result = await this.startModule(moduleName, mod);
      results.push(result);
      started.add(moduleName);
    };

    await startWithDeps(name);
    return results;
  }

  /**
   * Start all modules in dependency order
   *
   * @returns Promise resolving to array of process results
   */
  async startAll(): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    const started = new Set<string>();

    const startModuleWithDeps = async (name: string): Promise<void> => {
      if (started.has(name)) return;

      const module = this.modules.get(name);
      if (!module) return;

      if (module.config.dependsOn && module.config.dependsOn.length > 0) {
        for (const depName of module.config.dependsOn) {
          await startModuleWithDeps(depName);
        }
      }

      const result = await this.startModule(name, module);
      results.push(result);
      started.add(name);
    };

    for (const name of this.modules.keys()) {
      await startModuleWithDeps(name);
    }

    return results;
  }

  /**
   * Stop a module
   *
   * @param name - Module name
   * @returns Promise resolving to process result
   */
  async stop(name: string): Promise<ProcessResult> {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module '${name}' not found`);
    }

    return this.stopModule(name, module);
  }

  /**
   * Stop all running modules
   *
   * @returns Promise resolving to void
   */
  async stopAll(): Promise<void> {
    await this.processManager.cleanup();
  }

  /**
   * Restart a module
   *
   * @param name - Module name
   * @returns Promise resolving to process result
   */
  async restart(name: string): Promise<ProcessResult> {
    const module = this.modules.get(name);
    if (!module) {
      throw new Error(`Module '${name}' not found`);
    }

    return this.restartModule(name, module);
  }

  /**
   * Get list of all module names
   *
   * @returns Array of module names
   */
  getModuleNames(): string[] {
    return Array.from(this.modules.keys());
  }

  /**
   * Get module configuration
   *
   * @param name - Module name
   * @returns Module configuration or undefined
   */
  getModule(name: string): Module | undefined {
    return this.modules.get(name)?.config;
  }

  private getExecutor(config: Module): ModuleExecutor {
    switch (config.type) {
      case 'workspace':
        return this.workspaceExecutor;
      case 'docker':
        return this.dockerExecutor;
      case 'custom':
        return this.customExecutor;
    }
  }

  private async startModule(name: string, module: ModuleInstance): Promise<ProcessResult> {
    const { config } = module;

    switch (config.type) {
      case 'workspace':
        return this.workspaceExecutor.start(name, config);
      case 'docker':
        return this.dockerExecutor.start(name, config);
      case 'custom':
        return this.customExecutor.start(name, config);
    }
  }

  private async stopModule(name: string, module: ModuleInstance): Promise<ProcessResult> {
    const { config } = module;

    switch (config.type) {
      case 'workspace':
        return this.workspaceExecutor.stop(name);
      case 'docker':
        return this.dockerExecutor.stop(name, config);
      case 'custom':
        return this.customExecutor.stop(name);
    }
  }

  private async restartModule(name: string, module: ModuleInstance): Promise<ProcessResult> {
    const { config } = module;

    switch (config.type) {
      case 'workspace':
        return this.workspaceExecutor.restart(name, config);
      case 'docker':
        return this.dockerExecutor.restart(name, config);
      case 'custom':
        return this.customExecutor.restart(name, config);
    }
  }
}
