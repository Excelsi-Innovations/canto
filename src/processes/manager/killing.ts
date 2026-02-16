import { exec, type ChildProcess } from 'node:child_process';
import { type ProcessInfo } from '../types.js';
import type { ProcessLogger } from '../logger.js';
import { isWindows } from '../../utils/platform.js';

/**
 * Handles cross-platform process termination logic
 */
export async function terminateProcess(
  id: string,
  processInfo: ProcessInfo,
  childProcess: ChildProcess | undefined,
  signal: NodeJS.Signals = 'SIGTERM',
  logger?: ProcessLogger
): Promise<{ success: boolean; error?: string }> {
  // Handle detached processes (restored or otherwise)
  if (processInfo.detached && processInfo.pid && !childProcess) {
    try {
      process.kill(processInfo.pid, 0); // Check if alive
      process.kill(processInfo.pid, signal);
      return { success: true };
    } catch (_e) {
      return { success: true }; // Already dead, so termination is "done"
    }
  }

  if (!childProcess) {
    return { success: false, error: 'Child process handle not found' };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (childProcess.killed === false) {
        logger?.log('Force killing process (SIGKILL)', id);
        childProcess.kill('SIGKILL');
      }
    }, 5000);

    childProcess.once('exit', async () => {
      clearTimeout(timeout);

      // Run cleanup hook if present
      if (processInfo.onStop) {
        try {
          await processInfo.onStop();
        } catch (err) {
          logger?.log(`Process cleanup failed: ${err}`, id);
        }
      }

      resolve({ success: true });
    });

    // Platform-specific tree killing
    if (isWindows() && processInfo.pid) {
      exec(`taskkill /pid ${processInfo.pid} /T /F`, (error) => {
        if (error) {
          logger?.log(`Taskkill failed: ${error.message}`, id);
          childProcess.kill(signal);
        }
      });
    } else {
      childProcess.kill(signal);
    }
  });
}
