/**
 * Resource alert thresholds and utilities
 */

export interface ResourceThresholds {
  cpu: {
    warning: number; // Yellow alert threshold
    critical: number; // Red alert threshold
  };
  memory: {
    warning: number; // In bytes
    critical: number; // In bytes
  };
}

export interface ResourceAlert {
  moduleName: string;
  type: 'cpu' | 'memory';
  level: 'warning' | 'critical';
  value: number;
  threshold: number;
  timestamp: Date;
}

export const DEFAULT_THRESHOLDS: ResourceThresholds = {
  cpu: {
    warning: 80, // 80%
    critical: 95, // 95%
  },
  memory: {
    warning: 1024 * 1024 * 1024, // 1GB
    critical: 2 * 1024 * 1024 * 1024, // 2GB
  },
};

/**
 * Check if a module exceeds resource thresholds
 */
export function checkResourceAlerts(
  module: { name: string; cpu?: number; memory?: number },
  thresholds: ResourceThresholds = DEFAULT_THRESHOLDS
): ResourceAlert[] {
  const alerts: ResourceAlert[] = [];

  // Check CPU
  if (module.cpu !== undefined) {
    if (module.cpu >= thresholds.cpu.critical) {
      alerts.push({
        moduleName: module.name,
        type: 'cpu',
        level: 'critical',
        value: module.cpu,
        threshold: thresholds.cpu.critical,
        timestamp: new Date(),
      });
    } else if (module.cpu >= thresholds.cpu.warning) {
      alerts.push({
        moduleName: module.name,
        type: 'cpu',
        level: 'warning',
        value: module.cpu,
        threshold: thresholds.cpu.warning,
        timestamp: new Date(),
      });
    }
  }

  // Check Memory
  if (module.memory !== undefined) {
    if (module.memory >= thresholds.memory.critical) {
      alerts.push({
        moduleName: module.name,
        type: 'memory',
        level: 'critical',
        value: module.memory,
        threshold: thresholds.memory.critical,
        timestamp: new Date(),
      });
    } else if (module.memory >= thresholds.memory.warning) {
      alerts.push({
        moduleName: module.name,
        type: 'memory',
        level: 'warning',
        value: module.memory,
        threshold: thresholds.memory.warning,
        timestamp: new Date(),
      });
    }
  }

  return alerts;
}

/**
 * Get alert icon based on level
 */
export function getAlertIcon(level: 'warning' | 'critical'): string {
  return level === 'critical' ? '🔥' : '⚠';
}

/**
 * Get alert color based on level
 */
export function getAlertColor(level: 'warning' | 'critical'): 'yellow' | 'red' {
  return level === 'critical' ? 'red' : 'yellow';
}
