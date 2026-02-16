import { platform } from 'os';
import type { GlobalResources, ProcessResources, SystemResources } from './types.js';
import {
  getWindowsGlobalResources,
  getWindowsProcessResources,
  getWindowsSystemResources,
} from './platform/windows.js';
import { getDarwinProcessResources, getDarwinSystemResources } from './platform/darwin.js';
import { getLinuxProcessResources, getLinuxSystemResources } from './platform/linux.js';

export * from './types.js';

/**
 * Get both system and process-specific resources in a single optimized call.
 */
export async function getGlobalResources(pids: number[]): Promise<GlobalResources> {
  const os = platform();

  if (os === 'win32') {
    return getWindowsGlobalResources(pids);
  }

  // Fallback for Unix/MacOS
  const [system, ...procResults] = await Promise.all([
    getSystemResources(),
    ...pids.map((pid) => getProcessResources(pid)),
  ]);

  const processes = new Map<number, ProcessResources>();
  procResults.forEach((res) => {
    if (res) processes.set(res.pid, res);
  });

  return { system, processes };
}

/**
 * Get system-wide resource information
 */
export async function getSystemResources(): Promise<SystemResources> {
  const os = platform();
  try {
    if (os === 'win32') {
      return await getWindowsSystemResources();
    }
    if (os === 'darwin') {
      return await getDarwinSystemResources();
    }
    return await getLinuxSystemResources();
  } catch {
    return {
      totalMemory: 0,
      usedMemory: 0,
      freeMemory: 0,
      cpuCount: 1,
      cpuUsage: 0,
    };
  }
}

/**
 * Get resource usage for a specific process by PID
 */
export async function getProcessResources(pid: number): Promise<ProcessResources | null> {
  const os = platform();
  try {
    if (os === 'win32') {
      return await getWindowsProcessResources(pid);
    }
    if (os === 'darwin') {
      return await getDarwinProcessResources(pid);
    }
    return await getLinuxProcessResources(pid);
  } catch {
    return null;
  }
}

/**
 * Create a simple ASCII bar chart
 */
export function createBar(value: number, max: number, width: number = 20): string {
  const percentage = Math.min((value / max) * 100, 100);
  const filledWidth = Math.round((percentage / 100) * width);
  const emptyWidth = width - filledWidth;

  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(emptyWidth);

  return `${filled}${empty}`;
}

/**
 * Format bytes to human-readable string
 */
export function formatMemory(mb: number): string {
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Format CPU percentage
 */
export function formatCPU(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}
