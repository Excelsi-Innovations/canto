import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { render, Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { loadConfig } from '../../config/parser.js';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { DockerExecutor } from '../../modules/docker.js';
import { getSystemResources, getProcessResources, createBar, formatMemory, formatCPU, type SystemResources } from '../../utils/resources.js';

interface ModuleStatus {
  name: string;
  type: string;
  status: 'RUNNING' | 'STOPPED' | 'STARTING' | 'STOPPING' | 'ERROR';
  pid?: number;
  uptime?: number;
  cpu?: number;
  memory?: number;
  containers?: Array<{
    name: string;
    status: string;
    ports: string[];
  }>;
}

type Screen = 'dashboard' | 'modules' | 'logs' | 'env' | 'help';

const Dashboard: React.FC = () => {
  useApp(); // Just to trigger app context
  const [screen, setScreen] = useState<Screen>('dashboard');
  const [selectedModule, setSelectedModule] = useState(0);
  const [modules, setModules] = useState<ModuleStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemResources, setSystemResources] = useState<SystemResources>(() => getSystemResources());
  
  const [processManager] = useState(() => new ProcessManager());
  const [orchestrator] = useState(() => new ModuleOrchestrator(processManager));
  const [dockerExecutor] = useState(() => new DockerExecutor(processManager));

  // Load configuration and status
  const loadConfigAndStatus = useCallback(async () => {
    // Don't reload if we're processing an action
    if (isProcessing) return;

    try {
      const config = await loadConfig();
      orchestrator.load(config);

      const moduleNames = orchestrator.getModuleNames();
      const statuses: ModuleStatus[] = [];

      for (const name of moduleNames) {
        const module = orchestrator.getModule(name);
        if (!module) continue;

        const status = processManager.getStatus(name);
        const pid = processManager.getPid(name);

        const moduleStatus: ModuleStatus = {
          name,
          type: module.type,
          status: status as any || 'STOPPED',
          pid,
        };

        // Get process resources if we have a PID
        if (pid) {
          const resources = getProcessResources(pid);
          if (resources) {
            moduleStatus.cpu = resources.cpu;
            moduleStatus.memory = resources.memory;
          }
        }

        // Get Docker containers if it's a Docker module
        if (module.type === 'docker') {
          try {
            const services = dockerExecutor.getServices(module);
            moduleStatus.containers = services
              .filter((s) => s.container)
              .map((s) => ({
                name: s.container!.name,
                status: s.container!.status,
                ports: s.container!.ports.map((p) => {
                  const match = p.match(/(?:[\d.]+:)?(\d+)->/);
                  return match ? `:${match[1]}` : '';
                }).filter(Boolean),
              }));
          } catch (e) {
            // Ignore Docker errors
          }
        }

        statuses.push(moduleStatus);
      }

      setModules(statuses);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }, [orchestrator, processManager, dockerExecutor, isProcessing]);

  useEffect(() => {
    loadConfigAndStatus();
    const interval = setInterval(loadConfigAndStatus, 3000); // Refresh every 3s
    return () => clearInterval(interval);
  }, [loadConfigAndStatus]);

  // Update system resources more frequently
  useEffect(() => {
    const interval = setInterval(() => {
      setSystemResources(getSystemResources());
    }, 2000); // Update every 2s
    return () => clearInterval(interval);
  }, []);

  const handleModuleAction = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    const module = modules[selectedModule];
    if (!module || isProcessing) return;

    try {
      setIsProcessing(true);
      if (action === 'start') {
        await orchestrator.start(module.name);
      } else if (action === 'stop') {
        await orchestrator.stop(module.name);
      } else if (action === 'restart') {
        await orchestrator.restart(module.name);
      }
      await loadConfigAndStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  }, [modules, selectedModule, orchestrator, loadConfigAndStatus, isProcessing]);

  const handleExit = useCallback(() => {
    // Force exit immediately
    process.exit(0);
  }, []);

  useInput((input, key) => {
    // Global quit - works from any screen
    if (input === 'q' || input === 'Q') {
      handleExit();
      return;
    }

    if (key.escape) {
      if (screen === 'dashboard') {
        handleExit();
      } else {
        setScreen('dashboard');
      }
      return;
    }

    if (screen === 'dashboard') {
      if (key.upArrow && selectedModule > 0) {
        setSelectedModule(selectedModule - 1);
      } else if (key.downArrow && selectedModule < modules.length - 1) {
        setSelectedModule(selectedModule + 1);
      } else if (input === '1' || input === 's' || input === 'S') {
        handleModuleAction('start');
      } else if (input === '2' || input === 'x' || input === 'X') {
        handleModuleAction('stop');
      } else if (input === '3' || input === 'r' || input === 'R') {
        handleModuleAction('restart');
      } else if (input === 'm' || input === 'M') {
        setScreen('modules');
      } else if (input === 'e' || input === 'E') {
        setScreen('env');
      } else if (input === 'l' || input === 'L') {
        setScreen('logs');
      } else if (input === 'h' || input === 'H' || input === '?') {
        setScreen('help');
      }
    } else {
      // Any screen can go back with 'b'
      if (input === 'b' || input === 'B') {
        setScreen('dashboard');
      }
    }
  });

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
    return <LogsScreen modules={modules} selectedModule={selectedModule} onBack={() => setScreen('dashboard')} onQuit={handleExit} />;
  }

  // Main Dashboard
  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="cyan">
            {'🎵 CANTO DEVELOPMENT DASHBOARD'}
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text dimColor>
              {stats.runningCount} Running • {stats.stoppedCount} Stopped • {stats.total} Total
              {isProcessing && <Text color="yellow"> • Processing...</Text>}
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text dimColor>
                <Text bold>CPU:</Text> {createBar(systemResources.cpuUsage, 100, 15)} {formatCPU(systemResources.cpuUsage)}
              </Text>
              <Text dimColor>
                <Text bold>RAM:</Text> {createBar(systemResources.usedMemory, systemResources.totalMemory, 15)} {formatMemory(systemResources.usedMemory)}/{formatMemory(systemResources.totalMemory)}
              </Text>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Module List */}
      <Box borderStyle="round" borderColor="gray" padding={1} marginBottom={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text bold color="yellow">
            {'📦 MODULES'}
          </Text>
        </Box>

        {modules.map((module, index) => (
          <ModuleRow
            key={module.name}
            module={module}
            isSelected={index === selectedModule}
          />
        ))}
      </Box>

      {/* Action Bar */}
      <Box borderStyle="round" borderColor="gray" padding={1} marginBottom={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="green">{'⚡ ACTIONS'}</Text>
          <Box marginTop={1}>
            <Text>
              <Text color="green">[1/S]</Text> Start  {' '}
              <Text color="red">[2/X]</Text> Stop  {' '}
              <Text color="yellow">[3/R]</Text> Restart
            </Text>
          </Box>
          <Box marginTop={0}>
            <Text>
              <Text color="yellow">[L]</Text> Logs  {' '}
              <Text color="cyan">[M]</Text> Modules  {' '}
              <Text color="magenta">[E]</Text> Env  {' '}
              <Text color="white">[Q]</Text> Quit
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Status Bar */}
      <Box borderStyle="single" borderColor="gray" padding={1}>
        <Text dimColor>
          Use ↑↓ to navigate • Press keys for actions • Press 'h' for help
        </Text>
      </Box>
    </Box>
  );
};

