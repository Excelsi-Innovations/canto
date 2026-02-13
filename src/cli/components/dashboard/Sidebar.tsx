import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import type { Screen } from '../../types.js';
import type { Theme } from '../../../utils/preferences.js';
import { getCurrentQuote } from '../../lib/branding.js';

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

export const Sidebar: React.FC<SidebarProps> = React.memo(
  ({ stats, selectedScreen, theme }) => {
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
        flexBasis={32}
        flexShrink={0}
        borderStyle="round"
        borderColor={theme.colors.border}
        paddingX={1}
        paddingY={0}
        height="100%"
        overflow="hidden"
      >
        {/* Compact Canto Logo - Centered */}
        <Box
          justifyContent="center"
          alignItems="center"
          marginBottom={1}
          flexGrow={0}
          flexShrink={0}
        >
          <Box marginTop={1} alignItems="center" justifyContent="center">
            <Text dimColor color={theme.colors.muted}>
              The Dev Maestro
            </Text>
          </Box>
        </Box>

        {/* Stats Section with Pills */}
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.colors.border}
          paddingX={1}
          paddingY={0}
          marginBottom={1}
        >
          <Box justifyContent="space-between" marginBottom={0}>
            <Text>Running</Text>
            <Text color={theme.colors.success} bold>
              {stats.runningCount}
            </Text>
          </Box>
          <Box justifyContent="space-between" marginBottom={0}>
            <Text>Stopped</Text>
            <Text color={theme.colors.muted} bold>
              {stats.stoppedCount}
            </Text>
          </Box>
          <Box
            marginTop={0}
            borderStyle="single"
            borderTop={false}
            borderLeft={false}
            borderRight={false}
            borderColor={theme.colors.border}
          />
          <Box justifyContent="space-between" marginTop={0}>
            <Text>Total</Text>
            <Text color={theme.colors.info} bold>
              {stats.total}
            </Text>
          </Box>
        </Box>

        {/* Navigation Menu */}
        <Box flexDirection="column" marginBottom={1} flexGrow={1}>
          <Box marginBottom={1}>
            <Text dimColor color={theme.colors.muted} underline>
              NAVIGATION
            </Text>
          </Box>

          <NavItem
            label="Dashboard"
            icon="🏠"
            hotkey="B"
            isActive={selectedScreen === 'dashboard'}
            theme={theme}
          />
          <NavItem
            label="Logs"
            icon="📄"
            hotkey="L"
            isActive={selectedScreen === 'logs'}
            theme={theme}
          />
          <NavItem
            label="History"
            icon="🕐"
            hotkey="I"
            isActive={selectedScreen === 'history'}
            theme={theme}
          />
          <NavItem
            label="Database"
            icon="🗄️"
            hotkey="M"
            isActive={selectedScreen === 'migrations'}
            theme={theme}
          />
          <NavItem
            label="Environment"
            icon="⚙️"
            hotkey="E"
            isActive={selectedScreen === 'env'}
            theme={theme}
          />
          <NavItem
            label="Commander"
            icon="👾"
            hotkey="C"
            isActive={selectedScreen === 'commander'}
            theme={theme}
          />
          <NavItem
            label="Help"
            icon="❓"
            hotkey="H"
            isActive={selectedScreen === 'help'}
            theme={theme}
          />
        </Box>

        {/* Footer - Hotkeys */}
        <Box
          marginTop={0}
          flexDirection="column"
          borderStyle="single"
          borderColor={theme.colors.border}
          padding={1}
        >
          <Text dimColor color={theme.colors.muted} underline>
            QUICK KEYS
          </Text>
          <Box marginTop={0} flexDirection="column">
            <Text color={theme.colors.muted}>
              <Text color={theme.colors.primary} bold>
                /
              </Text>{' '}
              Search
            </Text>
            <Text color={theme.colors.muted}>
              <Text color={theme.colors.primary} bold>
                Space
              </Text>{' '}
              Select
            </Text>
            <Text color={theme.colors.muted}>
              <Text color={theme.colors.primary} bold>
                Enter
              </Text>{' '}
              Details
            </Text>
            <Text color={theme.colors.muted}>
              <Text color={theme.colors.primary} bold>
                M
              </Text>{' '}
              Database
            </Text>
            <Text color={theme.colors.muted}>
              <Text color={theme.colors.error} bold>
                Q
              </Text>{' '}
              Quit
            </Text>
          </Box>
        </Box>

        {/* Rotating Pessoa Quote */}
        <Box marginTop={1} marginBottom={0} flexDirection="column" alignItems="center" height={3}>
          <Text italic dimColor color={theme.colors.primary} wrap="wrap">
            {quote}
          </Text>
        </Box>
      </Box>
    );
  },
  (prev, next) => {
    return (
      prev.selectedScreen === next.selectedScreen &&
      prev.theme === next.theme &&
      prev.stats.runningCount === next.stats.runningCount &&
      prev.stats.stoppedCount === next.stats.stoppedCount &&
      prev.stats.total === next.stats.total
    );
  }
);

const NavItem: React.FC<{
  label: string;
  icon: string;
  hotkey: string;
  isActive: boolean;
  theme: Theme;
}> = ({ label, icon, hotkey, isActive, theme }) => (
  <Box marginBottom={0}>
    <Text color={isActive ? theme.colors.primary : theme.colors.muted}>
      {isActive ? '▸ ' : '  '}
    </Text>
    <Box width={3}>
      <Text>{icon}</Text>
    </Box>
    <Text color={isActive ? theme.colors.primary : theme.colors.muted} bold={isActive}>
      {label}
    </Text>
    <Box flexGrow={1} />
    <Text color={theme.colors.muted} dimColor>
      [{hotkey}]
    </Text>
  </Box>
);
