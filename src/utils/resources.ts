import { exec } from 'child_process';
import { platform } from 'os';
import { promisify } from 'util';

const execAsync = promisify(exec);
let cachedTotalMemory = 0;

/**
 * Process resource usage information
 */
export interface ProcessResources {
  pid: number;
  cpu: number; // CPU percentage
  memory: number; // Memory in MB
  memoryPercent: number; // Memory percentage
}

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

/**
 * Get resource usage for a specific process by PID
 *
 * @param pid - Process ID
 * @returns Process resource usage or null if not found
 */
export async function getProcessResources(pid: number): Promise<ProcessResources | null> {
  try {
    const os = platform();

    if (os === 'win32') {
      // Windows: Use WMIC or PowerShell
      const { stdout: output } = await execAsync(
        `powershell "Get-Process -Id ${pid} | Select-Object CPU,WorkingSet | ConvertTo-Json"`,
        { encoding: 'utf-8' }
      );

      const data = JSON.parse(output);
      const memoryMB = data.WorkingSet / (1024 * 1024);

      let totalMemory = 0;
      if (cachedTotalMemory > 0) {
        totalMemory = cachedTotalMemory;
      } else {
        // Get total memory (cached)
        const { stdout: totalMemOutput } = await execAsync(
          'powershell "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"',
          { encoding: 'utf-8' }
        );
        cachedTotalMemory = parseInt(totalMemOutput.trim()) / (1024 * 1024);
        totalMemory = cachedTotalMemory;
      }

      const memoryPercent = (memoryMB / totalMemory) * 100;

      return {
        pid,
        cpu: parseFloat(data.CPU) || 0,
        memory: memoryMB,
        memoryPercent,
      };
    } else {
      // Unix/Linux/macOS: Use ps
      const { stdout: output } = await execAsync(`ps -p ${pid} -o %cpu,%mem,rss`, {
        encoding: 'utf-8',
      });

      const lines = output.trim().split('\n');
      if (lines.length < 2) return null;

      const secondLine = lines[1];
      if (!secondLine) return null;

      const parts = secondLine.trim().split(/\s+/);
      if (parts.length < 3) return null;

      const [cpu, mem, rss] = parts;
      if (!cpu || !mem || !rss) return null;

      const memoryMB = parseInt(rss) / 1024;

      return {
        pid,
        cpu: parseFloat(cpu),
        memory: memoryMB,
        memoryPercent: parseFloat(mem),
      };
    }
  } catch (_error) {
    return null;
  }
}

/**
 * Get system-wide resource information
 *
 * @returns System resource usage
 */
export async function getSystemResources(): Promise<SystemResources> {
  try {
    const os = platform();

    if (os === 'win32') {
      // Windows
      const { stdout: memOutput } = await execAsync(
        'powershell "$os = Get-CimInstance Win32_OperatingSystem; @{Total=$os.TotalVisibleMemorySize; Free=$os.FreePhysicalMemory} | ConvertTo-Json"',
        { encoding: 'utf-8' }
      );

      const memData = JSON.parse(memOutput);
      const totalMemory = memData.Total / 1024; // Convert KB to MB
      const freeMemory = memData.Free / 1024;
      const usedMemory = totalMemory - freeMemory;

      // Get CPU count
      const { stdout: cpuOutput } = await execAsync(
        'powershell "(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors"',
        { encoding: 'utf-8' }
      );
      const cpuCount = parseInt(cpuOutput.trim());

      // Get CPU usage (approximate)
      const { stdout: cpuUsageOutput } = await execAsync(
        'powershell "(Get-Counter \'\\Processor(_Total)\\% Processor Time\').CounterSamples[0].CookedValue"',
        { encoding: 'utf-8' }
      );
      const cpuUsage = parseFloat(cpuUsageOutput.trim());

      return {
        totalMemory,
        usedMemory,
        freeMemory,
        cpuCount,
        cpuUsage,
      };
    } else if (os === 'darwin') {
      // macOS
      const { stdout: vmOutput } = await execAsync('vm_stat', { encoding: 'utf-8' });
      const pageSize = 4096; // bytes

      const getPages = (line: string | undefined) => {
        if (!line) return 0;
        const match = line.match(/:\s+(\d+)/);
        return match?.[1] ? parseInt(match[1]) : 0;
      };

      const lines = vmOutput.split('\n');
      const freePages = getPages(lines.find((l) => l.includes('Pages free')));
      const activePages = getPages(lines.find((l) => l.includes('Pages active')));
      const inactivePages = getPages(lines.find((l) => l.includes('Pages inactive')));
      const wiredPages = getPages(lines.find((l) => l.includes('Pages wired down')));

      const { stdout: totalMemOutput } = await execAsync('sysctl hw.memsize', {
        encoding: 'utf-8',
      });

      const totalMemory = (totalMemOutput.match(/\d+/) ?? ['0'])[0] ?? '0';
      const total = parseInt(totalMemory) / (1024 * 1024);
      const freeMemory = (freePages * pageSize) / (1024 * 1024);
      const usedMemory = ((activePages + inactivePages + wiredPages) * pageSize) / (1024 * 1024);

      const { stdout: cpuCountOutput } = await execAsync('sysctl -n hw.ncpu', {
        encoding: 'utf-8',
      });
      const cpuCount = parseInt(cpuCountOutput.trim() || '1');

      // Get CPU usage via top
      const { stdout: topOutput } = await execAsync('top -l 1 -n 0 | grep "CPU usage"', {
        encoding: 'utf-8',
      });
      const cpuMatch = topOutput.match(/(\d+\.\d+)% user/);
      const cpuUsage = cpuMatch?.[1] ? parseFloat(cpuMatch[1]) : 0;

      return {
        totalMemory: total,
        usedMemory,
        freeMemory,
        cpuCount,
        cpuUsage,
      };
    } else {
      // Linux
      const { stdout: meminfo } = await execAsync('cat /proc/meminfo', { encoding: 'utf-8' });
      const getMemValue = (key: string): number => {
        const match = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
        return match?.[1] ? parseInt(match[1]) / 1024 : 0; // Convert KB to MB
      };

      const totalMemory = getMemValue('MemTotal');
      const freeMemory = getMemValue('MemFree') + getMemValue('Buffers') + getMemValue('Cached');
      const usedMemory = totalMemory - freeMemory;

      const { stdout: cpuCountOutput } = await execAsync('nproc', { encoding: 'utf-8' });
      const cpuCount = parseInt(cpuCountOutput.trim());

      // Get CPU usage from /proc/stat
      const { stdout: stat } = await execAsync('cat /proc/stat | grep "^cpu "', {
        encoding: 'utf-8',
      });
      const values = stat.trim().split(/\s+/).slice(1).map(Number);
      const idle = values[3] ?? 0;
      const total = values.reduce((a, b) => a + b, 0);
      const cpuUsage = total > 0 ? ((total - idle) / total) * 100 : 0;

      return {
        totalMemory,
        usedMemory,
        freeMemory,
        cpuCount,
        cpuUsage,
      };
    }
  } catch (_error) {
    // Return default values on error
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
 * Create a simple ASCII bar chart
 *
 * @param value - Current value
 * @param max - Maximum value
 * @param width - Width of the bar in characters
 * @returns ASCII bar string
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
 *
 * @param mb - Megabytes
 * @returns Formatted string
 */
export function formatMemory(mb: number): string {
  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Format CPU percentage
 *
 * @param cpu - CPU percentage
 * @returns Formatted string
 */
export function formatCPU(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}
