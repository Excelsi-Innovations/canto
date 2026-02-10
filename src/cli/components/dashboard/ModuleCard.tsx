import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ModuleStatus } from '../../types.js';
import { formatMemory, formatCPU } from '../../../utils/resources.js';
import type { ModuleRestartState } from '../../lib/auto-restart-manager.js';
import type { Theme } from '../../../utils/preferences.js';
import { getModuleIcon } from '../../lib/icons.js';
import { 
  getStatusConfig, 
  formatUptime, 
  getAutoRestartInfo, 
  getModuleAlert 
} from './ModuleStatusUtils.js';
import { getAlertIcon, getAlertColor } from '../../lib/resource-alerts.js';

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

    // Get status configuration using shared util
    const status = getStatusConfig(module.status, theme);

    const favoriteIcon = isFavorite ? '★' : '☆';
    const checkboxIcon = isChecked ? '☑' : '☐';

    // Check for resource alerts using shared util
    const alert = getModuleAlert(module);

    // Format auto-restart info using shared util
    const autoRestartInfo = useMemo(() => getAutoRestartInfo(autoRestartState), [autoRestartState]);

    // Collect all ports from containers for inline display
    const allPorts = (module.containers ?? []).flatMap((c) => c.ports).filter((p) => p.length > 0);

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
    const prevContainers = prevProps.module.containers ?? [];
    const nextContainers = nextProps.module.containers ?? [];
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

