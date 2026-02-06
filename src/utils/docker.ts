import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import pc from 'picocolors';

/**
 * Docker container information
 */
export interface DockerContainer {
  id: string;
  name: string;
  status: 'running' | 'exited' | 'paused' | 'restarting' | 'dead' | 'created' | 'unknown';
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
 * Check if Docker is available on the system
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
 * List all Docker containers for a specific Compose project
 *
 * @param composeFile - Path to docker-compose.yml
 * @returns Array of Docker containers
 */
export function listContainers(composeFile: string): DockerContainer[] {
  try {
    const composeFilePath = resolve(composeFile);
    const cwd = dirname(composeFilePath);
    const composeCmd = detectDockerCompose();

    // Get project name from docker-compose
    const projectName = execSync(
      `${composeCmd} -f ${composeFilePath} config --format json`,
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    let project = 'default';
    try {
      const config = JSON.parse(projectName);
      project = config.name || dirname(composeFilePath).split(/[\\/]/).pop() || 'default';
    } catch {
      // Fallback to directory name
      project = dirname(composeFilePath).split(/[\\/]/).pop() || 'default';
    }

    // List containers using docker ps with project label filter
    const output = execSync(
      `docker ps -a --filter "label=com.docker.compose.project=${project}" --format "{{.ID}}|{{.Names}}|{{.Status}}|{{.Image}}|{{.Ports}}|{{.CreatedAt}}"`,
      { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    if (!output.trim()) {
      return [];
    }

    const lines = output.trim().split('\n');
    return lines.map((line) => {
      const parts = line.split('|');
      const [id, name, status, image, ports, created] = parts.map((p) => p?.trim() ?? '');
      return {
        id: id || '',
        name: name || '',
        status: parseContainerStatus(status || ''),
        image: image || '',
        ports: ports ? ports.split(',').map((p) => p.trim()) : [],
        created: created || '',
      };
    });
  } catch (error) {
    // Silently fail if docker is not available or compose file not found
    if (error instanceof Error) {
      console.error(pc.dim(`Docker error: ${error.message}`));
    }
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
  services?: string[]
): DockerComposeService[] {
  const containers = listContainers(composeFile);

  if (!services || services.length === 0) {
    // Return all containers as services
    return containers.map((container) => ({
      name: container.name.split('-').pop() || container.name, // Try to extract service name
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
export function getContainerStatusDisplay(
  status: DockerContainer['status']
): { icon: string; color: (str: string) => string } {
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
