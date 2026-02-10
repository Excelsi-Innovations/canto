import { useCallback } from 'react';
import type { Screen, ModuleStatus } from '../types.js';
import { useInput } from 'ink';
import type { useDashboardData } from './useDashboardData.js';
import { THEMES, type Theme } from '../../utils/preferences.js';

interface UseDashboardInputProps {
  screen: Screen;
  setScreen: (screen: Screen) => void;
  searchMode: boolean;
  setSearchMode: (mode: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedModule: number;
  setSelectedModule: (index: number) => void;
  sortedModules: ModuleStatus[];
  confirmAction: {
    action: 'stop' | 'restart' | 'bulk-start' | 'bulk-stop' | 'bulk-restart';
    moduleName?: string;
    moduleNames?: string[];
  } | null;
  setConfirmAction: (action: any) => void;
  selectedModules: Set<string>;
  setSelectedModules: (modules: Set<string>) => void;
  lastKey: string | null;
  setLastKey: (key: string | null) => void;
  handleExit: () => void;
  data: ReturnType<typeof useDashboardData>;
  showQuitConfirm: boolean;
  setShowQuitConfirm: (show: boolean) => void;
}

export function useDashboardInput({
  screen,
  setScreen,
  searchMode,
  setSearchMode,
  searchQuery,
  setSearchQuery,
  selectedModule,
  setSelectedModule,
  sortedModules,
  confirmAction,
  setConfirmAction,
  selectedModules,
  setSelectedModules,
  lastKey,
  setLastKey,
  handleExit,
  data,
  showQuitConfirm,
  setShowQuitConfirm,
}: UseDashboardInputProps) {
  const {
    showToast,
    prefsManager,
    executeModuleAction,
    executeBulkAction,
    triggerUpdate,
    isProcessing
  } = data;

  // Helper Actions
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
    [sortedModules, selectedModule, isProcessing, executeModuleAction, setConfirmAction]
  );

  const handleBulkAction = useCallback(
    (action: 'start' | 'stop' | 'restart') => {
      if (selectedModules.size === 0 || isProcessing) return;
      const moduleNames = Array.from(selectedModules);
      const bulkAction = `bulk-${action}` as const;
      setConfirmAction({ action: bulkAction, moduleNames });
    },
    [selectedModules, isProcessing, setConfirmAction]
  );

  const toggleModuleSelection = useCallback(() => {
    const module = sortedModules[selectedModule];
    if (!module) return;
    const newSet = new Set(selectedModules);
    if (newSet.has(module.name)) {
      newSet.delete(module.name);
    } else {
      newSet.add(module.name);
    }
    setSelectedModules(newSet);
  }, [sortedModules, selectedModule, selectedModules, setSelectedModules]);

  const selectAllFiltered = useCallback(() => {
    const allNames = sortedModules.map((m) => m.name);
    setSelectedModules(new Set(allNames));
    showToast(`Selected ${allNames.length} modules`, 'info');
  }, [sortedModules, showToast, setSelectedModules]);

  const clearSelection = useCallback(() => {
    setSelectedModules(new Set());
  }, [setSelectedModules]);

  // Main Input Handler
  useInput(
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
      // Global Quit
      if (input === 'q' || input === 'Q') {
        if (showQuitConfirm) {
           // If already showing confirm, 'q' does nothing? Or maybe cancels?
           // Let's keep it simple: 'q' triggers confirm.
           return;
        }
        setShowQuitConfirm(true);
        return;
      }
      
      // Quit Confirmation Handling
      if (showQuitConfirm) {
        if (input === 'y' || input === 'Y' || key.return) {
           handleExit();
        } else if (input === 'n' || input === 'N' || key.escape) {
           setShowQuitConfirm(false);
        }
        // Block other inputs
        return;
      }

      // Escape Handling
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
          // Instead of immediate exit, show confirm
          setShowQuitConfirm(true);
        } else {
          setScreen('dashboard');
        }
        return;
      }

      // Confirmation Modal
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
          // Clear selection after bulk action
          if (confirmAction.action.startsWith('bulk-')) {
            clearSelection();
          }
        } else if (input === 'n' || input === 'N') {
          setConfirmAction(null);
        }
        return;
      }

      // Dashboard Logic
      if (screen === 'dashboard') {
        if (searchMode) {
          if (key.return) {
            setSearchMode(false);
            return;
          }
          if (key.backspace || key.delete) {
            setSearchQuery(searchQuery.slice(0, -1));
            return;
          }
          // Accept any printable character (length 1) that isn't a special key
          if (input && input.length === 1 && !key.ctrl) {
            setSearchQuery(searchQuery + input);
          }
          return;
        }

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
      } else {
        if (input === 'b' || input === 'B') {
          setScreen('dashboard');
        }
      }
    }
  );

  return {
    handleModuleAction,
    handleBulkAction,
    toggleModuleSelection,
    selectAllFiltered,
    clearSelection
  };
}
