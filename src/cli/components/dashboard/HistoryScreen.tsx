import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getPreferencesManager } from '../../../utils/preferences-manager.js';
import type { ScreenProps } from '../../types.js';

export const HistoryScreen: React.FC<ScreenProps> = React.memo(({ onBack, onQuit }) => {
  const prefsManager = getPreferencesManager();
  const [history, setHistory] = useState(() => prefsManager.getHistory(20));

  // Remove useEffect - só atualiza quando o usuário pressiona R
  // O history já é inicializado no useState

  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    } else if (input === 'r' || input === 'R') {
      setHistory(prefsManager.getHistory(20));
    }
  });

  const formatTimestamp = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="blue" padding={1} marginBottom={1}>
        <Box flexDirection="column" flexGrow={1} flexShrink={1}>
          <Text bold color="blue">
            📜 COMMAND HISTORY
          </Text>
          <Box marginTop={1}>
            <Text dimColor>Last 20 commands • Press [R] to refresh</Text>
          </Box>
        </Box>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        {history.length === 0 ? (
          <Text dimColor>No command history yet</Text>
        ) : (
          history.map((entry, index) => (
            <Box key={index} marginBottom={0}>
              <Text>
                <Text color={entry.success ? 'green' : 'red'}>{entry.success ? '✓' : '✗'}</Text>{' '}
                <Text bold>{entry.command}</Text>
                {entry.module && <Text dimColor> ({entry.module})</Text>}
                <Text dimColor> • {formatTimestamp(entry.timestamp)}</Text>
              </Text>
            </Box>
          ))
        )}
      </Box>

      <Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
        <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit • Press 'r' to refresh</Text>
      </Box>
    </Box>
  );
});

HistoryScreen.displayName = 'HistoryScreen';
