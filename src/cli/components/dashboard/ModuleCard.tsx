import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ModuleStatus } from '../../types.js';
import { formatMemory, formatCPU } from '../../../utils/resources.js';
import { checkResourceAlerts, getAlertIcon, getAlertColor } from '../../lib/resource-alerts.js';
import type { ModuleRestartState } from '../../lib/auto-restart-manager.js';
import type { Theme } from '../../../utils/preferences.js';
import { getModuleIcon, getStatusIcon } from '../../lib/icons.js';

interface ModuleCardProps {
  module: ModuleStatus;
  isSelected: boolean;
  isFavorite: boolean;
  isChecked: boolean;
  autoRestartState: ModuleRestartState | null;
  theme: Theme;
}

export const ModuleCard: React.FC<ModuleCardProps> = React.memo(
  ({ module, isSelected, isFavorite, isChecked, autoRestartState, theme }) => {
    // Get contextual icon based on module type and name
    const moduleIcon = getModuleIcon(module.type, module.name);
    const statusIcon = getStatusIcon(module.status);

    // Status configuration with hex colors
    const statusConfig = {
      RUNNING: { icon: statusIcon, color: theme.colors.success },
      STOPPED: { icon: statusIcon, color: theme.colors.muted },
      STARTING: { icon: statusIcon, color: theme.colors.warning },
      STOPPING: { icon: statusIcon, color: theme.colors.warning },
      ERROR: { icon: statusIcon, color: theme.colors.error },
    };

    const status = statusConfig[module.status as keyof typeof statusConfig] || {
      icon: '?',
      color: theme.colors.muted,
    };

    const favoriteIcon = isFavorite ? '★' : '☆';
    const checkboxIcon = isChecked ? '☑' : '☐';

    // Check for resource alerts
    const alerts = checkResourceAlerts(module);
    const criticalAlert = alerts.find((a) => a.level === 'critical');
    const warningAlert = alerts.find((a) => a.level === 'warning');
    const alert = criticalAlert || warningAlert;

    // Format auto-restart info
    const autoRestartInfo = useMemo(() => {
      if (!autoRestartState || !autoRestartState.nextRetryAt) return null;

      const now = Date.now();
      const nextRetry = autoRestartState.nextRetryAt.getTime();
      const secondsRemaining = Math.max(0, Math.ceil((nextRetry - now) / 1000));

      return {
        retryCount: autoRestartState.retryCount,
        secondsRemaining,
        isRestarting: autoRestartState.isRestarting,
      };
    }, [autoRestartState]);

    // Format uptime helper
    const formatUptime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ${minutes % 60}m`;
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    };

    // Collect all ports from containers for inline display
    const allPorts = (module.containers || []).flatMap((c) => c.ports).filter((p) => p.length > 0);

    return (
      <Box
        borderStyle={isSelected ? 'double' : 'round'}
        borderColor={isSelected ? theme.colors.primary : theme.colors.border}
        paddingX={1}
        marginBottom={0}
        flexDirection="column"
      >
        {/* Top Row: Checkbox, Favorite, Status, Icon, Name, Uptime, Ports */}
        <Box>
          <Text color={isChecked ? theme.colors.primary : theme.colors.muted}>{checkboxIcon}</Text>
          <Text> </Text>
          <Text color={isFavorite ? theme.colors.warning : theme.colors.muted}>{favoriteIcon}</Text>
          <Text> </Text>
          <Text color={status.color}>{status.icon}</Text>
          <Text> </Text>
          <Text color={theme.colors.info}>{moduleIcon}</Text>
          <Text> </Text>
          <Text bold color={isSelected ? theme.colors.primary : 'white'}>
            {module.name}
          </Text>
          {module.uptime !== undefined && module.uptime > 0 && (
            <>
              <Text> </Text>
              <Text dimColor color={theme.colors.muted}>
                {formatUptime(module.uptime)}
              </Text>
            </>
          )}
          {allPorts.length > 0 && (
            <>
              <Text> </Text>
              <Text dimColor color={theme.colors.info}>
                [{allPorts.slice(0, 3).join(', ')}]
              </Text>
            </>
          )}
          {alert && (
            <>
              <Text> </Text>
              <Text color={getAlertColor(alert.level)}>{getAlertIcon(alert.level)}</Text>
            </>
          )}
          {autoRestartInfo && !autoRestartInfo.isRestarting && (
            <>
              <Text> </Text>
              <Text color={theme.colors.info}>↻ {autoRestartInfo.secondsRemaining}s</Text>
            </>
          )}
          {autoRestartInfo?.isRestarting && (
            <>
              <Text> </Text>
              <Text color={theme.colors.warning}>⟳ Restarting...</Text>
            </>
          )}
        </Box>

        {/* Second Row: Type, PID, CPU, RAM */}
        <Box marginTop={0}>
          <Text dimColor>
            <Text color={theme.colors.info}>{module.type}</Text>
          </Text>
          {module.pid && (
            <>
              <Text dimColor> • </Text>
              <Text dimColor>
                PID <Text color={theme.colors.info}>{module.pid}</Text>
              </Text>
            </>
          )}
          {module.cpu !== undefined && (
            <>
              <Text dimColor> • </Text>
              <Text dimColor>
                CPU <Text color={theme.colors.warning}>{formatCPU(module.cpu)}</Text>
              </Text>
            </>
          )}
          {module.memory !== undefined && (
            <>
              <Text dimColor> • </Text>
              <Text dimColor>
                RAM <Text color={theme.colors.warning}>{formatMemory(module.memory)}</Text>
              </Text>
            </>
          )}
        </Box>

        {/* Show Docker containers if available */}
        {module.containers && module.containers.length > 0 && (
          <Box marginTop={0} flexDirection="column">
            {module.containers.map((container) => (
              <Box key={container.name} marginLeft={2}>
                <Text color={container.status === 'running' ? theme.colors.success : 'gray'}>
                  {container.status === 'running' ? '●' : '○'}
                </Text>
                <Text> </Text>
                <Text dimColor>{container.name}</Text>
                {container.ports.length > 0 && (
                  <>
                    <Text dimColor> • </Text>
                    <Text color={theme.colors.info}>{container.ports.join(', ')}</Text>
                  </>
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  },
  // Custom comparison function for memoization
  (prevProps, nextProps) => {
    const areEqual =
      prevProps.module.name === nextProps.module.name &&
      prevProps.module.status === nextProps.module.status &&
      prevProps.module.pid === nextProps.module.pid &&
      prevProps.module.cpu === nextProps.module.cpu &&
      prevProps.module.memory === nextProps.module.memory &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.isFavorite === nextProps.isFavorite &&
      prevProps.isChecked === nextProps.isChecked;

    if (!areEqual) return false;

    // Compare containers
    const prevContainers = prevProps.module.containers || [];
    const nextContainers = nextProps.module.containers || [];
    if (prevContainers.length !== nextContainers.length) return false;

    // Compare autoRestartState
    const prevRestart = prevProps.autoRestartState;
    const nextRestart = nextProps.autoRestartState;
    if (prevRestart && nextRestart) {
      if (
        prevRestart.retryCount !== nextRestart.retryCount ||
        prevRestart.isRestarting !== nextRestart.isRestarting ||
        prevRestart.nextRetryAt?.getTime() !== nextRestart.nextRetryAt?.getTime()
      ) {
        return false;
      }
    } else if (prevRestart !== nextRestart) {
      return false;
    }

    return true;
  }
);

ModuleCard.displayName = 'ModuleCard';
