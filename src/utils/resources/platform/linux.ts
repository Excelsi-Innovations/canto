/**
 * Linux-specific async resource monitoring
 * Uses /proc/meminfo, /proc/stat, and nproc via async operations
 */

import { readFileAsync, execCommand, parseNumeric } from '../async.js';

export interface ResourceStats {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuUsage: number;
}

/**
 * Get system resource stats for Linux
 */
export async function getResourceStats(): Promise<ResourceStats> {
  try {
    // Run all operations in parallel
    const [meminfo, stat, cpuCountOutput] = await Promise.all([
      readFileAsync('/proc/meminfo'),
      execCommand('cat /proc/stat | grep "^cpu "'),
      execCommand('nproc'),
    ]);

    // Parse memory info
    const getMemValue = (key: string): number => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match?.[1] ? parseInt(match[1]) / 1024 : 0; // Convert KB to MB
    };

    const totalMemory = getMemValue('MemTotal');
    const freeMemory = getMemValue('MemFree') + getMemValue('Buffers') + getMemValue('Cached');
    const usedMemory = totalMemory - freeMemory;

    // Parse CPU count
    const cpuCount = parseNumeric(cpuCountOutput) || 1;

    // Parse CPU usage from /proc/stat
    let cpuUsage = 0;
    const values = stat.trim().split(/\s+/).slice(1).map(Number);
    if (values.length > 3) {
      const idle = values[3] ?? 0;
      const total = values.reduce((a, b) => a + b, 0);
      cpuUsage = total > 0 ? ((total - idle) / total) * 100 : 0;
    }

    return {
      totalMemory,
      usedMemory,
      freeMemory,
      cpuCount,
      cpuUsage,
    };
  } catch (error) {
    // Return safe defaults on error
    return {
      totalMemory: 0,
      usedMemory: 0,
      freeMemory: 0,
      cpuCount: 1,
      cpuUsage: 0,
    };
  }
}
