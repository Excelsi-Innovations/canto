import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import Fuse, { type FuseResult } from 'fuse.js';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { DockerExecutor } from '../../modules/docker.js';
import { createBar, formatMemory, formatCPU, type SystemResources } from '../../utils/resources.js';
import { getPreferencesManager } from '../../utils/preferences-manager.js';
import { AsyncResourceMonitor } from '../lib/resource-monitor.js';
import { DashboardDataManager } from '../lib/dashboard-data-manager.js';
import { ResourceHistory } from '../lib/resource-history.js';
import { checkResourceAlerts, type ResourceAlert } from '../lib/resource-alerts.js';
import { AutoRestartManager } from '../lib/auto-restart-manager.js';
import type { ModuleStatus, Screen } from '../types.js';
import { ModuleRow } from '../components/dashboard/ModuleRow.js';
import { HelpScreen } from '../components/dashboard/HelpScreen.js';
import { EnvScreen } from '../components/dashboard/EnvScreen.js';
import { LogsScreen } from '../components/dashboard/LogsScreen.js';
import { HistoryScreen } from '../components/dashboard/HistoryScreen.js';
import { ModuleDetailsScreen } from '../components/dashboard/ModuleDetailsScreen.js';
import { Toast, type ToastData } from '../components/dashboard/Toast.js';
import { THEMES, type Theme } from '../../utils/preferences.js';

