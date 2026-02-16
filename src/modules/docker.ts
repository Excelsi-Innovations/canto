import type { ProcessManager } from '../processes/manager.js';
import type { DockerModule } from '../config/schema.js';
import type { ProcessResult } from '../processes/types.js';
import { resolve, dirname, join } from 'path';
import { readFile, stat } from 'node:fs/promises'; // For async file reads and existence check
import dotenv from 'dotenv';
import {
  detectDockerCompose,
  listContainers,
  getServicesContainers,
  type DockerContainer,
  type DockerComposeService,
  runCommand, // Import runCommand
} from '../utils/docker.js';

type DockerComposeCommand = 'docker compose' | 'docker-compose';

/**
 * Execute Docker Compose modules
 * Supports both 'docker compose' (v2) and 'docker-compose' (v1)
 */
export class DockerExecutor {
  private processManager: ProcessManager;
  private composeCommand: DockerComposeCommand | null = null; // Initialize as null

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  async initialize(): Promise<void> {
    this.composeCommand = await detectDockerCompose();
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

    // Await the composeCommand promise
    const { composeCommand } = this;
    if (!composeCommand) {
      throw new Error('DockerExecutor not initialized. Call initialize() first.');
    }
    const actualComposeCommand = composeCommand;

    // Get environment variables
    const envVars = await this.getEnvVars(config);

    // Use process.cwd() as project directory to ensure consistent context
    const escapedProjectDir = `"${process.cwd().replace(/"/g, '\\"')}"`;
    const escapedComposeFile = `"${composeFilePath.replace(/"/g, '\\"')}"`;
    const projectDirFlag = `--project-directory ${escapedProjectDir}`;

    // 1. Start containers in detached mode (Async)
    const upCommand =
      `${actualComposeCommand} ${projectDirFlag} -f ${escapedComposeFile} ${profiles} up -d ${services}`.trim();

    try {
      await runCommand(upCommand, {
        cwd,
        env: envVars,
        stdio: ['pipe', 'pipe', 'pipe'], // Capture stdout/stderr
      });
    } catch (error) {
      throw new Error(
        `Failed to start Docker containers: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    // 2. Spawn logs -f as the long-running process
    const logsCommand =
      `${actualComposeCommand} ${projectDirFlag} -f ${escapedComposeFile} logs -f ${services}`.trim();

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
            `${actualComposeCommand} ${projectDirFlag} -f ${escapedComposeFile} stop ${services}`.trim();
          await runCommand(stopCommand, {
            cwd,
            env: envVars,
            stdio: ['pipe', 'ignore', 'ignore'],
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
    const envVars = await this.getEnvVars(config); // Await getEnvVars

    const { composeCommand } = this;
    if (!composeCommand) {
      throw new Error('DockerExecutor not initialized. Call initialize() first.');
    }
    const actualComposeCommand = composeCommand; // Await the composeCommand promise

    try {
      const escapedProjectDir = `"${process.cwd().replace(/"/g, '\\"')}"`;
      const escapedComposeFile = `"${composeFilePath.replace(/"/g, '\\"')}"`;
      const projectDirFlag = `--project-directory ${escapedProjectDir}`;
      const stopCommand =
        `${actualComposeCommand} ${projectDirFlag} -f ${escapedComposeFile} stop ${services}`.trim();
      await runCommand(stopCommand, {
        cwd,
        env: envVars,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
    } catch (error) {
      console.warn(`Failed to stop docker containers for ${id}:`, error);
    }

    return this.processManager.stop(id);
  }

  private async getEnvVars(config: DockerModule): Promise<NodeJS.ProcessEnv> {
    let envVars: Record<string, string | undefined> = { ...process.env };
    const rootEnvPath = join(process.cwd(), '.env');

    if (
      await stat(rootEnvPath)
        .then(() => true)
        .catch(() => false)
    ) {
      const rootEnvContent = await readFile(rootEnvPath, 'utf-8');
      const rootEnv = dotenv.parse(rootEnvContent);
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
  async getContainers(config: DockerModule): Promise<DockerContainer[]> {
    const { composeCommand } = this;
    if (!composeCommand) {
      throw new Error('DockerExecutor not initialized. Call initialize() first.');
    }
    return listContainers(config.composeFile, process.cwd(), composeCommand);
  }

  /**
   * Get services with their container information
   *
   * @param config - Docker module configuration
   * @returns Array of services with container info
   */
  async getServices(config: DockerModule): Promise<DockerComposeService[]> {
    const { composeCommand } = this;
    if (!composeCommand) {
      throw new Error('DockerExecutor not initialized. Call initialize() first.');
    }
    return getServicesContainers(
      config.composeFile,
      config.services,
      process.cwd(),
      composeCommand
    );
  }
}
