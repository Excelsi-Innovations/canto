import React from 'react';
import { Box, Text } from 'ink';
import type { Screen, ModuleStatus } from '../../types.js';
import type { ModuleOrchestrator } from '../../../modules/index.js';
import { HelpScreen } from './HelpScreen.js';
import { EnvScreen } from './EnvScreen.js';
import { LogsScreen } from './LogsScreen.js';
import { HistoryScreen } from './HistoryScreen.js';
import { ModuleDetailsScreen } from './ModuleDetailsScreen.js';
import { SplashScreen } from './SplashScreen.js';
import type { Theme } from '../../../utils/preferences.js';

interface ScreenRouterProps {
  screen: Screen;
  loading: boolean;
  error: string | null;
  theme: Theme;
  modules: ModuleStatus[];
  selectedModuleIndex: number;
  sortedModules: ModuleStatus[];
  orchestrator: ModuleOrchestrator;
  setScreen: (screen: Screen) => void;
  handleExit: () => void;
}

export const ScreenRouter: React.FC<ScreenRouterProps> = ({
  screen,
  loading,
  error,
  theme,
  modules,
  selectedModuleIndex,
  sortedModules,
  orchestrator,
  setScreen,
  handleExit,
}) => {
  if (loading) {
    return <SplashScreen theme={theme} />;
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="round" borderColor="red" padding={1}>
          <Text color="red">✗ Error: {error}</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Press 'q' to exit</Text>
        </Box>
      </Box>
    );
  }

  if (screen === 'help') {
    return <HelpScreen onBack={() => setScreen('dashboard')} onQuit={handleExit} />;
  }

  if (screen === 'env') {
    return <EnvScreen onBack={() => setScreen('dashboard')} onQuit={handleExit} />;
  }

  if (screen === 'logs') {
    return (
      <LogsScreen
        modules={modules}
        selectedModule={selectedModuleIndex}
        onBack={() => setScreen('dashboard')}
        onQuit={handleExit}
      />
    );
  }

  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('dashboard')} onQuit={handleExit} />;
  }

  if (screen === 'details') {
    const module = sortedModules[selectedModuleIndex];
    // Orchestrator might act differently if invoked directly vs via hook, 
    // but here we just need to get module config. 
    // Ensure orchestrator is passed correctly from useDashboardData
    const moduleConfig = module ? orchestrator.getModule(module.name) : null;

    if (!module) {
      return (
        <Box flexDirection="column" padding={1}>
          <Box borderStyle="round" borderColor="red" padding={1}>
            <Text color="red">No module selected</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press 'b' to go back</Text>
          </Box>
        </Box>
      );
    }

    return (
      <ModuleDetailsScreen
        module={module}
        moduleConfig={moduleConfig ?? null}
        onBack={() => setScreen('dashboard')}
        onQuit={handleExit}
      />
    );
  }

  // For 'dashboard' and 'modules' screens, return null
  // These are rendered directly in dashboard.tsx
  if (screen === 'dashboard' || screen === 'modules') {
    return null;
  }

  // Unknown screen - show error
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="red" padding={1}>
        <Text color="red">Unknown screen: {screen}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press 'b' to go back</Text>
      </Box>
    </Box>
  );
};
