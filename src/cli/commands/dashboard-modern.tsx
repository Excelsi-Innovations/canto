import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import Fuse, { type FuseResult } from 'fuse.js';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { DockerExecutor } from '../../modules/docker.js';
import { createBar, formatMemory, type SystemResources } from '../../utils/resources.js';
import { getPreferencesManager } from '../../utils/preferences-manager.js';
import { AsyncResourceMonitor } from '../lib/resource-monitor.js';
import { DashboardDataManager } from '../lib/dashboard-data-manager.js';
import { ResourceHistory } from '../lib/resource-history.js';
import { checkResourceAlerts, type ResourceAlert } from '../lib/resource-alerts.js';
import { AutoRestartManager } from '../lib/auto-restart-manager.js';
import type { ModuleStatus, Screen } from '../types.js';
import { ModuleCard } from '../components/dashboard/ModuleCard.js';
import { Sidebar } from '../components/dashboard/Sidebar.js';
import { ModernHeader } from '../components/dashboard/ModernHeader.js';
import { HelpScreen } from '../components/dashboard/HelpScreen.js';
import { EnvScreen } from '../components/dashboard/EnvScreen.js';
import { LogsScreen } from '../components/dashboard/LogsScreen.js';
import { HistoryScreen } from '../components/dashboard/HistoryScreen.js';
import { ModuleDetailsScreen } from '../components/dashboard/ModuleDetailsScreen.js';
import { Toast, type ToastData } from '../components/dashboard/Toast.js';
import { THEMES, type Theme } from '../../utils/preferences.js';