// Separate ModuleRow component to prevent re-renders
const ModuleRow: React.FC<{ module: ModuleStatus; isSelected: boolean }> = React.memo(({ module, isSelected }) => {
  const statusIcon = module.status === 'RUNNING' ? '●' : module.status === 'ERROR' ? '✗' : '○';

  return (
    <Box marginBottom={1} flexDirection="column">
      <Box width="100%">
        <Text backgroundColor={isSelected ? 'blue' : undefined} color={isSelected ? 'white' : undefined}>
          {isSelected ? '❯' : ' '} {statusIcon} {module.name.padEnd(20)} {module.type.padEnd(10)}
        </Text>
        {module.pid && (
          <>
            <Text dimColor> PID {module.pid}</Text>
            {module.cpu !== undefined && (
              <Text dimColor> • CPU {module.cpu.toFixed(1)}%</Text>
            )}
            {module.memory !== undefined && (
              <Text dimColor> • RAM {formatMemory(module.memory)}</Text>
            )}
          </>
        )}
      </Box>

      {/* Show Docker containers if selected and available */}
      {isSelected && module.containers && module.containers.length > 0 && (
        <Box marginLeft={4} marginTop={1} flexDirection="column">
          {module.containers.map((container) => (
            <Box key={container.name} marginBottom={0}>
              <Text dimColor>
                {'├─ '}
                <Text color={container.status === 'running' ? 'green' : 'gray'}>
                  {container.status === 'running' ? '●' : '○'}
                </Text>
                {' '}{container.name}
                {container.ports.length > 0 && (
                  <Text color="cyan"> {container.ports.join(', ')}</Text>
                )}
              </Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
});

ModuleRow.displayName = 'ModuleRow';

interface ScreenProps {
  onBack: () => void;
  onQuit: () => void;
}

const HelpScreen: React.FC<ScreenProps> = ({ onBack, onQuit }) => {
  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
        <Text bold color="cyan">
          {'📖 CANTO HELP'}
        </Text>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        <Text bold color="yellow">Navigation</Text>
        <Text>  ↑↓         Navigate modules</Text>
        <Text>  Enter      Select/Execute</Text>
        <Text>  ESC/B      Go back</Text>
        <Text>  Q          Quit Canto</Text>
        <Box marginTop={1} />

        <Text bold color="yellow">Module Actions</Text>
        <Text>  1 or S     Start selected module</Text>
        <Text>  2 or X     Stop selected module</Text>
        <Text>  3 or R     Restart selected module</Text>
        <Box marginTop={1} />

        <Text bold color="yellow">Screens</Text>
        <Text>  L          Logs viewer</Text>
        <Text>  M          Module management</Text>
        <Text>  E          Environment variables</Text>
        <Text>  H or ?     This help screen</Text>
        <Box marginTop={1} />

        <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit</Text>
      </Box>
    </Box>
  );
};

const EnvScreen: React.FC<ScreenProps> = ({ onBack, onQuit }) => {
  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="magenta" padding={1} marginBottom={1}>
        <Text bold color="magenta">
          {'🔧 ENVIRONMENT VARIABLES'}
        </Text>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
        <Text color="yellow">Environment management features:</Text>
        <Text>  • List all .env files</Text>
        <Text>  • Check for missing variables</Text>
        <Text>  • View port assignments</Text>
        <Text>  • Compare with examples</Text>
        <Box marginTop={1} />

        <Text color="cyan">Use CLI commands:</Text>
        <Text dimColor>  canto env --list     List all env files</Text>
        <Text dimColor>  canto env --ports    Show port assignments</Text>
        <Text dimColor>  canto env --check    Check for issues</Text>
        <Box marginTop={1} />

        <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit</Text>
      </Box>
    </Box>
  );
};

interface LogsScreenProps extends ScreenProps {
  modules: ModuleStatus[];
  selectedModule: number;
}

const LogsScreen: React.FC<LogsScreenProps> = ({ modules, selectedModule, onBack, onQuit }) => {
  const [logContent, setLogContent] = useState<string>('');
  const [scrollOffset, setScrollOffset] = useState(0);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(selectedModule);
  const currentModule = modules[currentModuleIndex];

  const loadLogs = useCallback(() => {
    if (!currentModule || !currentModule.name) {
      setLogContent('No module selected');
      return;
    }

    try {
      const logDir = join(process.cwd(), 'tmp', 'logs');
      const logFile = join(logDir, `${currentModule.name}.log`);

      if (!existsSync(logFile)) {
        setLogContent(`No log file found for ${currentModule.name}\nExpected: ${logFile}`);
        return;
      }

      const content = readFileSync(logFile, 'utf-8');
      const lines = content.split('\n');
      // Get last 100 lines
      const recentLines = lines.slice(-100).join('\n');
      setLogContent(recentLines || 'Log file is empty');
    } catch (err) {
      setLogContent(`Error reading logs: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [currentModule]);

  useEffect(() => {
    loadLogs();
    // Auto-refresh logs every 2 seconds
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, [loadLogs]);

  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    } else if (key.leftArrow && currentModuleIndex > 0) {
      setCurrentModuleIndex(currentModuleIndex - 1);
      setScrollOffset(0);
    } else if (key.rightArrow && currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
      setScrollOffset(0);
    } else if (key.upArrow && scrollOffset > 0) {
      setScrollOffset(scrollOffset - 1);
    } else if (key.downArrow) {
      setScrollOffset(scrollOffset + 1);
    } else if (input === 'r' || input === 'R') {
      loadLogs();
    }
  });

  const displayLines = logContent.split('\n').slice(scrollOffset, scrollOffset + 20);

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="double" borderColor="yellow" padding={1} marginBottom={1}>
        <Box flexDirection="column" width="100%">
          <Text bold color="yellow">
            {'📋 LOGS VIEWER'}
          </Text>
          <Box marginTop={1}>
            <Text dimColor>
              Module: <Text bold color="cyan">{currentModule?.name || 'None'}</Text>
              {' • '}Use ←→ to switch modules • ↑↓ to scroll • [R]efresh
            </Text>
          </Box>
        </Box>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column" height={22}>
        {displayLines.map((line, index) => (
          <Text key={scrollOffset + index} dimColor={line.trim() === ''}>
            {line || ' '}
          </Text>
        ))}
      </Box>

      <Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
        <Text dimColor>
          Press 'b' or ESC to go back • Press 'q' to quit • Press 'r' to refresh
        </Text>
      </Box>
    </Box>
  );
};

export async function dashboardCommand(): Promise<void> {
  render(<Dashboard />);
}
