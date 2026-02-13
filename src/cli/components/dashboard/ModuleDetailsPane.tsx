import React from 'react';
import { Box, Text } from 'ink';
import type { ModuleStatus } from '../../types.js';
import { formatMemory, createBar } from '../../../utils/resources.js';
import type { Theme } from '../../../utils/preferences.js';

interface ModuleDetailsPaneProps {
  module: ModuleStatus | undefined;
  theme: Theme;
}

export const ModuleDetailsPane: React.FC<ModuleDetailsPaneProps> = React.memo(
  ({ module, theme }) => {
    if (!module) {
      return (
        <Box
          borderStyle="round"
          borderColor={theme.colors.border}
          paddingX={1}
          height={6} // Fixed height to prevent resizing flicker
          marginBottom={1}
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
        >
          <Text dimColor>Select a module to see details</Text>
        </Box>
      );
    }

    const hasMetrics = module.pid && module.cpu !== undefined;
    const hasContainers = module.containers && module.containers.length > 0;

    return (
      <Box
        borderStyle="round"
        borderColor={theme.colors.border}
        paddingX={1}
        minHeight={5} // Minimum height
        flexGrow={0}
        marginBottom={1}
        flexDirection="column"
      >
        <Box marginBottom={0}>
          <Text bold color={theme.colors.primary}>
            {module.name}
          </Text>
          <Text dimColor> ({module.type})</Text>
          {module.pid && <Text dimColor> • PID {module.pid}</Text>}
        </Box>

        {/* Metrics Row */}
        {hasMetrics && (
          <Box marginTop={0} flexDirection="row">
            <Box marginRight={2}>
              <Text>
                CPU: {createBar(module.cpu ?? 0, 100, 15)} {(module.cpu ?? 0).toFixed(1)}%
              </Text>
            </Box>
            <Box>
              <Text>
                RAM: {createBar(module.memory ?? 0, 1024 * 1024 * 1024, 15)}{' '}
                {formatMemory(module.memory ?? 0)}
              </Text>
            </Box>
          </Box>
        )}

        {/* Containers Row (Horizontal to save space?) or Vertical */}
        {hasContainers && (
          <Box marginTop={0} flexDirection="column">
            <Text dimColor underline>
              Containers:
            </Text>
            <Box flexDirection="row" flexWrap="wrap">
              {module.containers?.map((container) => (
                <Box key={container.name} marginRight={2}>
                  <Text>
                    <Text color={container.status === 'running' ? 'green' : 'gray'}>
                      {container.status === 'running' ? '●' : '○'}
                    </Text>{' '}
                    {container.name}
                  </Text>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {!hasMetrics && !hasContainers && (
          <Box marginTop={1}>
            <Text dimColor>No detailed metrics available.</Text>
          </Box>
        )}
      </Box>
    );
  },
  (prev, next) => {
    if (prev.theme !== next.theme) return false;
    if (prev.module === next.module) return true;
    if (!prev.module || !next.module) return prev.module === next.module;

    // Deep compare module details that matter for this pane
    return (
      prev.module.name === next.module.name &&
      prev.module.pid === next.module.pid &&
      prev.module.cpu === next.module.cpu &&
      prev.module.memory === next.module.memory &&
      // Compare containers length and status summaries
      JSON.stringify(prev.module.containers) === JSON.stringify(next.module.containers)
    );
  }
);
