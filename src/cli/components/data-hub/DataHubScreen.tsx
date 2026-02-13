import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { type Theme } from '../../../utils/preferences.js';
import { MigrationService } from '../../../lib/migrations/service.js';
import { type Migration } from '../../../lib/migrations/types.js';
import { type IMigrationDriver } from '../../../lib/migrations/driver.interface.js';
import { MigrationList } from '../migrations/MigrationList.js';
import { MigrationActions } from '../migrations/MigrationActions.js';
import Spinner from 'ink-spinner';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const execAsync = promisify(exec);

interface DataHubScreenProps {
  cwd: string; // Project root
  theme: Theme;
  onBack?: () => void;
}

type Tab = 'migrations' | 'seeds' | 'ops';

interface SeedScript {
  name: string;
  command: string;
}

export function DataHubScreen({ cwd, theme, onBack }: DataHubScreenProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<Tab>('migrations');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string>('Initializing...');
  const [error, setError] = useState<string | null>(null);

  // Migrations State
  const [driver, setDriver] = useState<IMigrationDriver | null>(null);
  const [migrations, setMigrations] = useState<Migration[]>([]);
  const [migrationIndex, setMigrationIndex] = useState(0);

  // Seeds State
  const [seeds, setSeeds] = useState<SeedScript[]>([]);
  const [seedIndex, setSeedIndex] = useState(0);

  // Ops State
  const [opsIndex, setOpsIndex] = useState(0);
  const OPS = [
    { label: 'Reset Database (Dangerous)', command: 'npm run db:migrate:reset', confirm: true },
    { label: 'Prisma Studio', command: 'npm run db:studio', confirm: false },
    { label: 'Generate Client', command: 'npm run db:generate', confirm: false },
    { label: 'Push Schema', command: 'npm run db:push', confirm: false },
  ];

  const service = MigrationService.getInstance();

  const loadMigrations = useCallback(async () => {
    setLoading(true);
    setStatusMessage('Loading migration status...');
    setError(null);
    try {
      let activeDriver = service.getActiveDriver();
      activeDriver ??= await service.detect(cwd);
      setDriver(activeDriver);

      if (activeDriver) {
        const list = await service.getStatus(cwd);
        setMigrations(list);
        setMigrationIndex(Math.max(0, list.length - 1));
      } else {
        // setError('No migration driver detected.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  }, [cwd, service]);

  const loadSeeds = useCallback(async () => {
    setLoading(true);
    setStatusMessage('Scanning for seeds...');
    try {
      // Look in package.json for seeds
      // We look in apps/backend/package.json if it exists, else root
      let targetPackageJson = join(cwd, 'package.json');
      const backendPackageJson = join(cwd, 'apps', 'backend', 'package.json');

      if (existsSync(backendPackageJson)) {
        targetPackageJson = backendPackageJson;
      }

      if (existsSync(targetPackageJson)) {
        const pkg = JSON.parse(readFileSync(targetPackageJson, 'utf-8'));
        const scripts = pkg.scripts ?? {};
        const seedScripts: SeedScript[] = [];

        for (const [key, value] of Object.entries(scripts)) {
          if (key.includes('seed')) {
            seedScripts.push({ name: key, command: value as string });
          }
        }
        setSeeds(seedScripts);
      }
    } catch (err) {
      setError(`Failed to load seeds: ${String(err)}`);
    } finally {
      setLoading(false);
      setStatusMessage('');
    }
  }, [cwd]);

  useEffect(() => {
    if (activeTab === 'migrations') loadMigrations();
    if (activeTab === 'seeds') loadSeeds();
    if (activeTab === 'ops') setLoading(false);
  }, [activeTab, loadMigrations, loadSeeds]);

  useInput(async (input, key) => {
    if (loading) return;

    // Tab Switching
    if (input === '1') setActiveTab('migrations');
    if (input === '2') setActiveTab('seeds');
    if (input === '3') setActiveTab('ops');
    if (input === 'b' || key.escape) {
      onBack?.();
    }

    // Refresh
    if (input === 'r' || input === 'R') {
      if (activeTab === 'migrations') loadMigrations();
      if (activeTab === 'seeds') loadSeeds();
    }

    // Tab Specific Logic
    if (activeTab === 'migrations') {
      if (key.upArrow) setMigrationIndex(Math.max(0, migrationIndex - 1));
      if (key.downArrow) setMigrationIndex(Math.min(migrations.length - 1, migrationIndex + 1));

      // Apply
      if (input === 'a' || input === 'A') {
        if (!driver) return;
        setLoading(true);
        setStatusMessage('Applying migrations...');
        try {
          await service.apply(cwd);
          await loadMigrations();
          setStatusMessage('Applied!');
        } catch (err) {
          setError(String(err));
          setLoading(false);
        }
      }
    }

    if (activeTab === 'seeds') {
      if (key.upArrow) setSeedIndex(Math.max(0, seedIndex - 1));
      if (key.downArrow) setSeedIndex(Math.min(seeds.length - 1, seedIndex + 1));

      // Run Seed
      if (key.return || input === 'r') {
        const seed = seeds[seedIndex];
        if (seed) {
          setLoading(true);
          setStatusMessage(`Running seed: ${seed.name}...`);
          try {
            // Determine cwd for execution (backend or root)
            const backendPath = join(cwd, 'apps', 'backend');
            const execCwd = existsSync(backendPath) ? backendPath : cwd;

            await execAsync(`npm run ${seed.name}`, { cwd: execCwd });
            setStatusMessage(`Seed ${seed.name} completed!`);
          } catch (err) {
            setError(`Seed failed: ${err}`);
          } finally {
            setLoading(false);
          }
        }
      }
    }

    if (activeTab === 'ops') {
      if (key.upArrow) setOpsIndex(Math.max(0, opsIndex - 1));
      if (key.downArrow) setOpsIndex(Math.min(OPS.length - 1, opsIndex + 1));

      // Run Op
      if (key.return) {
        const op = OPS[opsIndex];
        if (op) {
          setLoading(true);
          setStatusMessage(`Running: ${op.label}...`);
          try {
            const backendPath = join(cwd, 'apps', 'backend');
            const execCwd = existsSync(backendPath) ? backendPath : cwd;

            // For Studio, we might not want to await if it blocks?
            // But prisma studio usually blocks. We might need to spawn simple process or accept it blocks the thread?
            // ExecAsync blocks.
            // The user might want to cancel it?
            // For MVP, we run it. If it blocks, TUI freezes.
            // IMPORTANT: Prisma Studio opens browser and stays running.
            // We should probably spawn detached or generic process manager?

            if (op.command.includes('studio')) {
              // Spawn detached?
              // For now, let's just warn it might block or execute with timeout?
              // Actually, we should probably output "Started Studio" and return.
              const { spawn } = await import('child_process');
              const child = spawn('npm', ['run', 'db:studio'], {
                cwd: execCwd,
                detached: true,
                stdio: 'ignore',
              });
              child.unref();
              setStatusMessage('Prisma Studio launched in background!');
              setLoading(false);
              return;
            }

            await execAsync(op.command, { cwd: execCwd });
            setStatusMessage(`Operation ${op.label} completed!`);
          } catch (err) {
            setError(`Op failed: ${err}`);
          } finally {
            setLoading(false);
          }
        }
      }
    }
  });

  const renderTabs = () => (
    <Box borderStyle="double" borderColor={theme.colors.border} paddingX={1} marginBottom={1}>
      <Text>
        <Text
          color={activeTab === 'migrations' ? theme.colors.primary : theme.colors.muted}
          bold={activeTab === 'migrations'}
        >
          {' '}
          [1] Migrations{' '}
        </Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text
          color={activeTab === 'seeds' ? theme.colors.primary : theme.colors.muted}
          bold={activeTab === 'seeds'}
        >
          {' '}
          [2] Seeds{' '}
        </Text>
        <Text color={theme.colors.muted}>│</Text>
        <Text
          color={activeTab === 'ops' ? theme.colors.primary : theme.colors.muted}
          bold={activeTab === 'ops'}
        >
          {' '}
          [3] Operations{' '}
        </Text>
      </Text>
    </Box>
  );

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        {renderTabs()}
        <Text color={theme.colors.info}>
          <Spinner type="dots" /> <Text>{statusMessage}</Text>
        </Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      {renderTabs()}

      {error && (
        <Box borderStyle="single" borderColor="red" marginBottom={1}>
          <Text color="red">ERROR: {error}</Text>
        </Box>
      )}

      {statusMessage && (
        <Box marginBottom={1}>
          <Text color="green">✓ {statusMessage}</Text>
        </Box>
      )}

      {activeTab === 'migrations' && (
        <Box flexDirection="column">
          {driver ? (
            <>
              <Text bold>Migrations ({driver.label})</Text>
              <MigrationList migrations={migrations} selectedIndex={migrationIndex} theme={theme} />
              <MigrationActions
                canRollback={driver.capabilities.canRollback}
                canReset={driver.capabilities.canReset}
                theme={theme}
              />
            </>
          ) : (
            <Text color="yellow">No migration driver detected.</Text>
          )}
        </Box>
      )}

      {activeTab === 'seeds' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Available Seeds (Enter to Run)</Text>
          </Box>
          {seeds.map((seed, idx) => (
            <Text key={seed.name} color={idx === seedIndex ? theme.colors.primary : undefined}>
              {idx === seedIndex ? '> ' : '  '} {seed.name} <Text dimColor>({seed.command})</Text>
            </Text>
          ))}
          {seeds.length === 0 && <Text dimColor>No seed scripts found in package.json</Text>}
        </Box>
      )}

      {activeTab === 'ops' && (
        <Box flexDirection="column">
          <Box marginBottom={1}>
            <Text bold>Database Operations (Enter to Run)</Text>
          </Box>
          {OPS.map((op, idx) => (
            <Text key={op.label} color={idx === opsIndex ? theme.colors.primary : undefined}>
              {idx === opsIndex ? '> ' : '  '} {op.label} <Text dimColor>({op.command})</Text>
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1} borderStyle="single" borderColor={theme.colors.border}>
        <Text dimColor>
          Press 1-3 to switch tabs • 'b' to back • Arrows to navigate • Enter to select
        </Text>
      </Box>
    </Box>
  );
}
