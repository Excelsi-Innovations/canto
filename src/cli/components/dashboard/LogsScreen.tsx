import React, { useState, useEffect } from 'react';
import { Box, useInput } from 'ink';
import { existsSync } from 'fs';
import { join } from 'path';
import { LogTailer } from '../../lib/log-tailer.js';
import type { ModuleStatus, ScreenProps } from '../../types.js';
import { LogViewer } from '../common/LogViewer.js';

interface LogsScreenProps extends ScreenProps {
  modules: ModuleStatus[];
  selectedModule: number;
}

export const LogsScreen: React.FC<LogsScreenProps> = React.memo(
  ({ modules, selectedModule, onBack, onQuit }) => {
    const [logTailer] = useState(() => new LogTailer(100));
    const [logLines, setLogLines] = useState<string[]>([]);
    const [currentModuleIndex, setCurrentModuleIndex] = useState(selectedModule);
    const currentModule = modules[currentModuleIndex];

    // Throttling refs
    const latestLines = React.useRef<string[]>([]);
    const updateTimeout = React.useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (!currentModule?.name) {
        setLogLines(['No module selected']);
        return;
      }

      const logDir = join(process.cwd(), 'tmp', 'logs');
      const logFile = join(logDir, `${currentModule.name}.log`);

      // Reset state on module switch
      setLogLines([]);

      if (!existsSync(logFile)) {
        setLogLines([`No log file found for ${currentModule.name}`, `Expected: ${logFile}`]);
        return;
      }

      // Start tailing the log file
      logTailer.start(logFile);

      // Subscribe to log updates with throttling
      const unsubscribe = logTailer.subscribe((lines) => {
        latestLines.current = lines;

        updateTimeout.current ??= setTimeout(() => {
          setLogLines(latestLines.current);
          updateTimeout.current = null;
        }, 100);
      });

      return () => {
        unsubscribe();
        if (updateTimeout.current) {
          clearTimeout(updateTimeout.current);
          updateTimeout.current = null;
        }
      };
    }, [currentModule, logTailer]);

    useInput((_input, key) => {
      if (key.leftArrow && currentModuleIndex > 0) {
        setCurrentModuleIndex(currentModuleIndex - 1);
      } else if (key.rightArrow && currentModuleIndex < modules.length - 1) {
        setCurrentModuleIndex(currentModuleIndex + 1);
      }
    });

    const subtitle = `Module: ${currentModule?.name ?? 'None'} (${currentModuleIndex + 1}/${modules.length}) • ←→ Switch Module`;

    return (
      <Box flexDirection="column" padding={1} width="100%">
        <LogViewer
          lines={logLines}
          height={20}
          title="📋 LOGS VIEWER"
          subtitle={subtitle}
          onBack={onBack}
          onQuit={onQuit}
          onClear={() => logTailer.clear()}
          borderColor="yellow"
        />
      </Box>
    );
  }
);

LogsScreen.displayName = 'LogsScreen';
