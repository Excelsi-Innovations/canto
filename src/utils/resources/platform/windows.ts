/**
 * Windows-specific async resource monitoring
 */

import { execPowerShell } from '../async.js';
import type { GlobalResources, ProcessResources, SystemResources } from '../types.js';

let cachedTotalMemory = 0;

/**
 * Get both system and process-specific resources in a single optimized call.
 * This is crucial for performance on Windows to avoid spawning multiple PowerShell processes.
 */
export async function getWindowsGlobalResources(pids: number[]): Promise<GlobalResources> {
  const pidList = pids.length > 0 ? pids.join(',') : '0';

  const script = `
    $os = Get-CimInstance Win32_OperatingSystem;
    $sysCpu = (Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue;
    if (!$sysCpu) { $sysCpu = 0 };
    $cpuCount = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors;
    
    $procData = if ("${pidList}" -ne "0") {
      Get-Process -Id ${pidList} -ErrorAction SilentlyContinue | Select-Object Id, CPU, WorkingSet | ConvertTo-Json
    } else { "{}" };

    @{
      TotalMem = $os.TotalVisibleMemorySize;
      FreeMem = $os.FreePhysicalMemory;
      CpuUsage = $sysCpu;
      CpuCount = $cpuCount;
      Processes = $procData;
    } | ConvertTo-Json
  `;

  try {
    const cleanScript = script.replace(/\n\s+/g, ' ').trim();
    const stdout = await execPowerShell(cleanScript);

    if (!stdout) throw new Error('Empty PowerShell output');

    const data = JSON.parse(stdout);
    const totalMemory = data.TotalMem / 1024;
    const freeMemory = data.FreeMem / 1024;

    const results: GlobalResources = {
      system: {
        totalMemory,
        freeMemory,
        usedMemory: totalMemory - freeMemory,
        cpuCount: data.CpuCount,
        cpuUsage: parseFloat(data.CpuUsage) || 0,
      },
      processes: new Map(),
    };

    interface PSProcessData {
      Id: number;
      CPU: string;
      WorkingSet: number;
    }

    if (data.Processes && data.Processes !== '{}') {
      const procRaw = JSON.parse(data.Processes);
      const procList: PSProcessData[] = Array.isArray(procRaw) ? procRaw : [procRaw];

      procList.forEach((p) => {
        if (p?.Id) {
          const memMB = p.WorkingSet / (1024 * 1024);
          results.processes.set(p.Id, {
            pid: p.Id,
            cpu: parseFloat(p.CPU) || 0,
            memory: memMB,
            memoryPercent: (memMB / results.system.totalMemory) * 100,
          });
        }
      });
    }

    return results;
  } catch (_error) {
    return {
      system: { totalMemory: 0, usedMemory: 0, freeMemory: 0, cpuCount: 1, cpuUsage: 0 },
      processes: new Map(),
    };
  }
}

/**
 * Get system resource stats for Windows
 */
export async function getWindowsSystemResources(): Promise<SystemResources> {
  try {
    const command = `
      $os = Get-CimInstance Win32_OperatingSystem;
      $cpu = (Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors;
      $load = (Get-Counter '\\Processor(_Total)\\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue;
      @{
        TotalMem=$os.TotalVisibleMemorySize;
        FreeMem=$os.FreePhysicalMemory;
        CpuCount=$cpu;
        CpuLoad=$load
      } | ConvertTo-Json -Compress
    `.replace(/\s+/g, ' ');

    const output = await execPowerShell(command);
    const data = JSON.parse(output);

    const totalMemory = (data.TotalMem ?? 0) / 1024;
    const freeMemory = (data.FreeMem ?? 0) / 1024;

    return {
      totalMemory,
      usedMemory: totalMemory - freeMemory,
      freeMemory,
      cpuCount: Number(data.CpuCount) || 1,
      cpuUsage: Number(data.CpuLoad) || 0,
    };
  } catch {
    return { totalMemory: 0, usedMemory: 0, freeMemory: 0, cpuCount: 1, cpuUsage: 0 };
  }
}

/**
 * Get process resources for Windows
 */
export async function getWindowsProcessResources(pid: number): Promise<ProcessResources | null> {
  try {
    const output = await execPowerShell(
      `Get-Process -Id ${pid} | Select-Object CPU,WorkingSet | ConvertTo-Json`
    );
    if (!output) return null;

    const data = JSON.parse(output);
    const memoryMB = data.WorkingSet / (1024 * 1024);

    if (!cachedTotalMemory) {
      const totalMemOutput = await execPowerShell(
        '(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory'
      );
      cachedTotalMemory = parseInt(totalMemOutput.trim()) / (1024 * 1024);
    }

    return {
      pid,
      cpu: parseFloat(data.CPU) || 0,
      memory: memoryMB,
      memoryPercent: (memoryMB / cachedTotalMemory) * 100,
    };
  } catch {
    return null;
  }
}
