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
  async start(id: string, config: DockerModule): Promise<ProcessResult> {
    const composeFilePath = resolve(config.composeFile);
    const cwd = dirname(composeFilePath);
    const services = config.services?.join(' ') ?? '';
    const profiles = config.profiles?.map((p) => `--profile ${p}`).join(' ') ?? '';

    // Load .env from project root if it exists
    let envVars: Record<string, string | undefined> = { ...process.env };
    const rootEnvPath = join(process.cwd(), '.env');

    if (existsSync(rootEnvPath)) {
      const rootEnv = dotenv.parse(readFileSync(rootEnvPath));
      // dotenv.parse returns string values, safe to merge
      envVars = { ...envVars, ...rootEnv };
    }

    // Merge with config.env
    if (config.env) {
      // Force cast config.env values to string | undefined to satisfy the type
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

    const command =
      `${this.composeCommand} -f ${composeFilePath} ${profiles} up ${services}`.trim();

    return this.processManager.spawn({
      id,
      command,
      cwd,
      env: envVars as Record<string, string>,
      logFile: join(process.cwd(), 'tmp', 'logs', `${id}.log`),
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
   * Get all containers for this Docker Compose module
   *
   * @param config - Docker module configuration
   * @returns Array of Docker containers
   */
  getContainers(config: DockerModule): DockerContainer[] {
    return listContainers(config.composeFile);
  }

  /**
   * Get services with their container information
   *
   * @param config - Docker module configuration
   * @returns Array of services with container info
   */
  getServices(config: DockerModule): DockerComposeService[] {
    return getServicesContainers(config.composeFile, config.services);
  }
}
