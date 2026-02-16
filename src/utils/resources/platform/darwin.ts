/**
 * macOS-specific async resource monitoring
 */

import { execCommand, parseNumeric } from '../async.js';
import type { ProcessResources, SystemResources } from '../types.js';

/**
 * Get system resource stats for macOS
 */
export async function getDarwinSystemResources(): Promise<SystemResources> {
  try {
    const pageSize = 4096;

    const [vmOutput, totalMemOutput, cpuCountOutput, topOutput] = await Promise.all([
      execCommand('vm_stat'),
      execCommand('sysctl hw.memsize'),
      execCommand('sysctl -n hw.ncpu'),
      execCommand('top -l 1 -n 0 | grep "CPU usage"'),
    ]);

    const getPages = (key: string): number => {
      const match = vmOutput
        .split('\n')
        .find((l) => l.includes(key))
        ?.match(/:\s+(\d+)/);
      return match?.[1] ? parseInt(match[1]) : 0;
    };

    const totalMemMatch = totalMemOutput.match(/\d+/);
    const totalMemBytes = totalMemMatch ? parseInt(totalMemMatch[0]) : 0;
    const totalMemory = totalMemBytes / (1024 * 1024);

    const freeMemory = (getPages('Pages free') * pageSize) / (1024 * 1024);
    const usedMemory =
      ((getPages('Pages active') + getPages('Pages inactive') + getPages('Pages wired down')) *
        pageSize) /
      (1024 * 1024);

    const cpuCount = parseNumeric(cpuCountOutput) || 1;
    const cpuMatch = topOutput.match(/(\d+\.\d+)% user/);
    const cpuUsage = cpuMatch?.[1] ? parseFloat(cpuMatch[1]) : 0;

    return {
      totalMemory,
      usedMemory,
      freeMemory,
      cpuCount,
      cpuUsage,
    };
  } catch {
    return { totalMemory: 0, usedMemory: 0, freeMemory: 0, cpuCount: 1, cpuUsage: 0 };
  }
}

/**
 * Get process resources for macOS
 */
export async function getDarwinProcessResources(pid: number): Promise<ProcessResources | null> {
  try {
    const output = await execCommand(`ps -p ${pid} -o %cpu,%mem,rss`);
    const lines = output.trim().split('\n');
    if (lines.length < 2) return null;

    const parts = lines[1]?.trim().split(/\s+/) ?? [];
    const [cpu, mem, rss] = parts;
    if (!cpu || !mem || !rss) return null;

    return {
      pid,
      cpu: parseFloat(cpu),
      memory: parseInt(rss) / 1024,
      memoryPercent: parseFloat(mem),
    };
  } catch {
    return null;
  }
}
