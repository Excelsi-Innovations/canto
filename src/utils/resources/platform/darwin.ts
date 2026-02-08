/**
 * macOS-specific async resource monitoring
 * Uses vm_stat, sysctl, and top commands via async exec
 */

import { execCommand, parseNumeric } from '../async.js';

export interface ResourceStats {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuUsage: number;
}

/**
 * Get system resource stats for macOS
 */
export async function getResourceStats(): Promise<ResourceStats> {
  try {
    const pageSize = 4096; // bytes

    // Run all commands in parallel
    const [vmOutput, totalMemOutput, cpuCountOutput, topOutput] = await Promise.all([
      execCommand('vm_stat'),
      execCommand('sysctl hw.memsize'),
      execCommand('sysctl -n hw.ncpu'),
      execCommand('top -l 1 -n 0 | grep "CPU usage"'),
    ]);

    // Parse vm_stat output
    const getPages = (line: string | undefined): number => {
      if (!line) return 0;
      const match = line.match(/:\s+(\d+)/);
      return match?.[1] ? parseInt(match[1]) : 0;
    };

    const lines = vmOutput.split('\n');
    const freePages = getPages(lines.find((l) => l.includes('Pages free')));
    const activePages = getPages(lines.find((l) => l.includes('Pages active')));
    const inactivePages = getPages(lines.find((l) => l.includes('Pages inactive')));
    const wiredPages = getPages(lines.find((l) => l.includes('Pages wired down')));

    // Parse total memory
    const totalMemMatch = totalMemOutput.match(/\d+/);
    const totalMemBytes = totalMemMatch ? parseInt(totalMemMatch[0]) : 0;
    const totalMemory = totalMemBytes / (1024 * 1024); // Convert to MB

    const freeMemory = (freePages * pageSize) / (1024 * 1024);
    const usedMemory = ((activePages + inactivePages + wiredPages) * pageSize) / (1024 * 1024);

    // Parse CPU count
    const cpuCount = parseNumeric(cpuCountOutput) || 1;

    // Parse CPU usage from top
    const cpuMatch = topOutput.match(/(\d+\.\d+)% user/);
    const cpuUsage = cpuMatch?.[1] ? parseFloat(cpuMatch[1]) : 0;

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
