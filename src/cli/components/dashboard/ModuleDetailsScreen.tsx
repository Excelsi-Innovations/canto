import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ModuleStatus, ScreenProps } from '../../types.js';
import type { Module } from '../../../config/schema.js';
import { LogTailer } from '../../lib/log-tailer.js';
import { existsSync } from 'fs';
import { join } from 'path';

interface ModuleDetailsScreenProps extends ScreenProps {
  module: ModuleStatus;
  moduleConfig: Module | null;
}

/**
 * Colorizes a log line based on keywords and patterns
 */
function colorizeLogLine(line: string, index: number): React.ReactNode {
  // Sanitize line to prevent TUI breakage
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

  // Default - regular log line
  return (
    <Text key={index} dimColor wrap="wrap">
      {safeLine}
    </Text>
  );
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number | undefined): string {
  if (!seconds) return 'N/A';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

export const ModuleDetailsScreen: React.FC<ModuleDetailsScreenProps> = React.memo(
  ({ module, moduleConfig, onBack, onQuit }) => {
    const [logTailer] = useState(() => new LogTailer(50));
    const [logLines, setLogLines] = useState<string[]>([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const maxVisibleLines = 15;
    
    const [autoScroll, setAutoScroll] = useState(true);

    // Auto-scroll logic
    useEffect(() => {
      if (autoScroll) {
        setScrollOffset(Math.max(0, logLines.length - maxVisibleLines));
      }
    }, [logLines, autoScroll]);

    // Throttling refs
    const latestLines = React.useRef<string[]>([]);
    const updateTimeout = React.useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
      if (!module.name) {
        setLogLines(['No module selected']);
        return;
      }

      const logPath = join(process.cwd(), 'tmp', 'logs', `${module.name}.log`);
      
      // Reset
      setAutoScroll(true);
      setLogLines([]);

      if (!existsSync(logPath)) {
        setLogLines([`No log file found at: ${logPath}`]);
        return;
      }

      logTailer.start(logPath);

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
        logTailer.stop();
      };
    }, [module.name, logTailer]);

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
      } else if (key.upArrow && scrollOffset > 0) {
        setScrollOffset(scrollOffset - 1);
        setAutoScroll(false);
      } else if (key.downArrow && scrollOffset < logLines.length - maxVisibleLines) {
        const newOffset = scrollOffset + 1;
        setScrollOffset(newOffset);
        if (newOffset >= logLines.length - maxVisibleLines) {
          setAutoScroll(true);
        }
      }
    });

    const visibleLogs = logLines.slice(scrollOffset, scrollOffset + maxVisibleLines);

    return (
      <Box flexDirection="column" padding={1} width="100%">
        {/* Header */}
        <Box borderStyle="double" borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">
            📋 MODULE DETAILS: {module.name}
          </Text>
        </Box>

        {/* Basic Info */}
        <Box
          borderStyle="round"
          borderColor="gray"
          padding={1}
          marginBottom={1}
          flexDirection="column"
        >
          <Text bold color="yellow">
            Basic Information
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Text>
              <Text bold>Name:</Text> {module.name}
            </Text>
            <Text>
              <Text bold>Type:</Text> {module.type}
            </Text>
            <Text>
              <Text bold>Status:</Text>{' '}
              <Text
                color={
                  module.status === 'RUNNING' ? 'green' : module.status === 'ERROR' ? 'red' : 'gray'
                }
              >
                {module.status}
              </Text>
            </Text>
            {module.pid && (
              <Text>
                <Text bold>PID:</Text> {module.pid}
              </Text>
            )}
            {module.uptime !== undefined && (
              <Text>
                <Text bold>Uptime:</Text> {formatUptime(module.uptime)}
              </Text>
            )}
            {module.cpu !== undefined && (
              <Text>
                <Text bold>CPU:</Text> {module.cpu.toFixed(1)}%
              </Text>
            )}
            {module.memory !== undefined && (
              <Text>
                <Text bold>Memory:</Text> {(module.memory / (1024 * 1024)).toFixed(1)} MB
              </Text>
            )}
          </Box>
        </Box>

        {/* Configuration Details */}
        {moduleConfig && (
          <Box
            borderStyle="round"
            borderColor="gray"
            padding={1}
            marginBottom={1}
            flexDirection="column"
          >
            <Text bold color="yellow">
              Configuration
            </Text>
            <Box marginTop={1} flexDirection="column">
              {moduleConfig.type === 'workspace' && (
                <>
                  <Text>
                    <Text bold>Path:</Text> {moduleConfig.path}
                  </Text>
                  <Text>
                    <Text bold>Package Manager:</Text> {moduleConfig.packageManager ?? 'auto'}
                  </Text>
                  {moduleConfig.run.dev && (
                    <Text>
                      <Text bold>Dev Command:</Text> {moduleConfig.run.dev}
                    </Text>
                  )}
                  {moduleConfig.run.start && (
                    <Text>
                      <Text bold>Start Command:</Text> {moduleConfig.run.start}
                    </Text>
                  )}
                </>
              )}
              {moduleConfig.type === 'docker' && (
                <>
                  <Text>
                    <Text bold>Compose File:</Text> {moduleConfig.composeFile}
                  </Text>
                  {moduleConfig.services && moduleConfig.services.length > 0 && (
                    <Text>
                      <Text bold>Services:</Text> {moduleConfig.services.join(', ')}
                    </Text>
                  )}
                  {moduleConfig.profiles && moduleConfig.profiles.length > 0 && (
                    <Text>
                      <Text bold>Profiles:</Text> {moduleConfig.profiles.join(', ')}
                    </Text>
                  )}
                </>
              )}
              {moduleConfig.type === 'custom' && (
                <>
                  <Text>
                    <Text bold>Command:</Text> {moduleConfig.command}
                  </Text>
                  {moduleConfig.cwd && (
                    <Text>
                      <Text bold>Working Dir:</Text> {moduleConfig.cwd}
                    </Text>
                  )}
                </>
              )}
              {moduleConfig.dependsOn && moduleConfig.dependsOn.length > 0 && (
                <Text>
                  <Text bold>Dependencies:</Text> {moduleConfig.dependsOn.join(', ')}
                </Text>
              )}
            </Box>
          </Box>
        )}

        {/* Environment Variables */}
        {moduleConfig?.env && Object.keys(moduleConfig.env).length > 0 && (
          <Box
            borderStyle="round"
            borderColor="gray"
            padding={1}
            marginBottom={1}
            flexDirection="column"
          >
            <Text bold color="yellow">
              Environment Variables
            </Text>
            <Box marginTop={1} flexDirection="column">
              {Object.entries(moduleConfig.env)
                .slice(0, 5)
                .map(([key, value]) => (
                  <Text key={key}>
                    <Text color="cyan">{key}</Text>
                    <Text>=</Text>
                    <Text dimColor>{String(value).substring(0, 50)}</Text>
                    {String(value).length > 50 && <Text dimColor>...</Text>}
                  </Text>
                ))}
              {Object.keys(moduleConfig.env).length > 5 && (
                <Text dimColor>... and {Object.keys(moduleConfig.env).length - 5} more</Text>
              )}
            </Box>
          </Box>
        )}

        {/* Docker Containers */}
        {module.containers && module.containers.length > 0 && (
          <Box
            borderStyle="round"
            borderColor="gray"
            padding={1}
            marginBottom={1}
            flexDirection="column"
          >
            <Text bold color="yellow">
              Docker Containers
            </Text>
            <Box marginTop={1} flexDirection="column">
              {module.containers.map((container) => (
                <Box key={container.name} flexDirection="column" marginBottom={1}>
                  <Text>
                    <Text bold>{container.name}</Text>{' '}
                    <Text color={container.status === 'running' ? 'green' : 'gray'}>
                      ({container.status})
                    </Text>
                    {container.health && (
                      <Text
                        color={
                          container.health === 'healthy'
                            ? 'green'
                            : container.health === 'unhealthy'
                              ? 'red'
                              : 'yellow'
                        }
                      >
                        {' '}
                        {container.health.toUpperCase()}
                      </Text>
                    )}
                  </Text>
                  {container.ports.length > 0 && (
                    <Text dimColor> Ports: {container.ports.join(', ')}</Text>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Real-time Logs */}
        <Box
          borderStyle="round"
          borderColor="gray"
          padding={1}
          marginBottom={1}
          flexDirection="column"
          width="100%"
        >
          <Text bold color="yellow">
            Real-time Logs (last {maxVisibleLines} lines)
          </Text>
          {logLines.length > maxVisibleLines && (
            <Text dimColor>
              Showing {scrollOffset + 1}-{Math.min(scrollOffset + maxVisibleLines, logLines.length)}{' '}
              of {logLines.length} lines (↑↓ to scroll)
            </Text>
          )}
          <Box marginTop={1} flexDirection="column">
            {visibleLogs.length === 0 ? (
              <Text dimColor>No logs available</Text>
            ) : (
              visibleLogs.map((line, index) => (
                <Box key={scrollOffset + index}>{colorizeLogLine(line, scrollOffset + index)}</Box>
              ))
            )}
          </Box>
        </Box>

        {/* Footer */}
        <Box borderStyle="single" borderColor="gray" padding={1}>
          <Text dimColor>Press 'b' or ESC to go back • Press 'q' to quit • ↑↓ to scroll logs • 'G' to bottom</Text>
        </Box>
      </Box>
    );
  }
);

ModuleDetailsScreen.displayName = 'ModuleDetailsScreen';
