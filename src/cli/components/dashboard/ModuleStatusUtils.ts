import type { Theme } from '../../../utils/preferences.js';
import { getStatusIcon } from '../../lib/icons.js';
import { checkResourceAlerts, type ResourceAlert } from '../../lib/resource-alerts.js';
import type { ModuleStatus } from '../../types.js';
import type { ModuleRestartState } from '../../lib/auto-restart-manager.js';

export interface ModuleStatusConfig {
  icon: string;
  color: string;
}

export const getStatusConfig = (status: string, theme: Theme): ModuleStatusConfig => {
  const statusIcon = getStatusIcon(status);
  
  // Map to theme colors or direct hex/string colors depending on how they are used.
  // ModuleRow used 'green', 'gray' strings. ModuleCard used theme.colors.success.
  // We will standardize on using the Theme object for consistency if possible, 
  // but ModuleRow seemed to use specific ink color names. 
  // Let's try to map to Theme colors which usually map to ink standard colors.
  
  const config: Record<string, ModuleStatusConfig> = {
    RUNNING: { icon: statusIcon, color: theme.colors.success },
    STOPPED: { icon: statusIcon, color: theme.colors.muted },
    STARTING: { icon: statusIcon, color: theme.colors.warning },
    STOPPING: { icon: statusIcon, color: theme.colors.warning },
    ERROR: { icon: statusIcon, color: theme.colors.error },
  };

  return config[status] ?? { icon: '?', color: theme.colors.muted };
};

export const formatUptime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
};

export interface AutoRestartInfo {
  retryCount: number;
  secondsRemaining: number;
  isRestarting: boolean;
}

export const getAutoRestartInfo = (autoRestartState: ModuleRestartState | null): AutoRestartInfo | null => {
  if (!autoRestartState?.nextRetryAt) return null;

  const now = Date.now();
  const nextRetry = autoRestartState.nextRetryAt.getTime();
  const secondsRemaining = Math.max(0, Math.ceil((nextRetry - now) / 1000));

  return {
    retryCount: autoRestartState.retryCount,
    secondsRemaining,
    isRestarting: autoRestartState.isRestarting,
  };
};

export const getModuleAlert = (module: ModuleStatus): ResourceAlert | undefined => {
    const alerts = checkResourceAlerts(module);
    const criticalAlert = alerts.find((a) => a.level === 'critical');
    const warningAlert = alerts.find((a) => a.level === 'warning');
    return criticalAlert ?? warningAlert;
};
