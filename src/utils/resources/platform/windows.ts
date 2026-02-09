/**
 * Windows-specific async resource monitoring
 * Uses PowerShell commands via async exec
 */

import { execPowerShell, parseNumeric } from '../async.js';

export interface ResourceStats {
  totalMemory: number;
  usedMemory: number;
  freeMemory: number;
  cpuCount: number;
  cpuUsage: number;
}

/**
 * Get system resource stats for Windows
 */
export async function getResourceStats(): Promise<ResourceStats> {
  try {
    // Run all PowerShell commands in parallel
    const [memOutput, cpuCountOutput, cpuUsageOutput] = await Promise.all([
      execPowerShell(
        '$os = Get-CimInstance Win32_OperatingSystem; @{Total=$os.TotalVisibleMemorySize; Free=$os.FreePhysicalMemory} | ConvertTo-Json'
      ),
      execPowerShell('(Get-CimInstance Win32_ComputerSystem).NumberOfLogicalProcessors'),
      execPowerShell(
        "(Get-Counter '\\Processor(_Total)\\% Processor Time').CounterSamples[0].CookedValue"
      ),
    ]);

    // Parse memory data
    let totalMemory = 0;
    let freeMemory = 0;
    let usedMemory = 0;

    try {
      const memData = JSON.parse(memOutput);
      totalMemory = memData.Total / 1024; // Convert KB to MB
      freeMemory = memData.Free / 1024;
      usedMemory = totalMemory - freeMemory;
    } catch {
      // Fallback to 0 on parse error
    }

    const cpuCount = parseNumeric(cpuCountOutput) || 1;
    const cpuUsage = parseNumeric(cpuUsageOutput);

    return {
      totalMemory,
      usedMemory,
      freeMemory,
      cpuCount,
      cpuUsage,
    };
  } catch (_error) {
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
