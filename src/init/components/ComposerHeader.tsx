import React from 'react';
import { Box, Text } from 'ink';
import { type Theme } from '../../utils/preferences.js';
import { VERSION } from '../../version.js';

interface ComposerHeaderProps {
  theme: Theme;
  step: string;
  totalSteps?: number;
  currentStep?: number;
}

export const ComposerHeader: React.FC<ComposerHeaderProps> = React.memo(
  ({ theme, step, currentStep, totalSteps }) => {
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
        {/* Title Row: Centered gradient blocks + CANTO COMPOSER + version */}
        <Box justifyContent="center" marginBottom={0}>
          <Text color={theme.colors.muted}>░▒▓█</Text>
          <Text bold color={theme.colors.primary}>
            {' CANTO COMPOSER '}
          </Text>
          <Text color={theme.colors.muted}>█▓▒░</Text>
          <Text> </Text>
          <Text dimColor color={theme.colors.muted}>
            v{VERSION}
          </Text>
        </Box>

        {/* Gradient separator */}
        <Box
          marginBottom={1}
          borderStyle="single"
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor={theme.colors.headerBorder}
          width="100%"
        />

        <Box justifyContent="space-between">
          <Text color={theme.colors.info} bold>
            {step}
          </Text>
          {currentStep && totalSteps && (
            <Text color={theme.colors.muted}>
              Step {currentStep}/{totalSteps}
            </Text>
          )}
        </Box>
      </Box>
    );
  }
);
