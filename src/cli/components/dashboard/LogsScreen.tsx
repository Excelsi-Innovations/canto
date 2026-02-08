import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { existsSync } from 'fs';
import { join } from 'path';
import { LogTailer } from '../../lib/log-tailer.js';
import type { ModuleStatus, ScreenProps } from '../../types.js';

interface LogsScreenProps extends ScreenProps {
  modules: ModuleStatus[];
  selectedModule: number;
}

/**
 * Colorizes a log line based on keywords and patterns
 */
function colorizeLogLine(line: string, index: number): React.ReactNode {
  if (!line.trim()) {
    return (
      <Text key={index} dimColor>
        {' '}
      </Text>
    );
  }

  // Check for error patterns
  if (
    /error|exception|fatal|fail|crash|panic/i.test(line) ||
    /\[ERROR\]|\[FATAL\]|ERROR:|FATAL:/i.test(line)
  ) {
    return (
      <Text key={index} color="red">
        {line}
      </Text>
    );
  }

  // Check for warning patterns
  if (/warn|warning|caution|alert/i.test(line) || /\[WARN\]|WARN:/i.test(line)) {
    return (
      <Text key={index} color="yellow">
        {line}
      </Text>
    );
  }

  // Check for success patterns
  if (/success|complete|done|ready|listening|started/i.test(line)) {
    return (
      <Text key={index} color="green">
        {line}
      </Text>
    );
  }

  // Check for info patterns
  if (/info|debug|trace/i.test(line) || /\[INFO\]|\[DEBUG\]|INFO:|DEBUG:/i.test(line)) {
    return (
      <Text key={index} color="cyan" dimColor>
        {line}
      </Text>
    );
  }

  // Highlight timestamps (ISO format, HH:MM:SS, etc.)
  const timestampMatch = line.match(
    /^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?|\d{2}:\d{2}:\d{2}(?:\.\d+)?)/
  );
  if (timestampMatch && timestampMatch[1]) {
    const timestamp = timestampMatch[1];
    const rest = line.substring(timestamp.length);
    return (
      <Text key={index}>
        <Text dimColor>{timestamp}</Text>
        <Text>{rest}</Text>
      </Text>
    );
  }

  // Default - regular log line
  return (
    <Text key={index} dimColor>
      {line}
    </Text>
  );
}

export const LogsScreen: React.FC<LogsScreenProps> = React.memo(
  ({ modules, selectedModule, onBack, onQuit }) => {
    const [logTailer] = useState(() => new LogTailer(100));
    const [logLines, setLogLines] = useState<string[]>([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [currentModuleIndex, setCurrentModuleIndex] = useState(selectedModule);
    const currentModule = modules[currentModuleIndex];

    useEffect(() => {
      if (!currentModule?.name) {
        setLogLines(['No module selected']);
        return;
      }

      const logDir = join(process.cwd(), 'tmp', 'logs');
      const logFile = join(logDir, `${currentModule.name}.log`);

      if (!existsSync(logFile)) {
        setLogLines([`No log file found for ${currentModule.name}`, `Expected: ${logFile}`]);
        return;
      }

      // Start tailing the log file
      logTailer.start(logFile);

      // Subscribe to log updates
      const unsubscribe = logTailer.subscribe((lines) => {
        setLogLines(lines);
      });

      return () => {
        unsubscribe();
      };
    }, [currentModule, logTailer]);

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
      }
    });

    const displayLines = logLines.slice(scrollOffset, scrollOffset + 20);

    return (
      <Box flexDirection="column" padding={1}>
        <Box borderStyle="double" borderColor="yellow" padding={1} marginBottom={1}>
          <Box flexDirection="column" width="100%">
            <Text bold color="yellow">
              📋 LOGS VIEWER
            </Text>
            <Box marginTop={1}>
              <Text dimColor>
                Module:{' '}
                <Text bold color="cyan">
                  {currentModule?.name || 'None'}
                </Text>
                <Text dimColor>
                  {' '}
                  ({currentModuleIndex + 1}/{modules.length})
                </Text>
                Use ←→ to switch modules • ↑↓ to scroll
              </Text>
            </Box>
          </Box>
        </Box>

        <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column" height={22}>
          {displayLines.map((line, index) => colorizeLogLine(line, scrollOffset + index))}
        </Box>

        <Box borderStyle="single" borderColor="gray" padding={1} marginTop={1}>
          <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit</Text>
        </Box>
      </Box>
    );
  }
);

LogsScreen.displayName = 'LogsScreen';
