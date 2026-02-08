import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { ScreenProps } from '../../types.js';

export const HelpScreen: React.FC<ScreenProps> = React.memo(({ onBack, onQuit }) => {
  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold color="cyan">
          📖 CANTO HELP
        </Text>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        <Text bold color="yellow">
          Navigation
        </Text>
        <Text> ↑↓ Navigate modules (or j/k)</Text>
        <Text> gg Jump to top (vim-style)</Text>
        <Text> G Jump to bottom (vim-style)</Text>
        <Text> / Search/filter modules</Text>
        <Text> Enter View module details</Text>
        <Text> ESC/B Go back / Clear search</Text>
        <Text> Q Quit Canto</Text>
        <Box marginTop={1} />

        <Text bold color="yellow">
          Module Actions
        </Text>
        <Text> 1 or s Start selected module</Text>
        <Text> 2 or x Stop selected module</Text>
        <Text> 3 or r Restart selected module</Text>
        <Text> F Toggle favorite (★)</Text>
        <Box marginTop={1} />

        <Text bold color="yellow">
          Multi-Select & Bulk Actions
        </Text>
        <Text> Space Toggle module selection (☑/☐)</Text>
        <Text> Ctrl+A Select all filtered modules</Text>
        <Text> Shift+S Bulk start selected modules</Text>
        <Text> Shift+X Bulk stop selected modules</Text>
        <Text> Shift+R Bulk restart selected modules</Text>
        <Text> ESC Clear selection</Text>
        <Box marginTop={1} />

        <Text bold color="yellow">
          Features
        </Text>
        <Text> Auto-restart Failed modules auto-restart (max 3 retries)</Text>
        <Text> Resource alerts Warnings for high CPU/RAM usage</Text>
        <Text> Fuzzy search Type to filter modules</Text>
        <Box marginTop={1} />

        <Text bold color="yellow">
          Screens
        </Text>
        <Text> L Logs viewer</Text>
        <Text> I Command history</Text>
        <Text> M Module management</Text>
        <Text> E Environment variables</Text>
        <Text> H or ? This help screen</Text>
        <Text> T Cycle themes</Text>
        <Box marginTop={1} />

        <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit</Text>
      </Box>
    </Box>
  );
});

HelpScreen.displayName = 'HelpScreen';
