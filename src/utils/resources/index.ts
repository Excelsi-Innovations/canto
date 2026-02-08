/**
 * Async resource monitoring with caching
 * Main entry point for system resource monitoring
 */

import { platform } from 'os';
import { TTLCache } from './cache.js';
import * as windows from './platform/windows.js';
import * as darwin from './platform/darwin.js';
import * as linux from './platform/linux.js';

/**
 * System resource information
 */
export interface SystemResources {
  totalMemory: number; // Total RAM in MB
  usedMemory: number; // Used RAM in MB
  freeMemory: number; // Free RAM in MB
  cpuCount: number; // Number of CPU cores
  cpuUsage: number; // Overall CPU usage percentage
}

// Cache with 2-second TTL to match dashboard update interval
const resourceCache = new TTLCache<SystemResources>(2000);

/**
 * Get system resources asynchronously with caching
 * Returns cached data if available and fresh (< 2s old)
 * Otherwise fetches new data and caches it
 */
export async function getSystemResources(): Promise<SystemResources> {
  // Check cache first
  const cached = resourceCache.get('system');
  if (cached) {
    return cached;
  }

  // Fetch new data based on platform
  let resources: SystemResources;
  const os = platform();

  if (os === 'win32') {
    resources = await windows.getResourceStats();
  } else if (os === 'darwin') {
    resources = await darwin.getResourceStats();
  } else {
    resources = await linux.getResourceStats();
  }

  // Cache the result
  resourceCache.set('system', resources);

  return resources;
}

/**
 * Clear the resource cache
 * Useful for testing or forcing fresh data
 */
export function clearResourceCache(): void {
  resourceCache.clear();
}

/**
 * Get resource usage for a specific process by PID
 * Note: This function is still synchronous and uses the old implementation
 * TODO: Implement async version in future iteration
 */
export function getProcessResources(_pid: number): null {
  // Placeholder - process-specific monitoring not yet implemented in async version
  // The dashboard doesn't currently use this function
  return null;
}
