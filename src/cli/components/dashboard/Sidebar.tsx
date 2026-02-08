import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { Screen } from '../../types.js';
import type { Theme } from '../../../utils/preferences.js';
import { SIDEBAR_LOGO, getCurrentQuote } from '../../lib/branding.js';

interface SidebarProps {
  stats: {
    runningCount: number;
    stoppedCount: number;
    total: number;
  };
  selectedScreen: Screen;
  onNavigate: (screen: Screen) => void;
  theme: Theme;
}

export const Sidebar: React.FC<SidebarProps> = ({ stats, selectedScreen, theme }) => {
  const [quote, setQuote] = useState(getCurrentQuote());

  useEffect(() => {
    const interval = setInterval(() => {
      setQuote(getCurrentQuote());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box
      flexDirection="column"
      width={28}
      borderStyle="round"
      borderColor={theme.colors.border}
      padding={1}
      marginRight={1}
      height="100%"
    >
      {/* Compact Canto Logo */}
      <Box marginBottom={0} flexDirection="column">
        {SIDEBAR_LOGO.map((line, i) => (
          <Text key={i} bold color={theme.colors.headerBorder}>
            {line}
          </Text>
        ))}
      </Box>
      <Box marginBottom={1}>
        <Text dimColor color={theme.colors.muted}>
          The Dev Maestro
        </Text>
      </Box>

      {/* Stats Section with Pills */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        padding={1}
        marginBottom={1}
      >
        <Box marginBottom={0}>
          <Text backgroundColor={theme.colors.success} color="black" bold>
            {' '}
            ● {stats.runningCount} Running{' '}
          </Text>
        </Box>
        <Box marginBottom={0} marginTop={0}>
          <Text backgroundColor={theme.colors.muted} color="black" bold>
            {' '}
            ○ {stats.stoppedCount} Stopped{' '}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor color={theme.colors.headerBorder}>
            ░▒▓█████████████▓▒░
          </Text>
        </Box>
        <Box>
          <Text color={theme.colors.info}>Total: {stats.total} modules</Text>
        </Box>
      </Box>

      {/* Navigation Menu */}
      <Box flexDirection="column" marginBottom={1}>
        <Box marginBottom={1}>
          <Text dimColor color={theme.colors.muted}>
            NAVIGATION
          </Text>
        </Box>

        <Box marginBottom={0}>
          <Text
            bold={selectedScreen === 'dashboard'}
            color={selectedScreen === 'dashboard' ? theme.colors.primary : theme.colors.muted}
          >
            {selectedScreen === 'dashboard' ? '▸ ' : '  '}🏠 Dashboard
          </Text>
        </Box>

        <Box marginBottom={0}>
          <Text
            bold={selectedScreen === 'logs'}
            color={selectedScreen === 'logs' ? theme.colors.primary : theme.colors.muted}
          >
            {selectedScreen === 'logs' ? '▸ ' : '  '}📄 Logs
          </Text>
        </Box>

        <Box marginBottom={0}>
          <Text
            bold={selectedScreen === 'history'}
            color={selectedScreen === 'history' ? theme.colors.primary : theme.colors.muted}
          >
            {selectedScreen === 'history' ? '▸ ' : '  '}🕐 History
          </Text>
        </Box>

        <Box marginBottom={0}>
          <Text
            bold={selectedScreen === 'env'}
            color={selectedScreen === 'env' ? theme.colors.primary : theme.colors.muted}
          >
            {selectedScreen === 'env' ? '▸ ' : '  '}⚙️ Environment
          </Text>
        </Box>

        <Box>
          <Text
            bold={selectedScreen === 'help'}
            color={selectedScreen === 'help' ? theme.colors.primary : theme.colors.muted}
          >
            {selectedScreen === 'help' ? '▸ ' : '  '}❓ Help
          </Text>
        </Box>
      </Box>

      {/* Footer - Hotkeys with visual buttons */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor color={theme.colors.headerBorder}>
          ░▒▓█████████████▓▒░
        </Text>
        <Box marginTop={1}>
          <Text dimColor color={theme.colors.muted}>
            HOTKEYS
          </Text>
        </Box>
        <Box marginTop={0}>
          <Text backgroundColor={theme.colors.border} color={theme.colors.primary}>
            {' [H] '}
          </Text>
          <Text color={theme.colors.muted}> Help</Text>
        </Box>
        <Box marginTop={0}>
          <Text backgroundColor={theme.colors.border} color={theme.colors.error}>
            {' [Q] '}
          </Text>
          <Text color={theme.colors.muted}> Quit</Text>
        </Box>
      </Box>

      {/* Rotating Pessoa Quote */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor color={theme.colors.headerBorder}>
          ░▒▓█████████████▓▒░
        </Text>
        <Box marginTop={1}>
          <Text italic dimColor color={theme.colors.primary} wrap="wrap">
            {quote}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
