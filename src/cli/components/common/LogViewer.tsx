import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';

import { copyToClipboard } from '../../utils/clipboard.js';

interface LogViewerProps {
  lines: string[];
  height?: number;
  width?: number | string;
  onBack?: () => void;
  onQuit?: () => void;
  onClear?: () => void;
  title?: string;
  subtitle?: string;
  borderColor?: string;
}

/**
 * Colorizes a log line based on keywords and patterns
 */
function colorizeLogLine(line: string, index: number): React.ReactNode {
  // Sanitize line to prevent TUI breakage (e.g. \r moving cursor)
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

export const LogViewer: React.FC<LogViewerProps> = ({
  lines,
  height = 20,
  width = '100%',
  onBack,
  onQuit,
  onClear,
  title = 'LOGS VIEWER',
  subtitle,
  borderColor = 'gray',
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCopyMode, setIsCopyMode] = useState(false);
  const [copyCount, setCopyCount] = useState('200');
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Auto-scroll logic happens when lines change
  useEffect(() => {
    if (autoScroll && !isCopyMode) {
      // If we are auto-scrolling, keep strictly at the bottom
      // We calculate offset so that the last line is visible
      const maxOffset = Math.max(0, lines.length - height);
      setScrollOffset(maxOffset);
    }
  }, [lines, height, autoScroll, isCopyMode]);

  // Clear copy status message
  useEffect(() => {
    if (copyStatus) {
      const timer = setTimeout(() => setCopyStatus(null), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [copyStatus]);

  useInput(async (input, key) => {
    // COPY MODE INTERACTION
    if (isCopyMode) {
      if (key.escape) {
        setIsCopyMode(false);
        setCopyCount('200');
        return;
      }

      if (key.return) {
        const count = parseInt(copyCount, 10);
        if (!isNaN(count) && count > 0) {
          const text = lines.slice(-count).join('\n');
          try {
            await copyToClipboard(text);
            setCopyStatus(`Copied last ${count} lines!`);
          } catch (err) {
            setCopyStatus(`Copy failed: ${String(err)}`);
          }
        } else {
          setCopyStatus('Invalid number');
        }
        setIsCopyMode(false);
        return;
      }

      if (key.backspace || key.delete) {
        setCopyCount((prev) => prev.slice(0, -1));
        return;
      }

      if (!isNaN(parseInt(input, 10))) {
        setCopyCount((prev) => prev + input);
      }
      return;
    }

    // NORMAL MODE

    // Navigation
    if (key.upArrow) {
      setScrollOffset((prev) => {
        const next = Math.max(0, prev - 1);
        if (next !== prev) setAutoScroll(false);
        return next;
      });
    }

    if (key.downArrow) {
      setScrollOffset((prev) => {
        const maxOffset = Math.max(0, lines.length - height);
        const next = Math.min(maxOffset, prev + 1);
        if (next >= maxOffset) setAutoScroll(true);
        return next;
      });
    }

    if (key.pageUp) {
      setScrollOffset((prev) => {
        const next = Math.max(0, prev - height);
        if (next !== prev) setAutoScroll(false);
        return next;
      });
    }

    if (key.pageDown) {
      setScrollOffset((prev) => {
        const maxOffset = Math.max(0, lines.length - height);
        const next = Math.min(maxOffset, prev + height);
        if (next >= maxOffset) setAutoScroll(true);
        return next;
      });
    }

    // Go to Top/Bottom
    if (input === 'g') {
      setScrollOffset(0);
      setAutoScroll(false);
    }
    if (input === 'G') {
      const maxOffset = Math.max(0, lines.length - height);
      setScrollOffset(maxOffset);
      setAutoScroll(true);
    }

    // Toggle Copy Mode
    if (input === 'c' || input === 'C') {
      setIsCopyMode(true);
      setCopyCount('200');
      return;
    }

    // Clear Logs
    if (input === 'x' || input === 'X') {
      onClear?.();
      setCopyStatus('Logs cleared');
      return;
    }

    // Exit
    if (input === 'q' || input === 'Q') {
      onQuit?.();
    }
    if (input === 'b' || input === 'B' || key.escape) {
      onBack?.();
    }
    return;
  });

  const displayLines = lines.slice(scrollOffset, scrollOffset + height);

  return (
    <Box flexDirection="column" width={width}>
      <Box
        borderStyle="round"
        borderColor={borderColor}
        flexDirection="column"
        paddingX={1}
        width="100%"
        marginBottom={0}
      >
        <Box
          marginBottom={1}
          borderStyle="single"
          borderBottom
          borderTop={false}
          borderLeft={false}
          borderRight={false}
          borderColor={borderColor}
        >
          <Text bold color={borderColor === 'gray' ? 'white' : borderColor}>
            {title}
          </Text>
        </Box>

        {subtitle && (
          <Box marginBottom={1}>
            <Text dimColor>{subtitle}</Text>
          </Box>
        )}

        {isCopyMode ? (
          <Box
            height={height}
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            width="100%"
          >
            <Text bold color="cyan">
              COPY LOGS
            </Text>
            <Text>How many lines to copy?</Text>
            <Box borderStyle="single" borderColor="cyan" paddingX={1} marginTop={1}>
              <Text>
                {copyCount}
                <Text color="gray">_</Text>
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>Enter to copy • Esc to cancel</Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column" height={height} width="100%" minWidth={0} overflow="hidden">
            {lines.length === 0 ? (
              <Text dimColor>No logs available.</Text>
            ) : (
              displayLines.map((line, i) => (
                <Box key={scrollOffset + i} width="100%">
                  {colorizeLogLine(line, scrollOffset + i)}
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Box flexGrow={1}>
          <Text dimColor>
            {autoScroll ? 'Following (Auto)' : 'Paused'} • {lines.length} lines • 'c' Copy • 'x'
            Clear
          </Text>
        </Box>
        {copyStatus && (
          <Box marginLeft={2}>
            <Text color={copyStatus.includes('failed') ? 'red' : 'green'} bold>
              {copyStatus}
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
