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
  // Sanitize line to prevent TUI breakage (e.g. \r moving cursor)
  // We keep ANSI codes potentially, but remove CR
  const safeLine = line.replace(/\r/g, '');

  if (!safeLine.trim()) {
    return (
      <Text key={index} dimColor wrap="wrap">
        {' '}
      </Text>
    );
  }

  // Check for error patterns
  if (
    /error|exception|fatal|fail|crash|panic/i.test(safeLine) ||
    /\[ERROR\]|\[FATAL\]|ERROR:|FATAL:/i.test(safeLine)
  ) {
    return (
      <Text key={index} color="red" wrap="wrap">
        {safeLine}
      </Text>
    );
  }

  // Check for warning patterns
  if (/warn|warning|caution|alert/i.test(safeLine) || /\[WARN\]|WARN:/i.test(safeLine)) {
    return (
      <Text key={index} color="yellow" wrap="wrap">
        {safeLine}
      </Text>
    );
  }

  // Check for success patterns
  if (/success|complete|done|ready|listening|started/i.test(safeLine)) {
    return (
      <Text key={index} color="green" wrap="wrap">
        {safeLine}
      </Text>
    );
  }

  // Check for info patterns
  if (/info|debug|trace/i.test(safeLine) || /\[INFO\]|\[DEBUG\]|INFO:|DEBUG:/i.test(safeLine)) {
    return (
      <Text key={index} color="cyan" dimColor wrap="wrap">
        {safeLine}
      </Text>
    );
  }

  // Highlight timestamps (ISO format, HH:MM:SS, etc.)
  const timestampMatch = safeLine.match(
    /^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?|\d{2}:\d{2}:\d{2}(?:\.\d+)?)/
  );
  if (timestampMatch?.[1]) {
    const timestamp = timestampMatch[1];
    const rest = safeLine.substring(timestamp.length);
    return (
      <Text key={index} wrap="wrap">
        <Text dimColor>{timestamp}</Text>
        <Text>{rest}</Text>
      </Text>
    );
  }

  // Default - regular log line
  return (
    <Text key={index} dimColor wrap="wrap">
      {safeLine}
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

    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll logic
    useEffect(() => {
      if (autoScroll) {
        setScrollOffset(Math.max(0, logLines.length - 20)); // Keep at bottom
      }
    }, [logLines, autoScroll]);

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
      setScrollOffset(0);
      setAutoScroll(true);
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

    useInput((input, key) => {
      if (input === 'q' || input === 'Q') {
        onQuit();
      } else if (input === 'b' || input === 'B' || key.escape) {
        onBack();
      } else if (input === 'g') {
        // Go to Top
        setScrollOffset(0);
        setAutoScroll(false);
      } else if (input === 'G') {
        // Go to Bottom
        setAutoScroll(true);
      } else if (key.leftArrow && currentModuleIndex > 0) {
        setCurrentModuleIndex(currentModuleIndex - 1);
        setScrollOffset(0);
        setAutoScroll(true);
      } else if (key.rightArrow && currentModuleIndex < modules.length - 1) {
        setCurrentModuleIndex(currentModuleIndex + 1);
        setScrollOffset(0);
        setAutoScroll(true);
      } else if (key.upArrow && scrollOffset > 0) {
        setScrollOffset(scrollOffset - 1);
        setAutoScroll(false);
      } else if (key.downArrow) {
        const maxOffset = Math.max(0, logLines.length - 20);
        const newOffset = Math.min(maxOffset, scrollOffset + 1);
        setScrollOffset(newOffset);
        if (newOffset >= maxOffset) {
          setAutoScroll(true);
        }
      }
    });

    const displayLines = logLines.slice(scrollOffset, scrollOffset + 20);

    return (
      <Box flexDirection="column" padding={1} width="100%">
        <Box borderStyle="double" borderColor="yellow" padding={1} marginBottom={1} width="100%">
          <Box flexDirection="column" flexGrow={1}>
            <Text bold color="yellow">
              📋 LOGS VIEWER
            </Text>
            <Box marginTop={1}>
              <Text dimColor>
                Module:{' '}
                <Text bold color="cyan">
                  {currentModule?.name ?? 'None'}
                </Text>
                <Text dimColor>
                  {' '}
                  ({currentModuleIndex + 1}/{modules.length})
                </Text>
                Use ←→ to switch modules • ↑↓ to scroll • 'G' to bottom
              </Text>
            </Box>
          </Box>
        </Box>

        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          flexDirection="column"
          flexGrow={1}
          minHeight={20}
          width="100%"
        >
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
