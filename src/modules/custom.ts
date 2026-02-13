import type { ProcessManager } from '../processes/manager.js';
import type { CustomModule } from '../config/schema.js';
import type { ProcessResult } from '../processes/types.js';
import { resolve, join } from 'path';

/**
 * Execute custom shell commands
 * Simple wrapper around ProcessManager for arbitrary commands
 */
export class CustomExecutor {
  private processManager: ProcessManager;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  /**
   * Start a custom command
   *
   * @param id - Unique identifier for this module instance
   * @param config - Custom module configuration
   * @returns Promise resolving to process result
   */
  async start(id: string, config: CustomModule): Promise<ProcessResult> {
    const cwd = config.cwd ? resolve(config.cwd) : process.cwd();

    return this.processManager.spawn({
      id,
      command: config.command,
      cwd,
      env: config.env as Record<string, string> | undefined,
      logFile: join(process.cwd(), 'tmp', 'logs', `${id}.log`),
    });
  }

  /**
   * Stop a running custom command
   *
   * @param id - Module identifier
   * @returns Promise resolving to process result
   */
  async stop(id: string): Promise<ProcessResult> {
    return this.processManager.stop(id);
  }

  /**
   * Restart a custom command
   *
   * @param id - Module identifier
   * @param config - Custom module configuration
   * @returns Promise resolving to process result
   */
  async restart(id: string, config: CustomModule): Promise<ProcessResult> {
    await this.processManager.stop(id);
    return this.start(id, config);
  }
}
