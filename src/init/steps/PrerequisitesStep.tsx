import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { type Theme } from '../../utils/preferences.js';
import type { ComposerState } from '../composer-state.js';

interface PrerequisitesStepProps {
  state: ComposerState;
  theme: Theme;
  onChangeNodeVersion: (version: string) => void;
  onToggleDocker: () => void;
  onToggleCompose: () => void;
  onNext: () => void;
  onBack: () => void;
}

export function PrerequisitesStep({
  state,
  theme,
  onChangeNodeVersion,
  onToggleDocker,
  onToggleCompose,
  onNext,
  onBack,
}: PrerequisitesStepProps): React.JSX.Element {
  const [activeField, setActiveField] = useState<'node' | 'docker' | 'compose'>('node');
  const [isEditing, setIsEditing] = useState(false);

  useInput((input, key) => {
    // If editing text, only listen for Enter/Escape to exit edit mode
    if (isEditing) {
      if (key.return || key.escape) {
        setIsEditing(false);
      }
      return;
    }

    // Navigation Mode
    if (key.downArrow) {
      if (activeField === 'node') setActiveField('docker');
      else if (activeField === 'docker') setActiveField('compose');
    }
    if (key.upArrow) {
      if (activeField === 'compose') setActiveField('docker');
      else if (activeField === 'docker') setActiveField('node');
    }

    // Toggle Checkboxes or Enter Edit Mode
    if (activeField === 'node') {
      if (key.return || input === ' ') {
        setIsEditing(true);
        return; // Consume input so we don't trigger next immediately
      }
    } else {
      // Checkboxes
      if (input === ' ') {
        if (activeField === 'docker') onToggleDocker();
        if (activeField === 'compose') onToggleCompose();
      }
      if (key.return) {
        onNext();
      }
    }

    // Back Navigation
    if (input === 'b' || input === 'B') {
      onBack();
    }
  });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text>Configure project prerequisites:</Text>
      </Box>

      {/* Node Version Input */}
      <Box flexDirection="row" marginBottom={1}>
        <Text color={activeField === 'node' ? theme.colors.primary : undefined}>
          {activeField === 'node' ? '> ' : '  '}
        </Text>
        <Text bold color={activeField === 'node' ? theme.colors.primary : undefined}>
          Node.js Version:{' '}
        </Text>
        <Box marginLeft={1}>
          {activeField === 'node' && isEditing ? (
            <TextInput
              value={state.nodeVersion}
              onChange={onChangeNodeVersion}
              placeholder=">=18.0.0"
              focus
            />
          ) : (
            <Text color={state.nodeVersion ? theme.colors.success : theme.colors.muted}>
              {state.nodeVersion || 'Not specified'}
              {activeField === 'node' && !isEditing && (
                <Text color={theme.colors.muted} dimColor>
                  {' '}
                  (Press Enter to edit)
                </Text>
              )}
            </Text>
          )}
        </Box>
      </Box>

      {/* Docker Checkbox */}
      <Box flexDirection="row" marginBottom={1}>
        <Text color={activeField === 'docker' ? theme.colors.primary : undefined}>
          {activeField === 'docker' ? '> ' : '  '}
        </Text>
        <Text>[{state.requireDocker ? <Text color={theme.colors.success}>x</Text> : ' '}]</Text>
        <Text color={activeField === 'docker' ? theme.colors.primary : undefined}>
          {' '}
          Require Docker Engine
        </Text>
      </Box>

      {/* Docker Compose Checkbox */}
      <Box flexDirection="row" marginBottom={1}>
        <Text color={activeField === 'compose' ? theme.colors.primary : undefined}>
          {activeField === 'compose' ? '> ' : '  '}
        </Text>
        <Text>
          [{state.requireDockerCompose ? <Text color={theme.colors.success}>x</Text> : ' '}]
        </Text>
        <Text color={activeField === 'compose' ? theme.colors.primary : undefined}>
          {' '}
          Require Docker Compose
        </Text>
      </Box>

      <Box marginTop={1}>
        {isEditing ? (
          <Text color={theme.colors.muted}>
            Press{' '}
            <Text bold color={theme.colors.primary}>
              Enter
            </Text>{' '}
            or{' '}
            <Text bold color={theme.colors.primary}>
              Esc
            </Text>{' '}
            to finish editing.
          </Text>
        ) : (
          <Text color={theme.colors.muted}>
            Use{' '}
            <Text bold color={theme.colors.primary}>
              ↑/↓
            </Text>{' '}
            to navigate,{' '}
            <Text bold color={theme.colors.primary}>
              Space/Enter
            </Text>{' '}
            to edit/toggle.{' '}
            <Text bold color={theme.colors.info}>
              B
            </Text>{' '}
            Back.
          </Text>
        )}
      </Box>
    </Box>
  );
}
