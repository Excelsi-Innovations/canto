import React, { useState, useMemo, useEffect } from 'react';
import { render, Box, Text, useApp } from 'ink';
import Fuse, { type FuseResult } from 'fuse.js';
import type { ModuleStatus, Screen } from '../types.js';
import { ModuleRow } from '../components/dashboard/ModuleRow.js';
import { Sidebar } from '../components/dashboard/Sidebar.js';
import { ModernHeader } from '../components/dashboard/ModernHeader.js';
import { Toast } from '../components/dashboard/Toast.js';
import { ErrorBoundary } from '../components/common/ErrorBoundary.js';
import { ScreenRouter } from '../components/dashboard/ScreenRouter.js';
import { SplashScreen } from '../components/dashboard/SplashScreen.js';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { useDashboardInput } from '../hooks/useDashboardInput.js';
import { createBar } from '../../utils/resources.js';

import { ProcessManager } from '../../processes/manager.js';

const DashboardContent: React.FC = () => {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedModule, setSelectedModule] = useState(0);

  // Process Manager for background tasks (Commander)
  // Persists across screen navigation, using Singleton to share state with CLI exit handlers
  const processManager = useMemo(() => ProcessManager.getInstance(), []);

  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    action: 'stop' | 'restart' | 'bulk-start' | 'bulk-stop' | 'bulk-restart';
    moduleName?: string;
    moduleNames?: string[];
  } | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Data Hook
  const data = useDashboardData();
  const {
    modules,
    loading,
    error,
    isProcessing,
    systemResources,
    toasts,
    bulkOperationProgress,
    prefsManager,
    resourceHistory,
    autoRestartManager,
    gitBranch,
    cwdName,
    nodeVersion,
    theme,
    orchestrator,
  } = data;

  const filteredModules = useMemo(() => {
    if (!debouncedSearchQuery) return modules;
    const fuse = new Fuse(modules, {
      keys: ['name', 'type'],
      threshold: 0.4,
      ignoreLocation: true,
    });
    const results = fuse.search(debouncedSearchQuery);
    return results.map((result: FuseResult<ModuleStatus>) => result.item);
  }, [modules, debouncedSearchQuery]);

  const sortedModules = useMemo(() => {
    return [...filteredModules].sort((a, b) => {
      const aFav = prefsManager.isFavorite(a.name);
      const bFav = prefsManager.isFavorite(b.name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      const statusPriority: Record<string, number> = {
        RUNNING: 3,
        STARTING: 2,
        STOPPING: 2,
        STOPPED: 1,
      };
      const aPriority = statusPriority[a.status] ?? 0;
      const bPriority = statusPriority[b.status] ?? 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      return a.name.localeCompare(b.name);
    });
  }, [filteredModules, prefsManager]);

  const stats = useMemo(() => {
    const runningCount = modules.filter((m) => m.status === 'RUNNING').length;
    const stoppedCount = modules.filter((m) => m.status === 'STOPPED').length;
    return { runningCount, stoppedCount, total: modules.length };
  }, [modules]);

  // Input Hook
  useDashboardInput({
    screen,
    setScreen,
    searchMode,
    setSearchMode,
    searchQuery,
    setSearchQuery: (q) => {
      setSearchQuery(q);
    },
    selectedModule,
    setSelectedModule,
    sortedModules,
    confirmAction,
    setConfirmAction,
    selectedModules,
    setSelectedModules,
    lastKey,
    setLastKey,
    handleExit: () => exit(),
    data,
    showQuitConfirm,
    setShowQuitConfirm,
  });

  // Handle Debounce for Search Filtering
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  // Render sub-screens (help, env, logs, history, details)
  // ScreenRouter returns null for 'dashboard' and 'modules' screens,
  // which are rendered directly in this component below
  const subScreen = (
    <ScreenRouter
      screen={screen}
      loading={loading}
      error={error}
      theme={theme}
      modules={modules}
      selectedModuleIndex={selectedModule}
      sortedModules={sortedModules}
      orchestrator={orchestrator}
      processManager={processManager}
      setScreen={setScreen}
      handleExit={() => exit()}
    />
  );

  if (subScreen) {
    // ScreenRouter returns null if screen is 'dashboard', 'modules' or unknown
    if (screen !== 'dashboard' && screen !== 'modules') return subScreen;
  }

  // If loading/error caught by ScreenRouter, they returned early.
  // But ScreenRouter only returns if it matches a screen.
  // We need to handle loading/error for 'dashboard' screen too if ScreenRouter didn't catch it.

  // Main Dashboard Render
  if (loading) {
    return <SplashScreen theme={theme} />;
  }

  // Quit Confirmation Modal (replaces entire UI)
  if (showQuitConfirm) {
    return (
      <Box flexGrow={1} flexDirection="column" alignItems="center" justifyContent="center">
        <Box
          borderStyle="double"
          borderColor="red"
          paddingX={2}
          paddingY={1}
          flexDirection="column"
          alignItems="center"
        >
          <Text bold color="red">
            ⚠️ Quit Canto?
          </Text>
          <Text>Are you sure you want to exit?</Text>
          <Box marginTop={1}>
            <Text bold color={theme.colors.success}>
              [Y] Yes{' '}
            </Text>
            <Text bold color={theme.colors.error}>
              [N] No
            </Text>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" flexGrow={1} overflow="hidden">
      {/* Sidebar */}
      <Sidebar theme={theme} stats={stats} selectedScreen={screen} onNavigate={setScreen} />

      {/* Main Content Area */}
      <Box flexDirection="column" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
        {/* Show subScreen for non-dashboard/modules screens, otherwise show dashboard content */}
        {screen !== 'dashboard' && screen !== 'modules' ? (
          subScreen
        ) : (
          <>
            {/* Modern Header */}
            <ModernHeader
              systemResources={systemResources}
              resourceHistory={resourceHistory}
              isProcessing={isProcessing}
              theme={theme}
            />

            {/* Search Bar Info (Overlay?) */}
            {searchMode && (
              <Box
                borderStyle="round"
                borderColor={theme.colors.primary}
                padding={1}
                marginBottom={1}
              >
                <Text>
                  <Text color={theme.colors.primary}>🔍 Search: </Text>
                  <Text bold>{searchQuery}</Text>
                  <Text color={theme.colors.primary}>_</Text>
                  <Text dimColor> (ESC to clear)</Text>
                </Text>
              </Box>
            )}

            {/* Modules */}
            <Box
              borderStyle="round"
              borderColor={theme.colors.border}
              paddingX={1}
              paddingY={0}
              marginBottom={1}
              flexDirection="column"
              flexGrow={1}
              flexShrink={1}
              overflow="hidden"
              minWidth={0}
            >
              {loading ? (
                <Box flexGrow={1} justifyContent="center" alignItems="center">
                  <Text>Loading modules...</Text>
                </Box>
              ) : (
                <>
                  <Box marginBottom={1}>
                    <Text bold color={theme.colors.warning}>
                      📦 {sortedModules.length} Module{sortedModules.length !== 1 ? 's' : ''}
                      {selectedModules.size > 0 && (
                        <Text color={theme.colors.info}> • {selectedModules.size} selected</Text>
                      )}
                    </Text>
                  </Box>

                  {sortedModules.length === 0 ? (
                    <Box
                      flexGrow={1}
                      justifyContent="center"
                      alignItems="center"
                      flexDirection="column"
                    >
                      <Text dimColor>No modules match "{searchQuery}"</Text>
                      <Text dimColor>Check your dev.config.yaml or clear search.</Text>
                    </Box>
                  ) : (
                    <Box
                      flexDirection="column"
                      flexGrow={1}
                      flexShrink={1}
                      overflow="hidden"
                      minWidth={0}
                    >
                      {sortedModules.map((module, index) => (
                        <ModuleRow
                          key={module.name}
                          module={module}
                          isSelected={index === selectedModule}
                          searchQuery={searchQuery}
                          isFavorite={prefsManager.isFavorite(module.name)}
                          isChecked={selectedModules.has(module.name)}
                          autoRestartState={autoRestartManager.getState(module.name)}
                          theme={theme}
                        />
                      ))}
                    </Box>
                  )}
                </>
              )}
            </Box>

            {/* Unified Status Bar */}
            <Box
              borderStyle="round"
              borderColor={theme.colors.border}
              paddingX={1}
              marginBottom={1}
            >
              {selectedModules.size > 0 ? (
                <Box justifyContent="space-between" width="100%">
                  <Box>
                    <Text bold color={theme.colors.info}>
                      {selectedModules.size} selected
                    </Text>
                    <Text> </Text>
                    <Text backgroundColor={theme.colors.success} color="black" bold>
                      {' [S] Start '}
                    </Text>
                    <Text> </Text>
                    <Text backgroundColor={theme.colors.error} color="black" bold>
                      {' [X] Stop '}
                    </Text>
                    <Text> </Text>
                    <Text backgroundColor={theme.colors.warning} color="black" bold>
                      {' [R] Restart '}
                    </Text>
                    <Text> </Text>
                    <Text backgroundColor={theme.colors.muted} color="black">
                      {' [Esc] Clear '}
                    </Text>
                  </Box>
                </Box>
              ) : (
                <Box justifyContent="space-between" width="100%">
                  <Box>
                    <Text backgroundColor={theme.colors.border} color={theme.colors.primary}>
                      {' [↕] '}
                    </Text>
                    <Text color={theme.colors.muted}> Nav </Text>
                    <Text backgroundColor={theme.colors.border} color={theme.colors.success}>
                      {' [↵] '}
                    </Text>
                    <Text color={theme.colors.muted}> Open </Text>
                    <Text backgroundColor={theme.colors.border} color={theme.colors.warning}>
                      {' [/] '}
                    </Text>
                    <Text color={theme.colors.muted}> Search </Text>
                    <Text backgroundColor={theme.colors.border} color={theme.colors.info}>
                      {' [F] '}
                    </Text>
                    <Text color={theme.colors.muted}> Fav </Text>
                    <Text backgroundColor={theme.colors.border} color={theme.colors.primary}>
                      {' [T] '}
                    </Text>
                    <Text color={theme.colors.muted}> Theme</Text>
                  </Box>
                  <Box>
                    <Text dimColor color={theme.colors.muted}>
                      {nodeVersion}
                      {cwdName ? ` │ ${cwdName}` : ''}
                      {gitBranch ? ` │ ${gitBranch}` : ''}
                    </Text>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Toast Notifications */}
            {toasts.length > 0 && (
              <Box flexDirection="column">
                {toasts.map((toast) => (
                  <Box key={toast.id} marginBottom={0}>
                    <Toast toast={toast} />
                  </Box>
                ))}
              </Box>
            )}

            {/* Confirmation Modal - Bottom Position */}
            {confirmAction && (
              <Box
                position="absolute"
                width="100%"
                height="100%"
                flexDirection="column"
                justifyContent="flex-end"
                alignItems="center"
              >
                <Box
                  width="100%"
                  height={8}
                  borderStyle="double"
                  borderColor="yellow"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={theme.colors.background}
                >
                  <Text bold color="yellow">
                    ⚠️ Confirm Action
                  </Text>
                  <Box marginTop={0}>
                    {confirmAction.action.startsWith('bulk-') ? (
                      <Text>
                        Are you sure you want to{' '}
                        <Text bold color={confirmAction.action.includes('stop') ? 'red' : 'green'}>
                          {confirmAction.action.replace('bulk-', '')}
                        </Text>{' '}
                        <Text bold color="cyan">
                          ALL {confirmAction.moduleNames?.length ?? 0} selected modules
                        </Text>
                        ?
                      </Text>
                    ) : (
                      <Text>
                        Are you sure you want to{' '}
                        <Text bold color={confirmAction.action === 'stop' ? 'red' : 'green'}>
                          {confirmAction.action}
                        </Text>{' '}
                        <Text bold color="cyan">
                          {confirmAction.moduleName}
                        </Text>
                        ?
                      </Text>
                    )}
                  </Box>
                  <Box marginTop={1}>
                    <Text dimColor>
                      <Text color="green" bold>
                        [Y]
                      </Text>{' '}
                      Confirm •{' '}
                      <Text color="red" bold>
                        [N]
                      </Text>{' '}
                      Cancel
                    </Text>
                  </Box>
                </Box>
              </Box>
            )}

            {/* Bulk Progress */}
            {bulkOperationProgress && (
              <Box borderStyle="double" borderColor="cyan" padding={2} marginTop={1}>
                <Box flexDirection="column">
                  <Text bold color="cyan">
                    🔄 {bulkOperationProgress.operation}ing modules...
                  </Text>
                  <Box marginTop={1}>
                    <Text>
                      Progress: {bulkOperationProgress.completed}/{bulkOperationProgress.total}
                    </Text>
                  </Box>
                  <Box marginTop={1}>
                    <Text dimColor>
                      {createBar(bulkOperationProgress.completed, bulkOperationProgress.total, 30)}
                    </Text>
                  </Box>
                </Box>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};

// Top-level ErrorBoundary Wrapper
const Dashboard: React.FC = () => {
  return (
    <ErrorBoundary>
      <DashboardContent />
    </ErrorBoundary>
  );
};

export async function dashboardCommand(): Promise<void> {
  // Enter alternate screen buffer (like vim/htop)
  process.stdout.write('\x1b[?1049h');
  // Hide cursor
  process.stdout.write('\x1b[?25l');

  let cleanupCalled = false;
  const cleanup = async () => {
    if (cleanupCalled) return;
    cleanupCalled = true;

    // Gracefully stop all child processes
    try {
      await ProcessManager.getInstance().stopAll();
    } catch {
      // ignore
    }

    // Show cursor
    process.stdout.write('\x1b[?25h');
    // Leave alternate screen buffer
    process.stdout.write('\x1b[?1049l');
    // Clear any lingering input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
  };

  // Ensure cleanup on exit signals
  const exitHandler = async () => {
    await cleanup();
    process.exit(0);
  };

  process.on('SIGINT', exitHandler);
  process.on('SIGTERM', exitHandler);

  try {
    const instance = render(<Dashboard />);
    await instance.waitUntilExit();
  } catch {
    // Dashboard exited with error — cleanup handles it
  } finally {
    await cleanup();
    // Force exit after 500ms if cleanup is slow
    setTimeout(() => {
      process.exit(0);
    }, 500);
  }
}
