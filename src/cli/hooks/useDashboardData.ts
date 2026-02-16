import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// import { execSync } from 'child_process';
import path from 'path';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { DockerExecutor } from '../../modules/docker.js';
import { AsyncResourceMonitor } from '../lib/resource-monitor.js';
import { DashboardDataManager } from '../lib/dashboard-data-manager.js';
import { ResourceHistory } from '../lib/resource-history.js';
import { checkResourceAlerts, type ResourceAlert } from '../lib/resource-alerts.js';
import { AutoRestartManager } from '../lib/auto-restart-manager.js';
import { getPreferencesManager } from '../../utils/preferences-manager.js';
import { getPoeticMessage } from '../lib/branding.js';
import { formatMemory, type SystemResources } from '../../utils/resources/index.js';
import type { ModuleStatus } from '../types.js';
import type { ToastData } from '../components/dashboard/Toast.js';
import { THEMES, type Theme } from '../../utils/preferences.js';

export function useDashboardData() {
  // State
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
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const [bulkOperationProgress, setBulkOperationProgress] = useState<{
    total: number;
    completed: number;
    operation: string;
  } | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  // Managers
  const [processManager] = useState(() => ProcessManager.getInstance());
  const [orchestrator] = useState(() => new ModuleOrchestrator(processManager));
  const [dockerExecutor] = useState(() => new DockerExecutor(processManager));
  const [resourceMonitor] = useState(() => new AsyncResourceMonitor());
  const [dataManager] = useState(
    () => new DashboardDataManager(orchestrator, processManager, dockerExecutor)
  );
  const [prefsManager] = useState(() => getPreferencesManager());
  const [resourceHistory] = useState(() => new ResourceHistory(30));
  const [autoRestartManager] = useState(() => new AutoRestartManager());

  // Refs for alerts
  const shownCriticalAlerts = useRef<Set<string>>(new Set());
  const shownAutoRestartAlerts = useRef<Set<string>>(new Set());

  // Static Info
  // Static Info
  const [gitBranch, setGitBranch] = useState<string>('');

  useEffect(() => {
    import('child_process').then(({ exec }) => {
      exec('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }, (err, stdout) => {
        if (!err && stdout) {
          setGitBranch(stdout.trim());
        }
      });
    });
  }, []);

  const cwdName = useMemo(() => path.basename(process.cwd()), []);
  const nodeVersion = process.version;

  // Theme
  const theme: Theme = useMemo(() => {
    const themeName = prefsManager.getTheme();
    return THEMES[themeName] ?? THEMES['default'] ?? ({} as Theme);
  }, [forceUpdate, prefsManager]);

  // Toast Logic
  useEffect(() => {
    if (toasts.length > 0) {
      const timer = setTimeout(() => {
        setToasts((prev) => prev.slice(1));
      }, 1500);
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
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.message !== message);
      const trimmed = filtered.slice(-2);
      return [...trimmed, newToast];
    });
  }, []);

  const triggerUpdate = useCallback(() => {
    setForceUpdate((prev) => prev + 1);
    dataManager.forceUpdate();
  }, [dataManager]);

  // Initialization & Data Subscription
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Ensure splash screen shows for at least 1.5s to prevent flickering
        // and allow user to see the branding/loading state.
        await Promise.all([
          dataManager.initialize(),
          new Promise((resolve) => setTimeout(resolve, 1500)),
        ]);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    };

    initializeData();

    const unsubscribe = dataManager.subscribe((moduleStatuses) => {
      // Merge in latest resource metrics before updating state
      const resources = resourceMonitor.getLatestResources();
      const mergedModules = moduleStatuses.map((m) => {
        if (!m.pid) return m;
        const res = resources.processes.get(m.pid);
        return res ? { ...m, cpu: res.cpu, memory: res.memory } : m;
      });

      setModules(mergedModules);

      const newAlerts: ResourceAlert[] = [];
      mergedModules.forEach((module) => {
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

  // Component Mount (Clear Terminal)
  useEffect(() => {
    process.stdout.write('\x1Bc');
  }, []);

  // Resource Monitor
  useEffect(() => {
    // Provide PIDs to monitor from current data manager state
    resourceMonitor.setPIDProvider(() => {
      return dataManager
        .getModuleStatuses()
        .map((m) => m.pid)
        .filter((pid): pid is number => !!pid);
    });

    resourceMonitor.start();
    const unsubscribe = resourceMonitor.subscribe((resources) => {
      setSystemResources(resources.system);
      resourceHistory.addDataPoint(resources.system.cpuUsage, resources.system.usedMemory);

      // Also trigger a module refresh to merge in these new metrics
      const currentModules = dataManager.getModuleStatuses();
      const mergedModules = currentModules.map((m) => {
        if (!m.pid) return m;
        const res = resources.processes.get(m.pid);
        return res ? { ...m, cpu: res.cpu, memory: res.memory } : m;
      });
      setModules(mergedModules);
    });
    return () => {
      unsubscribe();
      resourceMonitor.stop();
    };
  }, [resourceMonitor, resourceHistory, dataManager]);

  // Auto Restart Logic
  useEffect(() => {
    modules.forEach((module) => {
      const state = autoRestartManager.getState(module.name);

      if (module.status === 'ERROR' && !state?.isRestarting) {
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
                const moduleType = module.type || 'default';
                const poeticMsg = getPoeticMessage('autoRestart', moduleType);
                const seconds = Math.ceil(delay / 1000);
                showToast(`${poeticMsg} (${seconds}s)`, 'info');
              }
            );
          }
        }
      }

      // Only reset auto-restart state if module has been RUNNING long enough
      // to be considered stable (prevents infinite loop when process briefly
      // enters RUNNING before crashing)
      if (module.status === 'RUNNING' && state) {
        const STABILITY_WINDOW_MS = 15_000; // 15 seconds
        const { startedAt } = module;
        const uptime = startedAt ? Date.now() - new Date(startedAt).getTime() : 0;

        if (uptime >= STABILITY_WINDOW_MS) {
          autoRestartManager.resetState(module.name);
          shownAutoRestartAlerts.current.delete(`${module.name}-restart`);
        }
      }
    });
  }, [
    modules,
    autoRestartManager,
    orchestrator,
    prefsManager,
    showToast,
    triggerUpdate,
    dataManager,
  ]);

  // Cleanup Auto Restart
  useEffect(() => {
    return () => {
      autoRestartManager.cleanup();
    };
  }, [autoRestartManager]);

  // Actions
  const executeModuleAction = useCallback(
    async (action: 'start' | 'stop' | 'restart', moduleName: string) => {
      if (isProcessing) return;

      const targetModule = modules.find((m) => m.name === moduleName);
      const moduleType = targetModule?.type ?? 'default';

      try {
        setIsProcessing(true);
        showToast(getPoeticMessage(action, moduleType), 'info');
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
        const poeticPrefix = getPoeticMessage('error', moduleType);
        // Combine poetic prefix with actual error for clarity
        showToast(`${poeticPrefix}: ${errorMsg}`, 'error');
        setError(errorMsg);
        prefsManager.addToHistory(`${action} ${moduleName}`, moduleName, false);
      } finally {
        setIsProcessing(false);
      }
    },
    [orchestrator, isProcessing, modules, dataManager, prefsManager, showToast, triggerUpdate]
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

  return useMemo(
    () => ({
      modules,
      setModules,
      loading,
      error,
      isProcessing,
      systemResources,
      toasts,
      showToast,
      bulkOperationProgress,
      processManager,
      orchestrator,
      dataManager,
      prefsManager,
      resourceHistory,
      autoRestartManager,
      gitBranch,
      cwdName,
      nodeVersion,
      theme,
      triggerUpdate,
      executeModuleAction,
      executeBulkAction,
    }),
    [
      modules,
      loading,
      error,
      isProcessing,
      systemResources,
      toasts,
      showToast,
      bulkOperationProgress,
      processManager,
      orchestrator,
      dataManager,
      prefsManager,
      resourceHistory,
      autoRestartManager,
      gitBranch,
      cwdName,
      nodeVersion,
      theme,
      triggerUpdate,
      executeModuleAction,
      executeBulkAction,
    ]
  );
}
