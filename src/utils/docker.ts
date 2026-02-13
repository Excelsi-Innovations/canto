import { execSync } from 'child_process';
import { dirname } from 'path';
import pc from 'picocolors';
import { dockerCache } from './docker-cache.js';

/**
 * Docker container information
 */
export interface DockerContainer {
  id: string;
  name: string;
  status: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'unknown';
  health?: 'healthy' | 'unhealthy' | 'starting';
  image: string;
  ports: string[];
  created: string;
}

/**
 * Docker Compose service information
 */
export interface DockerComposeService {
  name: string;
  container?: DockerContainer;
}

type DockerComposeCommand = 'docker compose' | 'docker-compose';

/**
 * Detect which Docker Compose command is available
 * Prefers 'docker compose' (v2) over 'docker-compose' (v1)
 */
export function detectDockerCompose(): DockerComposeCommand {
  try {
    execSync('docker compose version', { stdio: 'ignore' });
    return 'docker compose';
  } catch {
    try {
      execSync('docker-compose --version', { stdio: 'ignore' });
      return 'docker-compose';
    } catch {
      return 'docker compose'; // Default fallback
    }
  }
}

/**
 * Check if Docker CLI is installed on the system
 */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Docker daemon is actually running (not just CLI installed)
 * This prevents error spam when Docker Desktop is not started.
 */
export function isDockerRunning(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function parseContainerHealth(statusStr: string): 'healthy' | 'unhealthy' | 'starting' | undefined {
  const lower = statusStr.toLowerCase();
  if (lower.includes('(healthy)')) return 'healthy';
  if (lower.includes('(unhealthy)')) return 'unhealthy';
  if (lower.includes('(health: starting)')) return 'starting';
  return undefined;
}

/**
 * Parse Docker container status from docker ps output
 */
function parseContainerStatus(
  statusStr: string
): 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'unknown' {
  const lower = statusStr.toLowerCase();
  if (lower.includes('up')) return 'running';
  if (lower.includes('exited')) return 'exited';
  if (lower.includes('paused')) return 'paused';
  if (lower.includes('restarting')) return 'restarting';
  if (lower.includes('dead')) return 'dead';
  if (lower.includes('created')) return 'created';
  return 'unknown';
}

/**
 * List all Docker containers for a specific compose project
 * Uses caching to avoid redundant docker ps calls
 *
 * @param composeFilePath - Path to docker-compose.yml
 * @returns Array of Docker containers
 */
export function listContainers(composeFilePath: string, projectRoot?: string): DockerContainer[] {
  // Check cache first
  const cached = dockerCache.get(composeFilePath);
  if (cached) {
    return cached;
  }

  try {
    const cwd = dirname(composeFilePath);

    // Get project name from docker-compose.yml
    const projectDirFlag = projectRoot ? `--project-directory ${projectRoot}` : '';
    const projectName = execSync(
      `docker compose -f ${composeFilePath} ${projectDirFlag} config --format json`,
      {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }
    );

    let project = 'default';
    try {
      const config = JSON.parse(projectName);
      project = config.name ?? dirname(composeFilePath).split(/[\\/]/).pop() ?? 'default';
    } catch {
      // Fallback to directory name
      project = dirname(composeFilePath).split(/[\\/]/).pop() ?? 'default';
    }

    // List containers using docker ps with project label filter
    const output = execSync(
      `docker ps -a --filter "label=com.docker.compose.project=${project}" --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"`,
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    if (!output.trim()) {
      dockerCache.set(composeFilePath, []);
      return [];
    }

    const lines = output.trim().split('\n');
    const containers = lines.map((line) => {
      const parts = line.split('|');
      const [id, name, status, image, ports, created] = parts.map((p) => p?.trim() ?? '');
      return {
        id: id ?? '',
        name: name ?? '',
        status: parseContainerStatus(status ?? ''),
        health: parseContainerHealth(status ?? ''),
        image: image ?? '',
        ports: ports ? ports.split(',').map((p) => p.trim()) : [],
        created: created ?? '',
      };
    });

    // Cache the result
    dockerCache.set(composeFilePath, containers);
    return containers;
  } catch {
    // Silently fail if docker is not available or compose file not found
    dockerCache.set(composeFilePath, []);
    return [];
  }
}

/**
 * Get containers for specific services
 *
 * @param composeFile - Path to docker-compose.yml
 * @param services - Array of service names (optional, returns all if not specified)
 * @returns Array of Docker Compose services with container info
 */
export function getServicesContainers(
  composeFile: string,
  services?: string[],
  projectRoot?: string
): DockerComposeService[] {
  const containers = listContainers(composeFile, projectRoot);

  if (!services || services.length === 0) {
    // Return all containers as services
    return containers.map((container) => ({
      name: container.name.split('-').pop() ?? container.name, // Try to extract service name
      container,
    }));
  }

  // Match containers to services
  return services.map((serviceName) => {
    const container = containers.find(
      (c) =>
        c.name.includes(`-${serviceName}-`) ||
        c.name.endsWith(`-${serviceName}`) ||
        c.name === serviceName
    );

    return {
      name: serviceName,
      container,
    };
  });
}

/**
 * Get logs from a specific Docker container
 *
 * @param containerName - Name or ID of the container
 * @param lines - Number of lines to retrieve (default: 50)
 * @param follow - Whether to follow the logs (default: false)
 * @returns Command to execute for logs
 */
export function getContainerLogsCommand(
  containerName: string,
  lines: number = 50,
  follow: boolean = false
): string {
  const followFlag = follow ? '-f' : '';
  return `docker logs ${followFlag} --tail ${lines} ${containerName}`;
}

/**
 * Get the status icon and color for a container
 */
export function getContainerStatusDisplay(status: DockerContainer['status']): {
  icon: string;
  color: (str: string) => string;
} {
  switch (status) {
    case 'running':
      return { icon: '●', color: pc.green };
    case 'exited':
      return { icon: '■', color: pc.red };
    case 'paused':
      return { icon: '‖', color: pc.yellow };
    case 'restarting':
      return { icon: '↻', color: pc.yellow };
    case 'created':
      return { icon: '○', color: pc.dim };
    case 'dead':
      return { icon: '✗', color: pc.red };
    default:
      return { icon: '?', color: pc.dim };
  }
}

/**
 * Format port mappings for display
 *
 * @param ports - Array of port strings from Docker
 * @returns Formatted port string
 */
export function formatPorts(ports: string[]): string {
  if (ports.length === 0) return '';

  const formatted = ports
    .map((p) => {
      // Extract host port from formats like "0.0.0.0:5432->5432/tcp"
      const match = p.match(/(?:[\d.]+:)?(\d+)->/);
      return match ? `:${match[1]}` : '';
    })
    .filter(Boolean);

  return formatted.join(', ');
}
