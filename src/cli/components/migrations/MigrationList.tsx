import React from 'react';
import { Box, Text } from 'ink';
import { type Theme } from '../../../utils/preferences.js';
import { type Migration } from '../../../lib/migrations/types.js';
import { StatusBadge } from './StatusBadge.js';

interface MigrationListProps {
  migrations: Migration[];
  selectedIndex: number;
  theme: Theme;
}

export function MigrationList({
  migrations,
  selectedIndex,
  theme,
}: MigrationListProps): React.JSX.Element {
  // Simple viewport logic
  const VIEWPORT_HEIGHT = 10;
  // Determine slice based on selectedIndex to keep it in view
  let start = 0;
  if (selectedIndex >= VIEWPORT_HEIGHT) {
    start = selectedIndex - VIEWPORT_HEIGHT + 1;
  }
  const end = Math.min(start + VIEWPORT_HEIGHT, migrations.length);
  const visibleItems = migrations.slice(start, end);

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={theme.colors.border}
      paddingX={1}
      minHeight={VIEWPORT_HEIGHT + 2}
    >
      {visibleItems.length === 0 ? (
        <Text color={theme.colors.muted}>No migrations found.</Text>
      ) : (
        visibleItems.map((migration, index) => {
          const absoluteIndex = start + index;
          const isSelected = absoluteIndex === selectedIndex;

          return (
            <Box key={migration.id}>
              <Text color={isSelected ? theme.colors.primary : undefined}>
                {isSelected ? '> ' : '  '}
              </Text>

              <Box width={12}>
                <StatusBadge status={migration.status} theme={theme} />
              </Box>

              <Box marginLeft={1}>
                <Text color={isSelected ? theme.colors.primary : undefined} wrap="truncate">
                  {migration.id}
                </Text>
              </Box>
            </Box>
          );
        })
      )}
    </Box>
  );
}
