import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ScreenProps } from '../../types.js';

export const EnvScreen: React.FC<ScreenProps> = React.memo(({ onBack, onQuit }) => {
  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="magenta" padding={1} marginBottom={1}>
        <Text bold color="magenta">
          🔧 ENVIRONMENT VARIABLES
        </Text>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        <Text color="yellow">Environment management features:</Text>
        <Text> • List all .env files</Text>
        <Text> • Check for missing variables</Text>
        <Text> • View port assignments</Text>
        <Text> • Compare with examples</Text>
        <Box marginTop={1} />

        <Text color="cyan">Use CLI commands:</Text>
        <Text dimColor> canto env --list List all env files</Text>
        <Text dimColor> canto env --ports Show port assignments</Text>
        <Text dimColor> canto env --check Check for issues</Text>
        <Box marginTop={1} />

        <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit</Text>
      </Box>
    </Box>
  );
});

EnvScreen.displayName = 'EnvScreen';
