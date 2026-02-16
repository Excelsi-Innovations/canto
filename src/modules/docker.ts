import type { ProcessManager } from '../processes/manager.js';
import type { DockerModule } from '../config/schema.js';
import type { ProcessResult } from '../processes/types.js';
import { execSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import dotenv from 'dotenv';
import {
  detectDockerCompose,
  listContainers,
  getServicesContainers,
  type DockerContainer,
  type DockerComposeService,
} from '../utils/docker.js';

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
    this.composeCommand = detectDockerCompose();
  }

  /**
   * Start a Docker Compose service
   *
   * @param id - Unique identifier for this module instance
   * @param config - Docker module configuration
   * @returns Promise resolving to process result
   */
  async start(
    id: string,
    config: DockerModule,
    options?: { detached?: boolean }
  ): Promise<ProcessResult> {
    const composeFilePath = resolve(config.composeFile);
    const cwd = dirname(composeFilePath);
    const services = config.services?.join(' ') ?? '';
    const profiles = config.profiles?.map((p) => `--profile ${p}`).join(' ') ?? '';

    // Get environment variables
    const envVars = this.getEnvVars(config);

    // Use process.cwd() as project directory to ensure consistent context
    const escapedProjectDir = `"${process.cwd().replace(/"/g, '\\"')}"`;
    const escapedComposeFile = `"${composeFilePath.replace(/"/g, '\\"')}"`;
    const projectDirFlag = `--project-directory ${escapedProjectDir}`;

    // 1. Start containers in detached mode (Sync)
    const upCommand =
      `${this.composeCommand} ${projectDirFlag} -f ${escapedComposeFile} ${profiles} up -d ${services}`.trim();

    try {
      execSync(upCommand, {
        cwd,
        env: envVars,
        stdio: 'pipe',
      });
    } catch (error) {
      throw new Error(
        `Failed to start Docker containers: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 2. Spawn logs -f as the long-running process
    const logsCommand =
      `${this.composeCommand} ${projectDirFlag} -f ${escapedComposeFile} logs -f ${services}`.trim();

    return this.processManager.spawn({
      id,
      command: logsCommand,
      cwd,
      env: envVars as Record<string, string>,
      logFile: join(process.cwd(), 'tmp', 'logs', `${id}.log`),
      detached: options?.detached,
      onStop: async () => {
        try {
          const stopCommand =
            `${this.composeCommand} ${projectDirFlag} -f ${escapedComposeFile} stop ${services}`.trim();
          execSync(stopCommand, {
            cwd,
            env: envVars,
            stdio: 'ignore',
          });
        } catch (_error) {
          // Ignore errors
        }
      },
    });
  }

  /**
   * Stop a running Docker Compose service
   */
  async stop(id: string, config: DockerModule): Promise<ProcessResult> {
    const composeFilePath = resolve(config.composeFile);
    const cwd = dirname(composeFilePath);
    const services = config.services?.join(' ') ?? '';
    const envVars = this.getEnvVars(config);

    try {
      const escapedProjectDir = `"${process.cwd().replace(/"/g, '\\"')}"`;
      const escapedComposeFile = `"${composeFilePath.replace(/"/g, '\\"')}"`;
      const projectDirFlag = `--project-directory ${escapedProjectDir}`;
      const stopCommand =
        `${this.composeCommand} ${projectDirFlag} -f ${escapedComposeFile} stop ${services}`.trim();
      execSync(stopCommand, {
        cwd,
        env: envVars,
        stdio: 'ignore',
      });
    } catch (error) {
      console.warn(`Failed to stop docker containers for ${id}:`, error);
    }

    return this.processManager.stop(id);
  }

  private getEnvVars(config: DockerModule): NodeJS.ProcessEnv {
    let envVars: Record<string, string | undefined> = { ...process.env };
    const rootEnvPath = join(process.cwd(), '.env');

    if (existsSync(rootEnvPath)) {
      const rootEnv = dotenv.parse(readFileSync(rootEnvPath));
      envVars = { ...envVars, ...rootEnv };
    }

    if (config.env) {
      const configEnv = config.env as Record<string, unknown>;
      const safeConfigEnv: Record<string, string | undefined> = {};
      for (const [key, val] of Object.entries(configEnv)) {
        if (typeof val === 'string' || val === undefined) {
          safeConfigEnv[key] = val;
        } else {
          safeConfigEnv[key] = String(val);
        }
      }
      envVars = { ...envVars, ...safeConfigEnv };
    }
    return envVars as NodeJS.ProcessEnv;
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
   * Get all containers for this Docker Compose module
   *
   * @param config - Docker module configuration
   * @returns Array of Docker containers
   */
  getContainers(config: DockerModule): DockerContainer[] {
    return listContainers(config.composeFile, process.cwd());
  }

  /**
   * Get services with their container information
   *
   * @param config - Docker module configuration
   * @returns Array of services with container info
   */
  getServices(config: DockerModule): DockerComposeService[] {
    return getServicesContainers(config.composeFile, config.services, process.cwd());
  }
}
