import React from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';
import { createBar, formatCPU, type SystemResources } from '../../../utils/resources/index.js';
import type { ResourceHistory } from '../../lib/resource-history.js';
import type { Theme } from '../../../utils/preferences.js';
import { VERSION } from '../../../version.js';

interface ModernHeaderProps {
  systemResources: SystemResources;
  resourceHistory: ResourceHistory;
  isProcessing: boolean;
  theme: Theme;
}

/**
 * Compact memory format: "22.0/31.8G" instead of "22.01 GB/31.84 GB"
 */
function compactMemory(mb: number): string {
  if (mb < 1024) {
    return `${Math.round(mb)}M`;
  }
  return `${(mb / 1024).toFixed(1)}G`;
}

export const ModernHeader: React.FC<ModernHeaderProps> = React.memo(
  ({ systemResources, resourceHistory, isProcessing, theme }) => {
    const cpuBar = createBar(systemResources.cpuUsage, 100, 20);
    const cpuBraille = resourceHistory.getCpuBrailleSparkline(12);

    const memoryPercentage = (systemResources.usedMemory / systemResources.totalMemory) * 100;
    const memoryBar = createBar(memoryPercentage, 100, 20);
    const memoryBraille = resourceHistory.getMemoryBrailleSparkline(12);

    const memLabel = `${compactMemory(systemResources.usedMemory)}/${compactMemory(systemResources.totalMemory)}`;
    const memPercent = isNaN(memoryPercentage) ? '0.0%' : `${memoryPercentage.toFixed(1)}%`;

    return (
      <Box
        borderStyle="double"
        borderColor={theme.colors.headerBorder}
        paddingX={1}
        paddingY={1}
        marginBottom={1}
        flexDirection="column"
        overflow="hidden"
        minWidth={0}
      >
        {/* Title Row: Centered gradient blocks + CANTO + version */}
        <Box justifyContent="center" marginBottom={0}>
          <Text color={theme.colors.muted}>░▒▓█</Text>
          <Text bold color={theme.colors.primary}>
            {' CANTO '}
          </Text>
          <Text color={theme.colors.muted}>█▓▒░</Text>
          <Text> </Text>
          <Text dimColor color={theme.colors.muted}>
            v{VERSION}
          </Text>
          {isProcessing && (
            <>
              <Text> </Text>
              <Text color={theme.colors.info}>
                <Spinner type="dots" />
              </Text>
            </>
          )}
        </Box>

        {/* Gradient separator - using border instead of hardcoded text for responsiveness */}
        <Box
          marginBottom={1}
          borderStyle="single"
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor={theme.colors.headerBorder}
          width="100%"
        />

        {/* System Stats Row 1: CPU */}
        <Box marginBottom={0} flexDirection="row" alignItems="center">
          <Box width={6} flexShrink={0}>
            <Text bold color={theme.colors.warning}>
              CPU
            </Text>
          </Box>
          <Text color={theme.colors.muted}>│ </Text>
          <Box width={22} flexShrink={0}>
            <Text color={theme.colors.info}>{cpuBar}</Text>
          </Box>
          <Text> </Text>
          <Box width={8} flexShrink={0}>
            <Text color={theme.colors.primary}>{formatCPU(systemResources.cpuUsage)}</Text>
          </Box>
          <Text color={theme.colors.muted}> │ </Text>
          <Box flexGrow={1} minWidth={0} overflow="hidden">
            <Text color={theme.colors.muted} wrap="truncate-end">
              {cpuBraille}
            </Text>
          </Box>
        </Box>

        {/* System Stats Row 2: RAM */}
        <Box flexDirection="row" alignItems="center">
          <Box width={6} flexShrink={0}>
            <Text bold color={theme.colors.warning}>
              RAM
            </Text>
          </Box>
          <Text color={theme.colors.muted}>│ </Text>
          <Box width={22} flexShrink={0}>
            <Text color={theme.colors.success}>{memoryBar}</Text>
          </Box>
          <Text> </Text>
          <Box width={8} flexShrink={0}>
            <Text color={theme.colors.primary}>{memPercent}</Text>
          </Box>
          <Text color={theme.colors.muted}> │ </Text>
          <Box flexGrow={1} flexDirection="row" overflow="hidden" minWidth={0} alignItems="center">
            <Box flexGrow={1} minWidth={0} overflow="hidden">
              <Text color={theme.colors.muted} wrap="truncate-end">
                {memoryBraille}
              </Text>
            </Box>
            <Box flexShrink={0} marginLeft={1}>
              <Text dimColor color={theme.colors.muted}>
                {memLabel}
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  }
);
