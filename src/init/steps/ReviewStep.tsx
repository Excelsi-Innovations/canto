import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { type Theme } from '../../utils/preferences.js';

interface ReviewStepProps {
  yaml: string; // The generated YAML string to preview
  theme: Theme;
  onConfirm: () => void;
  onBack: () => void;
}

export function ReviewStep({ yaml, theme, onConfirm, onBack }: ReviewStepProps): React.JSX.Element {
  const [scrollOffset, setScrollOffset] = useState(0);
  const VIEWPORT_HEIGHT = 15;

  const lines = yaml.split('\n');

  useInput((input, key) => {
    if (key.upArrow) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    }
    if (key.downArrow) {
      setScrollOffset(Math.min(lines.length - VIEWPORT_HEIGHT, scrollOffset + 1));
    }
    if (key.pageUp) {
      setScrollOffset(Math.max(0, scrollOffset - VIEWPORT_HEIGHT));
    }
    if (key.pageDown) {
      setScrollOffset(Math.min(lines.length - VIEWPORT_HEIGHT, scrollOffset + VIEWPORT_HEIGHT));
    }

    if (key.return) {
      onConfirm();
    }

    if (input === 'b' || input === 'B') {
      onBack();
    }
  });

  const visibleLines = lines.slice(scrollOffset, scrollOffset + VIEWPORT_HEIGHT);

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>Review generated configuration:</Text>
      </Box>

      {/* YAML Preview Box */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={theme.colors.border}
        paddingX={1}
        height={VIEWPORT_HEIGHT + 2} // +2 for borders
      >
        {visibleLines.map((line, i) => (
          <Text key={scrollOffset + i} wrap="truncate">
            <Text color={theme.colors.muted} dimColor>
              {(scrollOffset + i + 1).toString().padEnd(3, ' ')}
            </Text>
            <Text color={undefined}>{line}</Text>
          </Text>
        ))}
      </Box>

      {/* Navigation Footer */}
      <Box marginTop={1} justifyContent="space-between">
        <Text color={theme.colors.muted}>
          Lines {scrollOffset + 1}-{Math.min(lines.length, scrollOffset + VIEWPORT_HEIGHT)} of{' '}
          {lines.length} • <Text bold>↑/↓</Text> scroll
        </Text>
        <Box>
          <Text color={theme.colors.muted}>
            <Text bold color={theme.colors.warning}>
              B
            </Text>{' '}
            Back •{' '}
            <Text bold color={theme.colors.success}>
              Enter
            </Text>{' '}
            Create Config
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
