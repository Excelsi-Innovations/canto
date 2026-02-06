import type { ProcessManager } from '../processes/manager.js';
import type { DockerModule } from '../config/schema.js';
import type { ProcessResult } from '../processes/types.js';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';

type DockerComposeCommand = 'docker compose' | 'docker-compose';

/**
 * Execute Docker Compose modules
 * Supports both 'docker compose' (v2) and 'docker-compose' (v1)
 */
export class DockerExecutor {
  private processManager: ProcessManager;
  private composeCommand: DockerComposeCommand;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
    this.composeCommand = this.detectDockerCompose();
  }

  /**
   * Start a Docker Compose service
   *
   * @param id - Unique identifier for this module instance
   * @param config - Docker module configuration
   * @returns Promise resolving to process result
   */
  async start(id: string, config: DockerModule): Promise<ProcessResult> {
    const composeFilePath = resolve(config.composeFile);
    const cwd = dirname(composeFilePath);
    const services = config.services?.join(' ') ?? '';
    const profiles = config.profiles?.map((p) => `--profile ${p}`).join(' ') ?? '';

    const command =
      `${this.composeCommand} -f ${composeFilePath} ${profiles} up ${services}`.trim();

    return this.processManager.spawn({
      id,
      command,
      cwd,
      env: config.env as Record<string, string> | undefined,
    });
  }

  /**
   * Stop a running Docker Compose service
   *
   * @param id - Module identifier
   * @param config - Docker module configuration (needed for compose file and services)
   * @returns Promise resolving to process result
   */
  async stop(id: string, config: DockerModule): Promise<ProcessResult> {
    const result = await this.processManager.stop(id);

    const composeFilePath = resolve(config.composeFile);
    const cwd = dirname(composeFilePath);
    const services = config.services?.join(' ') ?? '';

    try {
      execSync(`${this.composeCommand} -f ${composeFilePath} down ${services}`.trim(), {
        cwd,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Error stopping Docker Compose services:', error);
    }

    return result;
  }

  /**
   * Restart a Docker Compose service
   *
   * @param id - Module identifier
   * @param config - Docker module configuration
   * @returns Promise resolving to process result
   */
  async restart(id: string, config: DockerModule): Promise<ProcessResult> {
    await this.stop(id, config);
    return this.start(id, config);
  }

  /**
   * Detect which Docker Compose command is available
   * Prefers 'docker compose' (v2) over 'docker-compose' (v1)
   *
   * @returns Available Docker Compose command
   */
  private detectDockerCompose(): DockerComposeCommand {
    try {
      execSync('docker compose version', { stdio: 'ignore' });
      return 'docker compose';
    } catch {
      try {
        execSync('docker-compose --version', { stdio: 'ignore' });
        return 'docker-compose';
      } catch {
        console.warn(
          '⚠️  Neither "docker compose" nor "docker-compose" found. Docker modules may fail.'
        );
        return 'docker compose';
      }
    }
  }
}
