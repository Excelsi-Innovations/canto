import React from 'react';
import { Text } from 'ink';
import { type Theme } from '../../../utils/preferences.js';
import { type MigrationStatus } from '../../../lib/migrations/types.js';

interface StatusBadgeProps {
  status: MigrationStatus;
  theme: Theme;
}

export function StatusBadge({ status, theme }: StatusBadgeProps): React.JSX.Element {
  switch (status) {
    case 'applied':
      return <Text color={theme.colors.success}>[APPLIED]</Text>;
    case 'pending':
      return (
        <Text color={theme.colors.warning} bold>
          [PENDING]
        </Text>
      );
    case 'failed':
      return (
        <Text color={theme.colors.error} bold>
          [FAILED]
        </Text>
      );
    case 'future':
      return <Text color={theme.colors.muted}>[FUTURE]</Text>;
    default:
      return <Text color={theme.colors.muted}>[UNKNOWN]</Text>;
  }
}
