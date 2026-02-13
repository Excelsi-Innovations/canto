import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { type Theme } from '../../../utils/preferences.js';
import { MigrationService } from '../../../lib/migrations/service.js';
import { type Migration } from '../../../lib/migrations/types.js';
import { type IMigrationDriver } from '../../../lib/migrations/driver.interface.js';
import { MigrationList } from './MigrationList.js';
import { MigrationActions } from './MigrationActions.js';
import Spinner from 'ink-spinner';

interface MigrationScreenProps {
  cwd: string; // Project root
  theme: Theme;
}

export function MigrationScreen({ cwd, theme }: MigrationScreenProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [driver, setDriver] = useState<IMigrationDriver | null>(null);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing...');

  const service = MigrationService.getInstance();

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setStatusMessage('Loading migration status...');
    setError(null);
    try {
      // Ensure driver is detected
      let activeDriver = service.getActiveDriver();
      activeDriver ??= await service.detect(cwd);
      setDriver(activeDriver);

      if (activeDriver) {
        const list = await service.getStatus(cwd);
        setMigrations(list);
        setSelectedIndex(Math.max(0, list.length - 1)); // Default to last item
      } else {
        setError('No migration driver detected for this project.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message || 'Failed to load migrations');
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  }, [cwd, service]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useInput(async (input, key) => {
    if (loading) return;

    if (key.upArrow) {
      setSelectedIndex(Math.max(0, selectedIndex - 1));
    }
    if (key.downArrow) {
      setSelectedIndex(Math.min(migrations.length - 1, selectedIndex + 1));
    }

    // Refresh
    if (input === 'r' || input === 'R') {
      loadStatus();
    }

    // Apply
    if (input === 'a' || input === 'A') {
      // Apply pending
      if (!driver) return;
      setLoading(true);
      setStatusMessage('Applying migrations...');
      try {
        await service.apply(cwd);
        await loadStatus(); // Refresh after apply
        setStatusMessage('Migrations applied successfully!');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLoading(false);
      }
    }

    // Reset (Dangerous!)
    if ((input === 'x' || input === 'X') && driver?.capabilities.canReset) {
      // In a real app, show confirmation modal first!
      // For V1 MVP, simple hold or confirm
      // Let's create a naive confirmation via state in future iteration
      setLoading(true);
      setStatusMessage('Resetting database...');
      try {
        await service.reset(cwd);
        await loadStatus();
        setStatusMessage('Database reset complete.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLoading(false);
      }
    }

    // Undo / Rollback
    if ((input === 'u' || input === 'U') && driver?.capabilities.canRollback) {
      setLoading(true);
      setStatusMessage('Rolling back last migration...');
      try {
        await service.rollback(cwd);
        await loadStatus();
        setStatusMessage('Rollback complete.');
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setLoading(false);
      }
    }
  });

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.info}>
          <Spinner type="dots" /> <Text>{statusMessage}</Text>
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.error} bold>
          Error: {error}
        </Text>
        <Text color={theme.colors.muted}>Press 'r' to retry.</Text>
      </Box>
    );
  }

  if (!driver) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color={theme.colors.warning}>No migration logic detected.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>Migrations ({driver.label})</Text>
        {statusMessage && <Text color={theme.colors.success}> - {statusMessage}</Text>}
      </Box>

      <MigrationList migrations={migrations} selectedIndex={selectedIndex} theme={theme} />

      <MigrationActions
        canRollback={driver.capabilities.canRollback}
        canReset={driver.capabilities.canReset}
        theme={theme}
      />
    </Box>
  );
}
