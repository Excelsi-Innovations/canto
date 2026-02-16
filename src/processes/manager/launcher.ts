import { spawn, type ChildProcess } from 'node:child_process';
import { ProcessStatus, type ProcessInfo, type SpawnOptions } from '../types.js';
import type { ProcessLogger } from '../logger.js';

/**
 * Handles complex spawning logic for processes
 */
export async function spawnProcess(
  options: SpawnOptions,
  onUpdate: (info: ProcessInfo) => void,
  onOutput: (id: string, text: string, type: 'stdout' | 'stderr') => void,
  getLogger: (id: string) => ProcessLogger | undefined
): Promise<{
  success: boolean;
  processInfo: ProcessInfo;
  pid?: number;
  error?: string;
  child?: ChildProcess;
}> {
  const {
    id,
    command,
    args = [],
    cwd,
    env,
    logFile,
    shell = true,
    onExit,
    onData,
    onError,
    onStop,
  } = options;

  const processInfo: ProcessInfo = {
    id,
    command: args.length > 0 ? `${command} ${args.join(' ')}` : command,
    cwd,
    env,
    logFile,
    status: ProcessStatus.STARTING,
    startedAt: new Date(),
    onStop,
  };

  onUpdate({ ...processInfo });

  try {
    const child = spawn(command, args, {
      cwd: cwd ?? process.cwd(),
      env: env ? { ...process.env, ...env } : process.env,
      shell,
      stdio: options.detached ? 'ignore' : ['ignore', 'pipe', 'pipe'],
      detached: options.detached,
    });

    if (options.detached) {
      child.unref();
      processInfo.detached = true;
    }

    processInfo.pid = child.pid;
    processInfo.status = ProcessStatus.RUNNING;
    onUpdate({ ...processInfo });

    if (!options.detached) {
      child.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        onOutput(id, text, 'stdout');
        if (onData) onData(text);
      });

      child.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        onOutput(id, text, 'stderr');
        if (onError) onError(text);
      });

      child.on('exit', (code, signal) => {
        processInfo.status = code === 0 ? ProcessStatus.STOPPED : ProcessStatus.FAILED;
        processInfo.exitCode = code ?? undefined;
        processInfo.stoppedAt = new Date();
        if (code !== 0) {
          processInfo.error = `Process exited with code ${code}`;
        }
        onUpdate({ ...processInfo });

        getLogger(id)?.log(
          `Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`,
          id
        );

        if (onExit) onExit(code, signal as NodeJS.Signals | null);
      });

      child.on('error', (error) => {
        processInfo.status = ProcessStatus.FAILED;
        processInfo.error = error.message;
        processInfo.stoppedAt = new Date();
        onUpdate({ ...processInfo });
        getLogger(id)?.log(`Process error: ${error.message}`, id);
      });
    }

    return {
      success: true,
      processInfo,
      pid: child.pid,
      child: options.detached ? undefined : child,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    processInfo.status = ProcessStatus.FAILED;
    processInfo.error = msg;
    processInfo.stoppedAt = new Date();
    onUpdate({ ...processInfo });

    return {
      success: false,
      processInfo,
      error: msg,
    };
  }
}
