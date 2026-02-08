import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ModuleStatus } from '../../types.js';
import { formatMemory, createBar } from '../../../utils/resources.js';
import { checkResourceAlerts, getAlertIcon, getAlertColor } from '../../lib/resource-alerts.js';
import type { ModuleRestartState } from '../../lib/auto-restart-manager.js';

interface ModuleRowProps {
  module: ModuleStatus;
  isSelected: boolean;
  searchQuery?: string;
  isFavorite?: boolean;
  autoRestartState?: ModuleRestartState | null;
  isChecked?: boolean;
}

/**
 * Highlights the search query within the module name (memoized)
 */
function useHighlightedText(text: string, query: string): React.ReactNode {
  return useMemo(() => {
    if (!query) {
      return <Text>{text}</Text>;
    }

    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const index = lowerText.indexOf(lowerQuery);

    if (index === -1) {
      return <Text>{text}</Text>;
    }

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return (
      <>
        <Text>{before}</Text>
        <Text color="cyan" bold>
          {match}
        </Text>
        <Text>{after}</Text>
      </>
    );
  }, [text, query]);
}

export const ModuleRow: React.FC<ModuleRowProps> = React.memo(
  ({
    module,
    isSelected,
    searchQuery,
    isFavorite = false,
    autoRestartState = null,
    isChecked = false,
  }) => {
    // Enhanced status badges with colors
    const statusConfig = {
      RUNNING: { icon: '●', color: 'green' as const },
      STOPPED: { icon: '○', color: 'gray' as const },
      STARTING: { icon: '◐', color: 'yellow' as const },
      STOPPING: { icon: '◑', color: 'yellow' as const },
      ERROR: { icon: '✗', color: 'red' as const },
    };

    const status = statusConfig[module.status as keyof typeof statusConfig] || {
      icon: '?',
      color: 'gray' as const,
    };
    const favoriteIcon = isFavorite ? '★' : '☆';
    const checkboxIcon = isChecked ? '☑' : '☐';
    const highlightedName = useHighlightedText(module.name, searchQuery ?? '');

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

    return (
      <Box marginBottom={1} flexDirection="column">
        <Box width="100%">
          <Text
            backgroundColor={isSelected ? 'blue' : undefined}
            color={isSelected ? 'white' : undefined}
          >
            {isSelected ? '❯' : ' '} <Text color={isChecked ? 'cyan' : 'gray'}>{checkboxIcon}</Text>{' '}
            <Text color={isFavorite ? 'yellow' : 'gray'}>{favoriteIcon}</Text>{' '}
            <Text color={status.color}>{status.icon}</Text> {highlightedName}
            {' '.repeat(Math.max(1, 18 - module.name.length))}
            <Text>{module.type.padEnd(10)}</Text>
            {alert && <Text color={getAlertColor(alert.level)}> {getAlertIcon(alert.level)}</Text>}
            {autoRestartInfo && !autoRestartInfo.isRestarting && (
              <Text color="cyan"> 🔄{autoRestartInfo.secondsRemaining}s</Text>
            )}
            {autoRestartInfo?.isRestarting && <Text color="yellow"> ⟳</Text>}
          </Text>
          {module.pid && (
            <>
              <Text dimColor> PID {module.pid}</Text>
              {module.cpu !== undefined && <Text dimColor> • CPU {module.cpu.toFixed(1)}%</Text>}
              {module.memory !== undefined && (
                <Text dimColor> • RAM {formatMemory(module.memory)}</Text>
              )}
            </>
          )}
        </Box>

        {/* Show performance metrics if selected and module is running */}
        {isSelected && module.pid && (
          <Box marginLeft={4} marginTop={1} flexDirection="column">
            {module.cpu !== undefined && (
              <Text dimColor>
                CPU: {createBar(module.cpu, 100, 10)} {module.cpu.toFixed(1)}%
              </Text>
            )}
            {module.memory !== undefined && (
              <Text dimColor>
                RAM: {createBar(module.memory, 1024 * 1024 * 1024, 10)}{' '}
                {formatMemory(module.memory)}
              </Text>
            )}
          </Box>
        )}

        {/* Show Docker containers if selected and available */}
        {isSelected && module.containers && module.containers.length > 0 && (
          <Box marginLeft={4} marginTop={1} flexDirection="column">
            {module.containers.map((container) => (
              <Box key={container.name} marginBottom={0}>
                <Text dimColor>
                  {'├─ '}
                  <Text color={container.status === 'running' ? 'green' : 'gray'}>
                    {container.status === 'running' ? '●' : '○'}
                  </Text>{' '}
                  {container.name}
                  {container.ports.length > 0 && (
                    <Text color="cyan"> {container.ports.join(', ')}</Text>
                  )}
                </Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  },
  // Custom comparison function for better memoization
  // Return true if props are equal (should NOT re-render)
  (prevProps, nextProps) => {
    // Check if props are equal - if any is different, return false to re-render
    const areEqual =
      prevProps.module.name === nextProps.module.name &&
      prevProps.module.status === nextProps.module.status &&
      prevProps.module.pid === nextProps.module.pid &&
      prevProps.module.cpu === nextProps.module.cpu &&
      prevProps.module.memory === nextProps.module.memory &&
      prevProps.isSelected === nextProps.isSelected &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.isFavorite === nextProps.isFavorite &&
      prevProps.isChecked === nextProps.isChecked;

    // For objects, do deep comparison only if needed
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

ModuleRow.displayName = 'ModuleRow';