const Dashboard: React.FC = () => {
  useApp(); // Just to trigger app context
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
  const [forceUpdate, setForceUpdate] = useState(0); // Para forçar re-render quando necessário

  const [processManager] = useState(() => new ProcessManager());
  const [orchestrator] = useState(() => new ModuleOrchestrator(processManager));
  const [dockerExecutor] = useState(() => new DockerExecutor(processManager));

  // Initialize optimized data managers
  const [resourceMonitor] = useState(() => new AsyncResourceMonitor());
  const [dataManager] = useState(
    () => new DashboardDataManager(orchestrator, processManager, dockerExecutor)
  );
  const [prefsManager] = useState(() => getPreferencesManager());
  const [resourceHistory] = useState(() => new ResourceHistory(30));
  const [autoRestartManager] = useState(() => new AutoRestartManager());

  // Use refs to track shown alerts to prevent infinite loops
  const shownCriticalAlerts = useRef<Set<string>>(new Set());
  const shownAutoRestartAlerts = useRef<Set<string>>(new Set());

  // Get current theme - recalcula quando forceUpdate muda
  const theme: Theme = useMemo(() => {
    const themeName = prefsManager.getTheme();
    return THEMES[themeName] ?? THEMES['default'] ?? ({} as Theme);
  }, [forceUpdate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search query to reduce re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset lastKey after a timeout (for 'gg' vim keybinding)
  useEffect(() => {
    if (lastKey) {
      const timer = setTimeout(() => {
        setLastKey(null);
      }, 500); // 500ms window to press second 'g'

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [lastKey]);

  // Auto-dismiss toasts after 3 seconds
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.slice(1)); // Remove oldest toast
      }, 3000);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toasts]);

  // Helper function to show toast notifications
  const showToast = useCallback((message: string, type: ToastData['type']) => {
    const newToast: ToastData = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
    };
    setToasts((prev) => [...prev, newToast]);
  }, []);

  // Force update helper - triggers re-render and dataManager update
  const triggerUpdate = useCallback(() => {
    setForceUpdate((prev) => prev + 1);
    dataManager.forceUpdate();
  }, [dataManager]);

  // System resources monitoring (async, non-blocking)
  useEffect(() => {
    resourceMonitor.start();

    const unsubscribe = resourceMonitor.subscribe((resources) => {
      setSystemResources(resources);
      // Track resource history for sparklines
      resourceHistory.addDataPoint(resources.cpuUsage, resources.usedMemory);
    });

    return () => {
      unsubscribe();
      resourceMonitor.stop();
    };
  }, [resourceMonitor, resourceHistory]);

  // Module status monitoring (smart caching & file watching)
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

      // Check for resource alerts
      const newAlerts: ResourceAlert[] = [];
      moduleStatuses.forEach((module) => {
        const alerts = checkResourceAlerts(module);
        newAlerts.push(...alerts);
      });

      // Show toast for new critical alerts (only once per alert)
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

      // newAlerts não é mais armazenado em estado, apenas usado para verificar
    });

    return () => {
      unsubscribe();
      dataManager.cleanup();
    };
  }, [dataManager, showToast]);

  // Auto-restart monitoring for failed modules
  useEffect(() => {
    modules.forEach((module) => {
      const state = autoRestartManager.getState(module.name);

      // If module is in ERROR state and not already restarting
      if (module.status === 'ERROR' && (!state?.isRestarting)) {
        const restartKey = `${module.name}-restart`;

        // Only register failure once per error occurrence
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
                // Remove from shown alerts so it can show again if needed
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

      // If module is RUNNING, reset auto-restart state and clear shown alerts
      if (module.status === 'RUNNING' && state) {
        autoRestartManager.resetState(module.name);
        shownAutoRestartAlerts.current.delete(`${module.name}-restart`);
      }
    });
  }, [modules, autoRestartManager, orchestrator, prefsManager, showToast, triggerUpdate, dataManager]);

  // Cleanup auto-restart on unmount
  useEffect(() => {
    return () => {
      autoRestartManager.cleanup();
    };
  }, [autoRestartManager]);

  // Fuzzy search with Fuse.js (better than simple includes)
  const filteredModules = useMemo(() => {
    if (!debouncedSearchQuery) return modules;

    const fuse = new Fuse(modules, {
      keys: ['name', 'type'],
      threshold: 0.4, // 0 = exact match, 1 = match anything
      ignoreLocation: true,
    });

    const results = fuse.search(debouncedSearchQuery);
    return results.map((result: FuseResult<ModuleStatus>) => result.item);
  }, [modules, debouncedSearchQuery]);

  // Smart sorting: favorites first, then RUNNING status, then alphabetically
  const sortedModules = useMemo(() => {
    return [...filteredModules].sort((a, b) => {
      // 1. Sort by favorite status (favorites first)
      const aFav = prefsManager.isFavorite(a.name);
      const bFav = prefsManager.isFavorite(b.name);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;

      // 2. Sort by status (RUNNING > STARTING/STOPPING > STOPPED)
      const statusPriority: Record<string, number> = {
        RUNNING: 3,
        STARTING: 2,
        STOPPING: 2,
        STOPPED: 1,
      };
      const aPriority = statusPriority[a.status] ?? 0;
      const bPriority = statusPriority[b.status] ?? 0;
      if (aPriority !== bPriority) return bPriority - aPriority;

      // 3. Sort alphabetically by name
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
        // Mark module as dirty for immediate update
        dataManager.markDirty(moduleName);
        // Force update immediately (async, non-blocking)
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

        // Clear selection after bulk action
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

      // Destructive actions require confirmation
      if (action === 'stop' || action === 'restart') {
        setConfirmAction({ action, moduleName: module.name });
      } else {
        // Start action doesn't need confirmation
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

      // All bulk actions require confirmation
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
    // Force exit immediately
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
      // Global quit - works from any screen
      if (input === 'q' || input === 'Q') {
        handleExit();
        return;
      }

      if (key.escape) {
        if (confirmAction) {
          // Cancel confirmation
          setConfirmAction(null);
        } else if (selectedModules.size > 0) {
          // Clear selection
          clearSelection();
          showToast('Selection cleared', 'info');
        } else if (searchMode) {
          // Exit search mode
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

      // Handle confirmation modal
      if (confirmAction) {
        if (input === 'y' || input === 'Y') {
          // Confirm action
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
          // Cancel action
          setConfirmAction(null);
        }
        return;
      }

      if (screen === 'dashboard') {
        if (searchMode) {
          // In search mode - handle text input
          if (key.backspace || key.delete) {
            setSearchQuery(searchQuery.slice(0, -1));
          } else if (input?.length === 1 && /[a-zA-Z0-9-_]/.test(input)) {
            setSearchQuery(searchQuery + input);
          }
        } else {
          // Normal navigation mode
          if (key.upArrow && selectedModule > 0) {
            setSelectedModule(selectedModule - 1);
          } else if (key.downArrow && selectedModule < sortedModules.length - 1) {
            setSelectedModule(selectedModule + 1);
          } else if (input === 'k' && selectedModule > 0) {
            // Vim: k = up
            setSelectedModule(selectedModule - 1);
          } else if (input === 'j' && selectedModule < sortedModules.length - 1) {
            // Vim: j = down
            setSelectedModule(selectedModule + 1);
          } else if (input === 'g') {
            // Vim: gg = jump to top
            if (lastKey === 'g') {
              setSelectedModule(0);
              setLastKey(null);
            } else {
              setLastKey('g');
            }
          } else if (input === 'G') {
            // Vim: G = jump to bottom
            setSelectedModule(sortedModules.length - 1);
          } else if (input === '/') {
            setSearchMode(true);
            setSearchQuery('');
          } else if (input === ' ') {
            // Space = toggle selection
            toggleModuleSelection();
          } else if (key.ctrl && input === 'a') {
            // Ctrl+A = select all filtered
            selectAllFiltered();
          } else if (key.shift && input === 'S') {
            // Shift+S = bulk start
            handleBulkAction('start');
          } else if (key.shift && input === 'X') {
            // Shift+X = bulk stop
            handleBulkAction('stop');
          } else if (key.shift && input === 'R') {
            // Shift+R = bulk restart
            handleBulkAction('restart');
          } else if (input === '1' || input === 's') {
            handleModuleAction('start');
          } else if (input === '2' || input === 'x') {
            handleModuleAction('stop');
          } else if (input === '3' || input === 'r') {
            handleModuleAction('restart');
          } else if (input === 'f' || input === 'F') {
            // Toggle favorite for selected module
            const module = sortedModules[selectedModule];
            if (module) {
              if (prefsManager.isFavorite(module.name)) {
                prefsManager.removeFavorite(module.name);
                showToast(`☆ Removed ${module.name} from favorites`, 'info');
              } else {
                prefsManager.addFavorite(module.name);
                showToast(`★ Added ${module.name} to favorites`, 'success');
              }
              // Force re-render to update the star icon and sorting
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
            // Cycle through themes
            const themeNames = Object.keys(THEMES);
            const currentIndex = themeNames.indexOf(prefsManager.getTheme());
            const nextIndex = (currentIndex + 1) % themeNames.length;
            const nextThemeName = themeNames[nextIndex] ?? 'default';
            prefsManager.setTheme(nextThemeName);
            const nextTheme = THEMES[nextThemeName] ?? THEMES['default'] ?? ({} as Theme);
            showToast(`Theme changed to ${nextTheme.name}`, 'info');
            // Force re-render
            triggerUpdate();
          } else if (key.return) {
            // Enter = show module details
            setScreen('details');
          }
        }
      } else {
        // Any screen can go back with 'b'
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

  // Memoize computed values to prevent re-renders
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

  // Main Dashboard
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box
        borderStyle="double"
        borderColor={theme.colors.headerBorder}
        padding={1}
        marginBottom={1}
      >
        <Box flexDirection="column" width="100%">
          <Text bold color={theme.colors.primary}>
            🎵 CANTO DEVELOPMENT DASHBOARD
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              {stats.runningCount} Running • {stats.stoppedCount} Stopped • {stats.total} Total
              {isProcessing && <Text color={theme.colors.warning}> • Processing...</Text>}
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                <Text bold>CPU:</Text> {createBar(systemResources.cpuUsage, 100, 15)}{' '}
                {formatCPU(systemResources.cpuUsage)}
                <Text color={theme.colors.info}> {resourceHistory.getCpuSparkline(20)}</Text>
              </Text>
              <Text dimColor>
                <Text bold>RAM:</Text>{' '}
                {createBar(systemResources.usedMemory, systemResources.totalMemory, 15)}{' '}
                {formatMemory(systemResources.usedMemory)}/
                {formatMemory(systemResources.totalMemory)}
                <Text color={theme.colors.primary}> {resourceHistory.getMemorySparkline(20)}</Text>
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Module List */}
      <Box
        borderStyle="round"
        borderColor={theme.colors.border}
        padding={1}
        marginBottom={1}
        flexDirection="column"
      >
        <Box marginBottom={1} flexDirection="column">
          <Text bold color={theme.colors.warning}>
            📦 MODULES
          </Text>
          {searchMode && (
            <Box marginTop={1}>
              <Text>
                <Text color={theme.colors.info}>Search: </Text>
                <Text>{searchQuery}</Text>
                <Text color={theme.colors.info}>_</Text>
                <Text dimColor> (ESC to clear)</Text>
              </Text>
            </Box>
          )}
          {searchQuery && !searchMode && (
            <Box marginTop={1}>
              <Text dimColor>
                Filtered: {sortedModules.length}/{modules.length} modules
                <Text color="cyan"> (Press / to search again)</Text>
              </Text>
            </Box>
          )}
        </Box>

        {sortedModules.length === 0 ? (
          <Text dimColor>No modules match "{searchQuery}"</Text>
        ) : (
          sortedModules.map((module, index) => (
            <ModuleRow
              key={module.name}
              module={module}
              isSelected={index === selectedModule}
              searchQuery={searchQuery}
              isFavorite={prefsManager.isFavorite(module.name)}
              autoRestartState={autoRestartManager.getState(module.name)}
              isChecked={selectedModules.has(module.name)}
            />
          ))
        )}
      </Box>

      {/* Action Bar */}
      <Box borderStyle="round" borderColor={theme.colors.border} padding={1} marginBottom={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color={theme.colors.success}>
            ⚡ ACTIONS
          </Text>
          {selectedModules.size > 0 ? (
            <>
              <Box marginTop={1}>
                <Text color={theme.colors.info}>
                  {selectedModules.size} module{selectedModules.size > 1 ? 's' : ''} selected
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text>
                  <Text color={theme.colors.success}>[Shift+S]</Text> Start All{' '}
                  <Text color={theme.colors.error}>[Shift+X]</Text> Stop All{' '}
                  <Text color={theme.colors.warning}>[Shift+R]</Text> Restart All{' '}
                  <Text color="gray">[ESC]</Text> Clear
                </Text>
              </Box>
            </>
          ) : (
            <>
              <Box marginTop={1}>
                <Text>
                  <Text color={theme.colors.success}>[1/s]</Text> Start{' '}
                  <Text color={theme.colors.error}>[2/x]</Text> Stop{' '}
                  <Text color={theme.colors.warning}>[3/r]</Text> Restart{' '}
                  <Text color={theme.colors.warning}>[F]</Text> Favorite
                </Text>
              </Box>
              <Box marginTop={0}>
                <Text>
                  <Text color={theme.colors.info}>[Space]</Text> Select{' '}
                  <Text color={theme.colors.info}>[Ctrl+A]</Text> Select All{' '}
                  <Text color={theme.colors.warning}>[L]</Text> Logs{' '}
                  <Text color={theme.colors.info}>[I]</Text> History
                </Text>
              </Box>
            </>
          )}
        </Box>
      </Box>

      {/* Status Bar */}
      <Box borderStyle="single" borderColor={theme.colors.border} padding={1}>
        <Text dimColor>
          ↑↓ to navigate • Enter for details • '/' to search • Press 'h' for help • 'q' to quit
        </Text>
      </Box>

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {toasts.map((toast) => (
            <Box key={toast.id} marginBottom={1}>
              <Toast toast={toast} />
            </Box>
          ))}
        </Box>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <Box marginTop={1}>
          <Box borderStyle="double" borderColor="yellow" padding={1}>
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
                    module{' '}
                    <Text bold color="cyan">
                      {confirmAction.moduleName}
                    </Text>
                    ?
                  </Text>
                )}
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  Press <Text color="green">Y</Text> to confirm • Press <Text color="red">N</Text>{' '}
                  or <Text color="red">ESC</Text> to cancel
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Bulk Operation Progress */}
      {bulkOperationProgress && (
        <Box marginTop={1}>
          <Box borderStyle="double" borderColor="cyan" padding={1}>
            <Box flexDirection="column">
              <Text bold color="cyan">
                🔄 Bulk Operation in Progress
              </Text>
              <Box marginTop={1}>
                <Text>
                  {bulkOperationProgress.operation}ing modules:{' '}
                  <Text bold color="yellow">
                    {bulkOperationProgress.completed}/{bulkOperationProgress.total}
                  </Text>
                </Text>
              </Box>
              <Box marginTop={1}>
                <Text dimColor>
                  {createBar(bulkOperationProgress.completed, bulkOperationProgress.total, 30)}{' '}
                  {Math.round(
                    (bulkOperationProgress.completed / bulkOperationProgress.total) * 100
                  )}
                  %
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export async function dashboardCommand(): Promise<void> {
  render(<Dashboard />);
}
