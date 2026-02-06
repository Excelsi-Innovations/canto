import { createServer } from 'net';

/**
 * Check if a port is available
 *
 * @param port - Port number to check
 * @param host - Host to check (default: 0.0.0.0)
 * @returns Promise resolving to true if available, false otherwise
 */
export async function isPortAvailable(port: number, host = '0.0.0.0'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, host);
  });
}

/**
 * Find an available port in a given range
 *
 * @param startPort - Start of port range
 * @param endPort - End of port range (default: startPort + 100)
 * @param host - Host to check (default: 0.0.0.0)
 * @returns Promise resolving to available port, or null if none found
 */
export async function findAvailablePort(
  startPort: number,
  endPort?: number,
  host = '0.0.0.0'
): Promise<number | null> {
  const end = endPort ?? startPort + 100;

  for (let port = startPort; port <= end; port++) {
    const available = await isPortAvailable(port, host);
    if (available) {
      return port;
    }
  }

  return null;
}

/**
 * Find multiple available ports
 *
 * @param count - Number of ports needed
 * @param startPort - Start of port range (default: 3000)
 * @param host - Host to check (default: 0.0.0.0)
 * @returns Promise resolving to array of available ports
 */
export async function findAvailablePorts(
  count: number,
  startPort = 3000,
  host = '0.0.0.0'
): Promise<number[]> {
  const ports: number[] = [];
  let currentPort = startPort;

  while (ports.length < count && currentPort < 65535) {
    const available = await isPortAvailable(currentPort, host);
    if (available) {
      ports.push(currentPort);
    }
    currentPort++;
  }

  return ports;
}

/**
 * Get a random available port
 * Let the OS assign a random available port
 *
 * @param host - Host to bind (default: 0.0.0.0)
 * @returns Promise resolving to available port
 */
export async function getRandomAvailablePort(host = '0.0.0.0'): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();

    server.once('error', (err) => {
      reject(err);
    });

    server.once('listening', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close();
      resolve(port);
    });

    server.listen(0, host);
  });
}

/**
 * Allocate ports for modules based on configuration
 * Attempts to use preferred ports, falls back to finding available ones
 *
 * @param modules - Array of module configs with optional port preferences
 * @returns Promise resolving to map of module names to allocated ports
 */
export async function allocatePortsForModules(
  modules: Array<{ name: string; preferredPort?: number }>
): Promise<Map<string, number>> {
  const allocations = new Map<string, number>();

  for (const module of modules) {
    if (module.preferredPort) {
      const available = await isPortAvailable(module.preferredPort);
      if (available) {
        allocations.set(module.name, module.preferredPort);
        continue;
      }
    }

    const startPort = module.preferredPort ?? 3000;
    const port = await findAvailablePort(startPort);

    if (port) {
      allocations.set(module.name, port);
    } else {
      const randomPort = await getRandomAvailablePort();
      allocations.set(module.name, randomPort);
    }
  }

  return allocations;
}

/**
 * Common port ranges for different services
 */
export const PORT_RANGES = {
  DEVELOPMENT: { start: 3000, end: 3999 },
  HTTP_ALT: { start: 8000, end: 8999 },
  EPHEMERAL: { start: 49152, end: 65535 },
  DATABASES: { start: 5000, end: 5999 },
  CUSTOM: { start: 10000, end: 19999 },
} as const;

/**
 * Find available port in a named range
 *
 * @param rangeName - Name of port range from PORT_RANGES
 * @param host - Host to check (default: 0.0.0.0)
 * @returns Promise resolving to available port or null
 */
export async function findPortInRange(
  rangeName: keyof typeof PORT_RANGES,
  host = '0.0.0.0'
): Promise<number | null> {
  const range = PORT_RANGES[rangeName];
  return findAvailablePort(range.start, range.end, host);
}
