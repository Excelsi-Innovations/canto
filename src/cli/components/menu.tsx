import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import SelectInput from 'ink-select-input';
import type { Config } from '../../config/schema.js';

interface InteractiveMenuProps {
  config: Config;
  onAction: (action: string, target?: string) => Promise<void>;
}

type MenuItem = {
  label: string;
  value: string;
};

/**
 * Interactive menu component for Canto
 * Main TUI interface when running `canto` without arguments
 */
export function InteractiveMenu({ config, onAction }: InteractiveMenuProps): React.JSX.Element {
  const { exit } = useApp();
  const [view, setView] = useState<'main' | 'modules' | 'logs'>('main');
  const [selectedAction, setSelectedAction] = useState<string>('');

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      exit();
    }
  });

  const mainMenuItems: MenuItem[] = [
    { label: '🚀 Start All Modules', value: 'start-all' },
    { label: '⏹  Stop All Modules', value: 'stop-all' },
    { label: '📊 Show Status', value: 'status' },
    { label: '🔍 Check Prerequisites', value: 'check' },
    { label: '📝 View Module Logs', value: 'logs' },
    { label: '🔄 Restart Module', value: 'restart' },
    { label: '❌ Exit', value: 'exit' },
  ];

  const moduleItems: MenuItem[] = config.modules.map((module) => ({
    label: `${module.name} (${module.type})`,
    value: module.name,
  }));

  const handleMainMenuSelect = async (item: MenuItem): Promise<void> => {
    switch (item.value) {
      case 'start-all':
        await onAction('start-all');
        break;
      case 'stop-all':
        await onAction('stop-all');
        break;
      case 'status':
        await onAction('status');
        break;
      case 'check':
        await onAction('check');
        break;
      case 'logs':
        setSelectedAction('logs');
        setView('modules');
        break;
      case 'restart':
        setSelectedAction('restart');
        setView('modules');
        break;
      case 'exit':
        exit();
        break;
    }
  };

  const handleModuleSelect = async (item: MenuItem): Promise<void> => {
    await onAction(selectedAction, item.value);
    setView('main');
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🎵 Canto Dev Launcher
        </Text>
      </Box>

      {view === 'main' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text dimColor>Select an action (use arrows, Enter to select, Esc/q to quit):</Text>
          </Box>
          <SelectInput items={mainMenuItems} onSelect={handleMainMenuSelect} />
        </Box>
      )}

      {view === 'modules' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text dimColor>
              Select a module for{' '}
              <Text color="cyan" bold>
                {selectedAction}
              </Text>
              :
            </Text>
          </Box>
          <SelectInput items={moduleItems} onSelect={handleModuleSelect} />
          <Box marginTop={1}>
            <Text dimColor>Press Esc to go back</Text>
          </Box>
        </Box>
      )}
    </Box>
  );
}
