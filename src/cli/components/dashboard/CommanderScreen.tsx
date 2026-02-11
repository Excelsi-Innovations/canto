import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, useStdout } from 'ink';
import type { ScreenProps } from '../../types.js';
import type { Theme } from '../../../utils/preferences.js';
import { TaskScanner, type Task } from '../../../lib/commander/scanner.js';
import { TaskRunner } from '../../../lib/commander/runner.js';
import type { ProcessManager } from '../../../processes/manager.js';

interface CommanderScreenProps extends ScreenProps {
  theme: Theme;
  processManager: ProcessManager;
}

export const CommanderScreen: React.FC<CommanderScreenProps> = React.memo(
  ({ onBack, onQuit, theme, processManager }) => {
    // State
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set());
    const [outputLines, setOutputLines] = useState<string[]>([]);
    const [scrollOffset, setScrollOffset] = useState(0);
    const [filter, setFilter] = useState('');
    const [taskListOffset, setTaskListOffset] = useState(0);

    // Get terminal height for viewport sizing
    const { stdout } = useStdout();
    const termHeight = stdout?.rows ?? 40;
    // Reserve space for header, borders, filter bar, footer — cap at 16
    const visibleTaskCount = Math.min(16, Math.max(5, termHeight - 12));

    // Use refs to persist scanner/runner across renders if needed,
    // but useMemo is sufficient for component lifecycle.
    const scanner = useMemo(() => new TaskScanner(), []);
    const runner = useMemo(() => new TaskRunner(processManager), [processManager]);

    // Load tasks
    useEffect(() => {
      const loadTasks = async () => {
        try {
          const foundTasks = await scanner.scan();
          setTasks(foundTasks);

          // Sync running state?
          // If persistent, we should check which tasks are actually running in ProcessManager
          // iterate foundTasks, check runner.getStatus
          // We'll skip auto-sync for now to save complexity, or do it on render logic.
        } catch {
          // Silently handle scan errors
        } finally {
          setLoading(false);
        }
      };
      loadTasks();
    }, [scanner, runner]); // added runner dependency

    const filteredTasks = useMemo(() => {
      return tasks.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));
    }, [tasks, filter]);

    // Reset viewport when filter changes
    useEffect(() => {
      setSelectedIndex(0);
      setTaskListOffset(0);
    }, [filter]);

    // Subscription Effect
    useEffect(() => {
      const task = filteredTasks[selectedIndex];
      if (!task) {
        setOutputLines([]);
        return;
      }

      // Load initial history
      const logs = processManager.getLogs(task.id);
      // logs is string[] of chunks.
      const fullLog = logs.join('');
      const lines = fullLog.split('\n');
      if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
      setOutputLines(lines.slice(-20));

      // Subscribe to new output
      const unsubscribe = processManager.subscribe(task.id, (chunk) => {
        const newLines = chunk.split('\n');
        // Simple append - visuals might jiggle but it works.
        setOutputLines((prev) => {
          // If last line of prev was partial?
          // Ignored for now.
          const combined = [...prev, ...newLines].filter((l) => l !== ''); // Filter empty lines from split?
          return combined.slice(-20);
        });
      });

      return () => {
        unsubscribe();
      };
    }, [selectedIndex, filteredTasks, processManager]);

    useInput(async (input, key) => {
      // Back / Escape logic
      if (key.escape || (input.toLowerCase() === 'b' && !filter)) {
        if (filter) {
          setFilter('');
          return;
        }

        // If task is running, maybe we want to kill it?
        // For now, just go back.
        onBack();
        return;
      }

      if (input === 'q' || input === 'Q') {
        onQuit();
        return;
      }

      if (key.upArrow) {
        const newIndex = Math.max(0, selectedIndex - 1);
        setSelectedIndex(newIndex);
        // Scroll viewport up if cursor goes above visible area
        if (newIndex < taskListOffset) {
          setTaskListOffset(newIndex);
        }
      }

      if (key.downArrow) {
        const newIndex = Math.min(filteredTasks.length - 1, selectedIndex + 1);
        setSelectedIndex(newIndex);
        // Scroll viewport down if cursor goes below visible area
        if (newIndex >= taskListOffset + visibleTaskCount) {
          setTaskListOffset(newIndex - visibleTaskCount + 1);
        }
      }

      const selectedTask = filteredTasks[selectedIndex];

      // Scrolling
      if (key.pageUp) {
        setScrollOffset((prev) => Math.min(Math.max(0, outputLines.length - 10), prev + 10));
      }
      if (key.pageDown) {
        setScrollOffset((prev) => Math.max(0, prev - 10));
      }

      // Kill Task
      if ((key.ctrl && input === 'c') || input === 'k' || input === 'K') {
        if (selectedTask && runningTasks.has(selectedTask.id)) {
          await runner.stop(selectedTask.id);
          setRunningTasks((prev) => {
            const n = new Set(prev);
            n.delete(selectedTask.id);
            return n;
          });
          setOutputLines((prev) => [...prev, '> Task stopped by user.']);
          return;
        }
      }

      if (key.return) {
        if (selectedTask) {
          try {
            // Start task (allow concurrent)
            setRunningTasks((prev) => new Set(prev).add(selectedTask.id));
            setOutputLines((prev) => [...prev, `> Starting task: ${selectedTask.name}...`]);

            await runner.run(selectedTask);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            setOutputLines((prev) => [...prev, `Error: ${errorMessage}`]);
            setRunningTasks((prev) => {
              const n = new Set(prev);
              n.delete(selectedTask.id);
              return n;
            });
          }
        }
      }

      // Filter typing
      if (input?.length === 1 && !key.ctrl && !key.meta && !key.return) {
        setFilter((prev) => prev + input);
      }

      if (key.backspace) {
        setFilter((prev) => prev.slice(0, -1));
      }
    });

    return (
      <Box flexDirection="column" flexGrow={1} padding={1} overflow="hidden">
        <Box borderStyle="double" borderColor={theme.colors.primary} paddingX={1} marginBottom={1}>
          <Text bold color={theme.colors.primary}>
            ⚡ COMMANDER
          </Text>
        </Box>

        {loading ? (
          <Text>Loading tasks...</Text>
        ) : (
          <Box flexDirection="row" flexGrow={1}>
            {/* LEFT PANEL: Task List */}
            <Box
              flexDirection="column"
              width="35%"
              marginRight={1}
              borderStyle="single"
              borderColor={theme.colors.border}
            >
              {filter && (
                <Box
                  paddingX={1}
                  borderStyle="single"
                  borderBottom={false}
                  borderLeft={false}
                  borderRight={false}
                >
                  <Text>
                    Filter:{' '}
                    <Text bold color={theme.colors.info}>
                      {filter}
                    </Text>
                  </Text>
                </Box>
              )}

              <Box flexDirection="column" padding={1}>
                {filteredTasks.length === 0 ? (
                  <Text dimColor>No tasks found.</Text>
                ) : (
                  <>
                    {taskListOffset > 0 && (
                      <Text dimColor>  ▲ {taskListOffset} more above</Text>
                    )}
                    {filteredTasks.slice(taskListOffset, taskListOffset + visibleTaskCount).map((task, i) => {
                      const index = taskListOffset + i;
                      const isRunning = runningTasks.has(task.id);
                      return (
                        <Box key={task.id} flexDirection="row">
                          <Text
                            color={
                              index === selectedIndex ? theme.colors.highlight : theme.colors.primary
                            }
                          >
                            {index === selectedIndex ? '> ' : '  '}
                          </Text>
                          <Text color={isRunning ? theme.colors.success : theme.colors.muted}>
                            {isRunning ? '● ' : '○ '}
                          </Text>
                          <Text color={index === selectedIndex ? theme.colors.highlight : 'white'}>
                            {task.name.slice(0, 24)}
                          </Text>
                        </Box>
                      );
                    })}
                    {taskListOffset + visibleTaskCount < filteredTasks.length && (
                      <Text dimColor>  ▼ {filteredTasks.length - taskListOffset - visibleTaskCount} more below</Text>
                    )}
                  </>
                )}
              </Box>
            </Box>

            {/* RIGHT PANEL: Output */}
            {/* Replacing theme.colors.secondary with theme.colors.border or muted since secondary might not exist */}
            {/* RIGHT PANEL: Output */}
            <Box
              flexDirection="column"
              flexGrow={1}
              borderStyle="round"
              borderColor={theme.colors.border}
              padding={1}
            >
              <Box flexDirection="row" justifyContent="space-between">
                <Text bold underline color={theme.colors.muted}>
                  Task Output
                </Text>
                {scrollOffset > 0 && (
                  <Text color={theme.colors.highlight} dimColor>
                    (Matches {outputLines.length - scrollOffset} / {outputLines.length})
                  </Text>
                )}
              </Box>
              <Box flexDirection="column" marginTop={1}>
                {outputLines.length === 0 ? (
                  <Text dimColor>Select a task and press Enter to run.</Text>
                ) : (
                  (() => {
                    const BUFFER_SIZE = 18;
                    const totalLines = outputLines.length;
                    const end = Math.max(0, totalLines - scrollOffset);
                    const start = Math.max(0, end - BUFFER_SIZE);
                    const visibleLines = outputLines.slice(start, end);

                    return visibleLines.map((line, i) => (
                      <Text key={i} color="white" wrap="truncate-end">
                        {line}
                      </Text>
                    ));
                  })()
                )}
              </Box>
            </Box>
          </Box>
        )}

        <Box marginTop={1} borderStyle="single" borderColor={theme.colors.border}>
          <Text dimColor>Enter: Run • K: Stop • Filter: Type • B/Esc: Back</Text>
        </Box>
      </Box>
    );
  }
);

CommanderScreen.displayName = 'CommanderScreen';
