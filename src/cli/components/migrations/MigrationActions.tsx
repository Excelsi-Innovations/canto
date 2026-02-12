import React from 'react';
import { Box, Text } from 'ink';
import { type Theme } from '../../../utils/preferences.js';

interface MigrationActionsProps {
  canRollback: boolean;
  canReset: boolean;
  theme: Theme;
}

export function MigrationActions({
  canRollback,
  canReset,
  theme,
}: MigrationActionsProps): React.JSX.Element {
  return (
    <Box
      marginTop={1}
      flexDirection="row"
      borderStyle="round"
      borderColor={theme.colors.border}
      paddingX={1}
    >
      <Box marginRight={2}>
        <Text color={theme.colors.info} bold>
          A
        </Text>{' '}
        <Text>Apply Pending</Text>
      </Box>
      <Box marginRight={2}>
        <Text color={theme.colors.info} bold>
          R
        </Text>{' '}
        <Text>Refresh</Text>
      </Box>

      {canRollback && (
        <Box marginRight={2}>
          <Text color={theme.colors.warning} bold>
            U
          </Text>{' '}
          <Text>Undo Last</Text>
        </Box>
      )}

      {canReset && (
        <Box marginRight={2}>
          <Text color={theme.colors.error} bold>
            X
          </Text>{' '}
          <Text>Reset DB</Text>
        </Box>
      )}

      <Box>
        <Text color={theme.colors.muted}>↑/↓ Select • Enter Details</Text>
      </Box>
    </Box>
  );
}
