import React from 'react';
import { Box, Text, useInput } from 'ink';
import { type Theme } from '../../utils/preferences.js';
import type { ProjectDetectionResult } from '../detector.js';

interface WelcomeStepProps {
  detection: ProjectDetectionResult;
  theme: Theme;
  onNext: () => void;
}

export function WelcomeStep({ detection, theme, onNext }: WelcomeStepProps): React.JSX.Element {
  useInput((_, key) => {
    if (key.return) {
      onNext();
    }
  });

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          ✨ WELCOME TO CANTO COMPOSER
        </Text>
      </Box>

      <Box>
        <Text>detected project structure:</Text>
      </Box>

      {/* Project Info Card */}
      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="round"
        borderColor={theme.colors.info}
        paddingX={2}
        paddingY={1}
      >
        <Box justifyContent="space-between">
          <Text>Type:</Text>
          <Text bold color={theme.colors.primary}>
            {detection.projectType.toUpperCase()}
          </Text>
        </Box>
        <Box justifyContent="space-between">
          <Text>Package Manager:</Text>
          <Text bold color={theme.colors.warning}>
            {detection.packageManager.toUpperCase()}
          </Text>
        </Box>
        <Box justifyContent="space-between">
          <Text>Node Version:</Text>
          <Text bold color={theme.colors.success}>
            {detection.nodeVersion ?? 'Not detected'}
          </Text>
        </Box>
        <Box justifyContent="space-between" marginTop={1}>
          <Text>Workspaces:</Text>
          <Text bold>{detection.workspaces.length}</Text>
        </Box>
        <Box justifyContent="space-between">
          <Text>Docker Compose:</Text>
          <Text bold>{detection.docker.composeFiles.length}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.muted}>
          Press{' '}
          <Text bold color={theme.colors.primary}>
            ENTER
          </Text>{' '}
          to configure modules.
        </Text>
      </Box>
    </Box>
  );
}
