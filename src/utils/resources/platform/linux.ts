/**
 * Linux-specific async resource monitoring
 */

import { readFileAsync, execCommand, parseNumeric } from '../async.js';
import type { ProcessResources, SystemResources } from '../types.js';

/**
 * Get system resource stats for Linux
 */
export async function getLinuxSystemResources(): Promise<SystemResources> {
  try {
    const [meminfo, stat, cpuCountOutput] = await Promise.all([
      readFileAsync('/proc/meminfo'),
      execCommand('cat /proc/stat | grep "^cpu "'),
      execCommand('nproc'),
    ]);

    const getMemValue = (key: string): number => {
      const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
      return match?.[1] ? parseInt(match[1]) / 1024 : 0;
    };

    const totalMemory = getMemValue('MemTotal');
    const freeMemory = getMemValue('MemFree') + getMemValue('Buffers') + getMemValue('Cached');

    const cpuCount = parseNumeric(cpuCountOutput) || 1;
    let cpuUsage = 0;
    const values = stat.trim().split(/\s+/).slice(1).map(Number);
    if (values.length > 3) {
      const idle = values[3] ?? 0;
      const total = values.reduce((a, b) => a + b, 0);
      cpuUsage = total > 0 ? ((total - idle) / total) * 100 : 0;
    }

    return {
      totalMemory,
      usedMemory: totalMemory - freeMemory,
      freeMemory,
      cpuCount,
      cpuUsage,
    };
  } catch {
    return { totalMemory: 0, usedMemory: 0, freeMemory: 0, cpuCount: 1, cpuUsage: 0 };
  }
}

/**
 * Get process resources for Linux
 */
export async function getLinuxProcessResources(pid: number): Promise<ProcessResources | null> {
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