const Dashboard: React.FC = () => {
  useApp();
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedModule, setSelectedModule] = useState(0);
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemResources, setSystemResources] = useState<SystemResources>({
    totalMemory: 0,
    usedMemory: 0,
    freeMemory: 0,
    cpuCount: 1,
    cpuUsage: 0,
  });
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [confirmAction, setConfirmAction] = useState<{
    action: 'stop' | 'restart' | 'bulk-start' | 'bulk-stop' | 'bulk-restart';
    moduleName?: string;
    moduleNames?: string[];
  } | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [bulkOperationProgress, setBulkOperationProgress] = useState<{
    total: number;
    completed: number;
    operation: string;
  } | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  const [processManager] = useState(() => new ProcessManager());
  const [orchestrator] = useState(() => new ModuleOrchestrator(processManager));
  const [dockerExecutor] = useState(() => new DockerExecutor(processManager));

  const [resourceMonitor] = useState(() => new AsyncResourceMonitor());
  const [dataManager] = useState(
    () => new DashboardDataManager(orchestrator, processManager, dockerExecutor)
  );
  const [prefsManager] = useState(() => getPreferencesManager());
  const [resourceHistory] = useState(() => new ResourceHistory(30));
  const [autoRestartManager] = useState(() => new AutoRestartManager());

  const shownCriticalAlerts = useRef<Set<string>>(new Set());
  const shownAutoRestartAlerts = useRef<Set<string>>(new Set());

  const theme: Theme = useMemo(() => {
    const themeName = prefsManager.getTheme();
    return THEMES[themeName] ?? THEMES['default'] ?? ({} as Theme);
  }, [forceUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (lastKey) {
      const timer = setTimeout(() => {
        setLastKey(null);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastKey]);

  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.slice(1));
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toasts]);

  const showToast = useCallback((message: string, type: ToastData['type']) => {
    const newToast: ToastData = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  const triggerUpdate = useCallback(() => {
    setForceUpdate((prev) => prev + 1);
    dataManager.forceUpdate();
  }, [dataManager]);

  useEffect(() => {
    resourceMonitor.start();
    const unsubscribe = resourceMonitor.subscribe((resources) => {
      setSystemResources(resources);
      resourceHistory.addDataPoint(resources.cpuUsage, resources.usedMemory);
    });
    return () => {
      unsubscribe();
      resourceMonitor.stop();
    };
  }, [resourceMonitor, resourceHistory]);

  useEffect(() => {
    const initializeData = async () => {
      try {
        await dataManager.initialize();
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };

    initializeData();

    const unsubscribe = dataManager.subscribe((moduleStatuses) => {
      setModules(moduleStatuses);

      const newAlerts: ResourceAlert[] = [];
      moduleStatuses.forEach((module) => {
        const alerts = checkResourceAlerts(module);
        newAlerts.push(...alerts);
      });

      newAlerts.forEach((alert) => {
        if (alert.level === 'critical') {
          const alertKey = `${alert.moduleName}-${alert.type}`;
          if (!shownCriticalAlerts.current.has(alertKey)) {
            shownCriticalAlerts.current.add(alertKey);
            const icon = alert.type === 'cpu' ? 'CPU' : 'RAM';
            const value =
              alert.type === 'cpu' ? `${alert.value.toFixed(1)}%` : formatMemory(alert.value);
            showToast(`🔥 ${alert.moduleName} ${icon} at ${value}!`, 'error');
          }
        }
      });
    });

    return () => {
      unsubscribe();
      dataManager.cleanup();
    };
  }, [dataManager, showToast]);

  useEffect(() => {
    modules.forEach((module) => {
      const state = autoRestartManager.getState(module.name);

      if (module.status === 'ERROR' && (!state?.isRestarting)) {
        const restartKey = `${module.name}-restart`;

        if (!shownAutoRestartAlerts.current.has(restartKey)) {
          const shouldRestart = autoRestartManager.registerFailure(module.name);

          if (shouldRestart) {
            shownAutoRestartAlerts.current.add(restartKey);

            autoRestartManager.scheduleRestart(
              module.name,
              async () => {
                await orchestrator.start(module.name);
                prefsManager.addToHistory(`auto-restart ${module.name}`, module.name, true);
                showToast(`✓ Auto-restarted ${module.name}`, 'success');
                dataManager.markDirty(module.name);
                triggerUpdate();
                shownAutoRestartAlerts.current.delete(restartKey);
              },
              (delay) => {
                const seconds = Math.ceil(delay / 1000);
                showToast(`🔄 Auto-restarting ${module.name} in ${seconds}s...`, 'info');
              }
            );
          }
        }
      }

      if (module.status === 'RUNNING' && state) {
        autoRestartManager.resetState(module.name);
        shownAutoRestartAlerts.current.delete(`${module.name}-restart`);
      }
    });
  }, [modules, autoRestartManager, orchestrator, prefsManager, showToast, triggerUpdate, dataManager]);

  useEffect(() => {
    return () => {
      autoRestartManager.cleanup();
    };
  }, [autoRestartManager]);

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

  const executeModuleAction = useCallback(
    async (action: 'start' | 'stop' | 'restart', moduleName: string) => {
      if (isProcessing) return;

      try {
        setIsProcessing(true);
        if (action === 'start') {
          await orchestrator.start(moduleName);
          prefsManager.addToHistory(`start ${moduleName}`, moduleName, true);
          showToast(`✓ Started ${moduleName}`, 'success');
        } else if (action === 'stop') {
          await orchestrator.stop(moduleName);
          prefsManager.addToHistory(`stop ${moduleName}`, moduleName, true);
          showToast(`✓ Stopped ${moduleName}`, 'success');
        } else if (action === 'restart') {
          await orchestrator.restart(moduleName);
          prefsManager.addToHistory(`restart ${moduleName}`, moduleName, true);
          showToast(`✓ Restarted ${moduleName}`, 'success');
        }
        dataManager.markDirty(moduleName);
        triggerUpdate();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        showToast(`✗ Failed to ${action} ${moduleName}: ${errorMsg}`, 'error');
        prefsManager.addToHistory(`${action} ${moduleName}`, moduleName, false);
      } finally {
        setIsProcessing(false);
      }
    },
    [orchestrator, isProcessing, dataManager, prefsManager, showToast, triggerUpdate]
  );

  const executeBulkAction = useCallback(
    async (action: 'start' | 'stop' | 'restart', moduleNames: string[]) => {
      if (isProcessing || moduleNames.length === 0) return;

      try {
        setIsProcessing(true);
        setBulkOperationProgress({ total: moduleNames.length, completed: 0, operation: action });

        let completed = 0;
        const actionVerb =
          action === 'start' ? 'Starting' : action === 'stop' ? 'Stopping' : 'Restarting';

        for (const moduleName of moduleNames) {
          try {
            if (action === 'start') {
              await orchestrator.start(moduleName);
            } else if (action === 'stop') {
              await orchestrator.stop(moduleName);
            } else if (action === 'restart') {
              await orchestrator.restart(moduleName);
            }
            prefsManager.addToHistory(`${action} ${moduleName}`, moduleName, true);
            dataManager.markDirty(moduleName);
            completed++;
            setBulkOperationProgress({ total: moduleNames.length, completed, operation: action });
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            showToast(`✗ Failed to ${action} ${moduleName}: ${errorMsg}`, 'error');
            prefsManager.addToHistory(`${action} ${moduleName}`, moduleName, false);
          }
        }

        triggerUpdate();
        showToast(
          `✓ ${actionVerb} completed: ${completed}/${moduleNames.length} modules`,
          'success'
        );

        setSelectedModules(new Set());
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        showToast(`✗ Bulk operation failed: ${errorMsg}`, 'error');
      } finally {
        setIsProcessing(false);
        setBulkOperationProgress(null);
      }
    },
    [orchestrator, isProcessing, dataManager, prefsManager, showToast, triggerUpdate]
  );

  const handleModuleAction = useCallback(
    (action: 'start' | 'stop' | 'restart') => {
      const module = sortedModules[selectedModule];
      if (!module || isProcessing) return;

      if (action === 'stop' || action === 'restart') {
        setConfirmAction({ action, moduleName: module.name });
      } else {
        executeModuleAction(action, module.name);
      }
    },
    [sortedModules, selectedModule, isProcessing, executeModuleAction]
  );

  const handleBulkAction = useCallback(
    (action: 'start' | 'stop' | 'restart') => {
      if (selectedModules.size === 0 || isProcessing) return;
      const moduleNames = Array.from(selectedModules);
      const bulkAction = `bulk-${action}` as const;
      setConfirmAction({ action: bulkAction, moduleNames });
    },
    [selectedModules, isProcessing]
  );

  const toggleModuleSelection = useCallback(() => {
    const module = sortedModules[selectedModule];
    if (!module) return;
    setSelectedModules((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(module.name)) {
        newSet.delete(module.name);
      } else {
        newSet.add(module.name);
      }
      return newSet;
    });
  }, [sortedModules, selectedModule]);

  const selectAllFiltered = useCallback(() => {
    const allNames = sortedModules.map((m) => m.name);
    setSelectedModules(new Set(allNames));
    showToast(`Selected ${allNames.length} modules`, 'info');
  }, [sortedModules, showToast]);

  const clearSelection = useCallback(() => {
    setSelectedModules(new Set());
  }, []);

  const handleExit = useCallback(() => {
    process.exit(0);
  }, []);

  const handleInput = useCallback(
    (
      input: string,
      key: {
        upArrow?: boolean;
        downArrow?: boolean;
        escape?: boolean;
        backspace?: boolean;
        delete?: boolean;
        ctrl?: boolean;
        shift?: boolean;
        return?: boolean;
      }
    ) => {
      if (input === 'q' || input === 'Q') {
        handleExit();
        return;
      }

      if (key.escape) {
        if (confirmAction) {
          setConfirmAction(null);
        } else if (selectedModules.size > 0) {
          clearSelection();
          showToast('Selection cleared', 'info');
        } else if (searchMode) {
          setSearchMode(false);
          setSearchQuery('');
          setSelectedModule(0);
        } else if (screen === 'dashboard') {
          handleExit();
        } else {
          setScreen('dashboard');
        }
        return;
      }

      if (confirmAction) {
        if (input === 'y' || input === 'Y') {
          if (confirmAction.action.startsWith('bulk-')) {
            const bulkAction = confirmAction.action.replace('bulk-', '') as
              | 'start'
              | 'stop'
              | 'restart';
            executeBulkAction(bulkAction, confirmAction.moduleNames ?? []);
          } else {
            executeModuleAction(
              confirmAction.action as 'start' | 'stop' | 'restart',
              confirmAction.moduleName ?? ''
            );
          }
          setConfirmAction(null);
        } else if (input === 'n' || input === 'N') {
          setConfirmAction(null);
        }
        return;
      }

      if (screen === 'dashboard') {
        if (searchMode) {
          if (key.backspace || key.delete) {
            setSearchQuery(searchQuery.slice(0, -1));
          } else if (input?.length === 1 && /[a-zA-Z0-9-_]/.test(input)) {
            setSearchQuery(searchQuery + input);
          }
        } else {
          if (key.upArrow && selectedModule > 0) {
            setSelectedModule(selectedModule - 1);
          } else if (key.downArrow && selectedModule < sortedModules.length - 1) {
            setSelectedModule(selectedModule + 1);
          } else if (input === 'k' && selectedModule > 0) {
            setSelectedModule(selectedModule - 1);
          } else if (input === 'j' && selectedModule < sortedModules.length - 1) {
            setSelectedModule(selectedModule + 1);
          } else if (input === 'g') {
            if (lastKey === 'g') {
              setSelectedModule(0);
              setLastKey(null);
            } else {
              setLastKey('g');
            }
          } else if (input === 'G') {
            setSelectedModule(sortedModules.length - 1);
          } else if (input === '/') {
            setSearchMode(true);
            setSearchQuery('');
          } else if (input === ' ') {
            toggleModuleSelection();
          } else if (key.ctrl && input === 'a') {
            selectAllFiltered();
          } else if (key.shift && input === 'S') {
            handleBulkAction('start');
          } else if (key.shift && input === 'X') {
            handleBulkAction('stop');
          } else if (key.shift && input === 'R') {
            handleBulkAction('restart');
          } else if (input === '1' || input === 's') {
            handleModuleAction('start');
          } else if (input === '2' || input === 'x') {
            handleModuleAction('stop');
          } else if (input === '3' || input === 'r') {
            handleModuleAction('restart');
          } else if (input === 'f' || input === 'F') {
            const module = sortedModules[selectedModule];
            if (module) {
              if (prefsManager.isFavorite(module.name)) {
                prefsManager.removeFavorite(module.name);
                showToast(`☆ Removed ${module.name} from favorites`, 'info');
              } else {
                prefsManager.addFavorite(module.name);
                showToast(`★ Added ${module.name} to favorites`, 'success');
              }
              triggerUpdate();
            }
          } else if (input === 'm' || input === 'M') {
            setScreen('modules');
          } else if (input === 'e' || input === 'E') {
            setScreen('env');
          } else if (input === 'l' || input === 'L') {
            setScreen('logs');
          } else if (input === 'i' || input === 'I') {
            setScreen('history');
          } else if (input === 'h' || input === 'H' || input === '?') {
            setScreen('help');
          } else if (input === 't' || input === 'T') {
            const themeNames = Object.keys(THEMES);
            const currentIndex = themeNames.indexOf(prefsManager.getTheme());
            const nextIndex = (currentIndex + 1) % themeNames.length;
            const nextThemeName = themeNames[nextIndex] ?? 'default';
            prefsManager.setTheme(nextThemeName);
            const nextTheme = THEMES[nextThemeName] ?? THEMES['default'] ?? ({} as Theme);
            showToast(`Theme changed to ${nextTheme.name}`, 'info');
            triggerUpdate();
          } else if (key.return) {
            setScreen('details');
          }
        }
      } else {
        if (input === 'b' || input === 'B') {
          setScreen('dashboard');
        }
      }
    },
    [
      screen,
      searchMode,
      searchQuery,
      selectedModule,
      sortedModules,
      lastKey,
      confirmAction,
      handleModuleAction,
      handleBulkAction,
      toggleModuleSelection,
      selectAllFiltered,
      clearSelection,
      selectedModules,
      handleExit,
      showToast,
      prefsManager,
      executeModuleAction,
      executeBulkAction,
      triggerUpdate,
    ]
  );

  useInput(handleInput);

  const stats = useMemo(() => {
    const runningCount = modules.filter((m) => m.status === 'RUNNING').length;
    const stoppedCount = modules.filter((m) => m.status === 'STOPPED').length;
    return { runningCount, stoppedCount, total: modules.length };
  }, [modules]);

  if (loading && modules.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Box>
          <Text color="cyan">
            <Spinner type="dots" />
            {' Loading Canto...'}
          </Text>
        </Box>
      </Box>
    );
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
        selectedModule={selectedModule}
        onBack={() => setScreen('dashboard')}
        onQuit={handleExit}
      />
    );
  }

  if (screen === 'history') {
    return <HistoryScreen onBack={() => setScreen('dashboard')} onQuit={handleExit} />;
  }

  if (screen === 'details') {
    const module = sortedModules[selectedModule];
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

  // Modern Dashboard with Sidebar Layout
  return (
    <Box flexDirection="row" width="100%">
      {/* Sidebar */}
      <Sidebar
        stats={stats}
        selectedScreen={screen}
        onNavigate={(newScreen) => setScreen(newScreen)}
        theme={theme}
      />

      {/* Main Content Area */}
      <Box flexDirection="column" flexGrow={1} padding={1}>
        {/* Modern Header */}
        <ModernHeader
          systemResources={systemResources}
          resourceHistory={resourceHistory}
          isProcessing={isProcessing}
          theme={theme}
        />

        {/* Search Bar */}
        {searchMode && (
          <Box borderStyle="round" borderColor={theme.colors.primary} padding={1} marginBottom={1}>
            <Text>
              <Text color={theme.colors.primary}>🔍 Search: </Text>
              <Text bold>{searchQuery}</Text>
              <Text color={theme.colors.primary}>_</Text>
              <Text dimColor> (ESC to clear)</Text>
            </Text>
          </Box>
        )}

        {/* Modules Grid */}
        <Box
          borderStyle="round"
          borderColor={theme.colors.border}
          padding={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Box marginBottom={1}>
            <Text bold color={theme.colors.warning}>
              📦 {sortedModules.length} Module{sortedModules.length !== 1 ? 's' : ''}
              {selectedModules.size > 0 && (
                <Text color={theme.colors.info}> • {selectedModules.size} selected</Text>
              )}
            </Text>
          </Box>

          {sortedModules.length === 0 ? (
            <Text dimColor>No modules match "{searchQuery}"</Text>
          ) : (
            sortedModules.map((module, index) => (
              <ModuleCard
                key={module.name}
                module={module}
                isSelected={index === selectedModule}
                isFavorite={prefsManager.isFavorite(module.name)}
                isChecked={selectedModules.has(module.name)}
                autoRestartState={autoRestartManager.getState(module.name)}
                theme={theme}
              />
            ))
          )}
        </Box>

        {/* Quick Actions Bar */}
        <Box borderStyle="round" borderColor={theme.colors.border} padding={1} marginBottom={1}>
          {selectedModules.size > 0 ? (
            <Text>
              <Text bold color={theme.colors.info}>
                {selectedModules.size} selected
              </Text>
              <Text dimColor> • </Text>
              <Text color={theme.colors.success}>[Shift+S]</Text>
              <Text> Start All • </Text>
              <Text color={theme.colors.error}>[Shift+X]</Text>
              <Text> Stop All • </Text>
              <Text color={theme.colors.warning}>[Shift+R]</Text>
              <Text> Restart All</Text>
            </Text>
          ) : (
            <Text dimColor>
              ↑↓ navigate • Enter details • Space select • / search • h help • q quit
            </Text>
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

        {/* Confirmation Modal */}
        {confirmAction && (
          <Box borderStyle="double" borderColor="yellow" padding={2} marginTop={1}>
            <Box flexDirection="column">
              <Text bold color="yellow">
                ⚠ Confirm Action
              </Text>
              <Box marginTop={1}>
                {confirmAction.action.startsWith('bulk-') ? (
                  <Text>
                    Are you sure you want to{' '}
                    <Text bold color={confirmAction.action.includes('stop') ? 'red' : 'yellow'}>
                      {confirmAction.action.replace('bulk-', '')}
                    </Text>{' '}
                    <Text bold color="cyan">
                      {confirmAction.moduleNames?.length ?? 0} module
                      {(confirmAction.moduleNames?.length ?? 0) > 1 ? 's' : ''}
                    </Text>
                    ?
                  </Text>
                ) : (
                  <Text>
                    Are you sure you want to{' '}
                    <Text bold color={confirmAction.action === 'stop' ? 'red' : 'yellow'}>
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
                  <Text color="green">[Y]</Text> Confirm • <Text color="red">[N]</Text> Cancel
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
      </Box>
    </Box>
  );
};

export function startDashboard() {
  render(<Dashboard />);
}
