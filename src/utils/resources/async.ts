/**
 * Async wrappers for system calls
 * Replaces blocking execSync with non-blocking exec
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Execute a shell command asynchronously
 * Returns stdout, or empty string on error
 */
export async function execCommand(
  command: string,
  options?: { timeout?: number }
): Promise<string> {
  try {
    const { stdout } = await execAsync(command, {
      timeout: options?.timeout ?? 5000,
      encoding: 'utf8',
    });
    return stdout.trim();
  } catch (error) {
    // Silent fail - return empty string for graceful degradation
    return '';
  }
}

/**
 * Execute multiple commands in parallel
 */
export async function execCommands(
  commands: string[],
  options?: { timeout?: number }
): Promise<string[]> {
  return Promise.all(commands.map((cmd) => execCommand(cmd, options)));
}

/**
 * Execute a PowerShell command (Windows-specific)
 */
export async function execPowerShell(
  command: string,
  options?: { timeout?: number }
): Promise<string> {
  const psCommand = `powershell -Command "${command.replace(/"/g, '\\"')}"`;
  return execCommand(psCommand, options);
}

/**
 * Parse numeric output from command, returns 0 on error
 */
export function parseNumeric(output: string): number {
  const num = parseFloat(output);
  return isNaN(num) ? 0 : num;
}

/**
 * Read file asynchronously with fallback
 */
export async function readFileAsync(path: string): Promise<string> {
  try {
    const fs = await import('fs/promises');
    return await fs.readFile(path, 'utf8');
  } catch {
    return '';
  }
}
