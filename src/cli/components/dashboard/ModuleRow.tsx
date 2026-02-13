import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import type { ModuleStatus } from '../../types.js';
// import { formatMemory, createBar } from '../../../utils/resources.js';
import { getAlertIcon, getAlertColor } from '../../lib/resource-alerts.js';
import type { ModuleRestartState } from '../../lib/auto-restart-manager.js';
import { getStatusConfig, getAutoRestartInfo, getModuleAlert } from './ModuleStatusUtils.js';
import type { Theme } from '../../../utils/preferences.js';

interface ModuleRowProps {
  module: ModuleStatus;
  isSelected: boolean;
  searchQuery?: string;
  isFavorite?: boolean;
  autoRestartState?: ModuleRestartState | null;
  isChecked?: boolean;
  // Added theme prop to match utils requirement, assuming we can update usage or make utils flexible.
  // If ModuleRow is used where theme is not available, we might need a default theme or make it optional.
  // For now, let's look at where it is used.
  theme: Theme;
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
    theme,
  }) => {
    // Enhanced status badges with colors using shared util
    const status = getStatusConfig(module.status, theme);

    const favoriteIcon = isFavorite ? '★' : '☆';
    const checkboxIcon = isChecked ? '☑' : '☐';
    const highlightedName = useHighlightedText(module.name, searchQuery ?? '');

    // Check for resource alerts using shared util
    const alert = getModuleAlert(module);

    // Format auto-restart info using shared util
    const autoRestartInfo = useMemo(() => getAutoRestartInfo(autoRestartState), [autoRestartState]);

    return (
      <Box marginBottom={1} flexDirection="column" overflow="hidden" minWidth={0}>
        <Box flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
          {/* Checkbox & Status & Name */}
          <Box
            flexGrow={1}
            flexShrink={1}
            minWidth={0}
            overflow="hidden"
            backgroundColor={isSelected ? 'blue' : undefined}
          >
            <Text color={isSelected ? 'white' : undefined} wrap="truncate-end">
              {isSelected ? '❯' : ' '}{' '}
              <Text color={isChecked ? 'cyan' : 'gray'}>{checkboxIcon}</Text>{' '}
              <Text color={isFavorite ? 'yellow' : 'gray'}>{favoriteIcon}</Text>{' '}
              <Text color={status.color}>{status.icon}</Text> {highlightedName}
            </Text>
          </Box>

          {/* Type - flexible width */}
          <Box flexBasis={12} flexShrink={0} marginLeft={1} overflow="hidden">
            <Text wrap="truncate-end" color="gray">
              {module.type}
            </Text>
          </Box>

          {/* Status Text - explicit state */}
          <Box flexBasis={12} flexShrink={0} marginLeft={1} overflow="hidden">
            <Text
              color={
                module.status === 'RUNNING'
                  ? 'green'
                  : module.status === 'STOPPED'
                    ? 'gray'
                    : 'yellow'
              }
            >
              {autoRestartInfo?.isRestarting ? 'RESTARTING' : module.status}
            </Text>
          </Box>

          {/* Badges/Alerts - flexible width */}
          <Box flexBasis={18} flexShrink={0} justifyContent="flex-end" overflow="hidden">
            {alert && <Text color={getAlertColor(alert.level)}> {getAlertIcon(alert.level)}</Text>}
            {autoRestartInfo && !autoRestartInfo.isRestarting && (
              <Text color="cyan"> 🔄{autoRestartInfo.secondsRemaining}s</Text>
            )}
            {autoRestartInfo?.isRestarting && <Text color="yellow"> ⟳</Text>}
          </Box>
        </Box>
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
      prevProps.isChecked === nextProps.isChecked &&
      // Check for theme equality if we add it to props
      prevProps.theme === nextProps.theme;

    // For objects, do deep comparison only if needed
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

ModuleRow.displayName = 'ModuleRow';
