import type { ProcessManager } from '../processes/manager.js';
import type { WorkspaceModule } from '../config/schema.js';
import type { ProcessResult } from '../processes/types.js';
import { resolve } from 'path';

/**
 * Execute workspace-based modules (npm/pnpm/yarn/bun projects)
 * Runs configured commands in workspace directories
 */
export class WorkspaceExecutor {
  private processManager: ProcessManager;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  /**
   * Start a workspace module
   * Executes the configured dev command in the workspace directory
   *
   * @param id - Unique identifier for this module instance
   * @param config - Workspace module configuration
   * @returns Promise resolving to process result
   */
  async start(id: string, config: WorkspaceModule): Promise<ProcessResult> {
    const cwd = resolve(config.path);
    const command = config.run.dev ?? config.run.start ?? config.run.build;

    if (!command) {
      throw new Error(`No runnable command found for workspace module ${config.name}`);
    }

    return this.processManager.spawn({
      id,
      command,
      cwd,
      env: config.env as Record<string, string> | undefined,
    });
  }

  /**
   * Stop a running workspace module
   *
   * @param id - Module identifier
   * @returns Promise resolving to process result
   */
  async stop(id: string): Promise<ProcessResult> {
    return this.processManager.stop(id);
  }

  /**
   * Restart a workspace module
   *
   * @param id - Module identifier
   * @param config - Workspace module configuration
   * @returns Promise resolving to process result
   */
  async restart(id: string, config: WorkspaceModule): Promise<ProcessResult> {
    await this.processManager.stop(id);
    return this.start(id, config);
  }
}
