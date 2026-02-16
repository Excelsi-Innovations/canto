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
 * Global resource information
 */
export interface GlobalResources {
  system: SystemResources;
  processes: Map<number, ProcessResources>;
}
