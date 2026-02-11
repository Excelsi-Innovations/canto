import { spawn, type ChildProcess } from 'child_process';
import { ProcessLogger } from './logger.js';
import { ProcessStatus, type ProcessInfo, type SpawnOptions, type ProcessResult } from './types.js';

export class ProcessManager {
  private processes: Map<string, ProcessInfo> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();
  private loggers: Map<string, ProcessLogger> = new Map();

  // Log handling
  private outputs: Map<string, string[]> = new Map();
  private listeners: Map<string, Set<(data: string) => void>> = new Map();

  /**
   * Subscribe to process output
   */
  subscribe(id: string, callback: (data: string) => void): () => void {
    let listenerSet = this.listeners.get(id);
    if (!listenerSet) {
      listenerSet = new Set();
      this.listeners.set(id, listenerSet);
    }
    listenerSet.add(callback);
    return () => {
      this.listeners.get(id)?.delete(callback);
    };
  }

  getLogs(id: string): string[] {
    return this.outputs.get(id) ?? [];
  }

  /**
   * Spawn a new process
   *
   * @param options - Process spawn options
   * @returns Promise resolving to process result with success status
   */
  async spawn(options: SpawnOptions): Promise<ProcessResult> {
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
    } = options;

    if (this.processes.has(id)) {
      const existing = this.processes.get(id);
      if (existing?.status === ProcessStatus.RUNNING) {
        return {
          success: false,
          processInfo: existing,
          error: `Process ${id} is already running`,
        };
      }
    }

    const processInfo: ProcessInfo = {
      id,
      command: args.length > 0 ? `${command} ${args.join(' ')}` : command,
      cwd,
      env,
      logFile,
      status: ProcessStatus.STARTING,
      startedAt: new Date(),
    };

    this.processes.set(id, processInfo);

    if (logFile) {
      const logger = new ProcessLogger(logFile);
      this.loggers.set(id, logger);
      logger.log(`Starting process: ${processInfo.command}`, id);
    }

    try {
      const childProcess = spawn(command, args, {
        cwd: cwd ?? process.cwd(),
        env: env ? { ...process.env, ...env } : process.env,
        shell,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.childProcesses.set(id, childProcess);

      processInfo.pid = childProcess.pid;
      processInfo.status = ProcessStatus.RUNNING;
      this.processes.set(id, processInfo);

      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();

        // Store output
        let buffer = this.outputs.get(id);
        if (!buffer) {
          buffer = [];
          this.outputs.set(id, buffer);
        }
        buffer.push(text);
        if (buffer.length > 2000) buffer.shift(); // Limit history

        // Notify listeners
        this.listeners.get(id)?.forEach((cb) => cb(text));

        this.loggers.get(id)?.stdout(text, id);
        if (onData) onData(text);
      });

      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();

        // Store output (stderr)
        let buffer = this.outputs.get(id);
        if (!buffer) {
          buffer = [];
          this.outputs.set(id, buffer);
        }
        buffer.push(text);
        if (buffer.length > 2000) buffer.shift();

        // Notify listeners
        this.listeners.get(id)?.forEach((cb) => cb(text));

        this.loggers.get(id)?.stderr(text, id);
        if (onError) onError(text);
      });

      childProcess.on('exit', (code, signal) => {
        const info = this.processes.get(id);
        if (info) {
          info.status = code === 0 ? ProcessStatus.STOPPED : ProcessStatus.FAILED;
          info.exitCode = code ?? undefined;
          info.stoppedAt = new Date();
          if (code !== 0) {
            info.error = `Process exited with code ${code}`;
          }
          this.processes.set(id, info);
        }

        this.loggers
          .get(id)
          ?.log(`Process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`, id);

        this.childProcesses.delete(id);

        if (onExit) onExit(code, signal as NodeJS.Signals | null);
      });

      childProcess.on('error', (error) => {
        const info = this.processes.get(id);
        if (info) {
          info.status = ProcessStatus.FAILED;
          info.error = error.message;
          info.stoppedAt = new Date();
          this.processes.set(id, info);
        }

        this.loggers.get(id)?.log(`Process error: ${error.message}`, id);
      });

      return {
        success: true,
        processInfo,
        pid: childProcess.pid,
      };
    } catch (error) {
      processInfo.status = ProcessStatus.FAILED;
      processInfo.error = error instanceof Error ? error.message : String(error);
      processInfo.stoppedAt = new Date();
      this.processes.set(id, processInfo);

      return {
        success: false,
        processInfo,
        error: processInfo.error,
      };
    }
  }

  /**
   * Stop a running process
   * Sends SIGTERM signal, fallback to SIGKILL after 5 seconds
   *
   * @param id - Process ID to stop
   * @param signal - Signal to send (default: SIGTERM)
   * @returns Promise resolving to process result
   */
  async stop(id: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<ProcessResult> {
    const processInfo = this.processes.get(id);

    if (!processInfo) {
      return {
        success: false,
        processInfo: {
          id,
          command: '',
          status: ProcessStatus.IDLE,
        },
        error: `Process ${id} not found`,
      };
    }

    if (processInfo.status !== ProcessStatus.RUNNING) {
      return {
        success: false,
        processInfo,
        error: `Process ${id} is not running (status: ${processInfo.status})`,
      };
    }

    const childProcess = this.childProcesses.get(id);
    if (!childProcess) {
      return {
        success: false,
        processInfo,
        error: `Child process ${id} not found`,
      };
    }

    processInfo.status = ProcessStatus.STOPPING;
    this.processes.set(id, processInfo);

    this.loggers.get(id)?.log(`Stopping process with signal ${signal}`, id);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (childProcess.killed === false) {
          this.loggers.get(id)?.log('Force killing process (SIGKILL)', id);
          childProcess.kill('SIGKILL');
        }
      }, 5000);

      childProcess.once('exit', () => {
        clearTimeout(timeout);
        const updatedInfo = this.processes.get(id);
        resolve({
          success: true,
          processInfo: updatedInfo ?? processInfo,
        });
      });

      childProcess.kill(signal);
    });
  }

  /**
   * Restart a process
   * Stops the process if running, waits 1 second, then respawns
   *
   * @param id - Process ID to restart
   * @returns Promise resolving to process result
   */
  async restart(id: string): Promise<ProcessResult> {
    const processInfo = this.processes.get(id);

    if (!processInfo) {
      return {
        success: false,
        processInfo: {
          id,
          command: '',
          status: ProcessStatus.IDLE,
        },
        error: `Process ${id} not found`,
      };
    }

    this.loggers.get(id)?.log('Restarting process', id);

    if (processInfo.status === ProcessStatus.RUNNING) {
      const stopResult = await this.stop(id);
      if (!stopResult.success) {
        return stopResult;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return this.spawn({
      id,
      command: processInfo.command,
      cwd: processInfo.cwd,
      env: processInfo.env,
      logFile: processInfo.logFile,
    });
  }

  /**
   * Get process information by ID
   *
   * @param id - Process ID
   * @returns Process information, or undefined if not found
   */
  getProcess(id: string): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  /**
   * Get all managed processes
   *
   * @returns Array of all process information objects
   */
  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Get process info by ID
   */
  getStatus(id: string): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  /**
   * Check if a process is currently running
   *
   * @param id - Process ID
   * @returns True if process is running, false otherwise
   */
  isRunning(id: string): boolean {
    const process = this.processes.get(id);
    return process?.status === ProcessStatus.RUNNING;
  }

  /**
   * Stop all managed processes
   *
   * @param signal - Signal to send to all processes (default: SIGTERM)
   * @returns Promise that resolves when all processes are stopped
   */
  async stopAll(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    const runningProcesses = Array.from(this.processes.values()).filter(
      (p) => p.status === ProcessStatus.RUNNING
    );

    await Promise.all(runningProcesses.map((p) => this.stop(p.id, signal)));
  }

  /**
   * Get process PID by ID
   *
   * @param id - Process ID
   * @returns Process PID or undefined if not found/not running
   */
  getPid(id: string): number | undefined {
    const process = this.processes.get(id);
    return process?.pid;
  }

  /**
   * Cleanup all resources
   * Stops all processes and closes all log streams
   *
   * @returns Promise that resolves when cleanup is complete
   */
  async cleanup(): Promise<void> {
    await this.stopAll('SIGTERM');

    await Promise.all(Array.from(this.loggers.values()).map((logger) => logger.close()));

    this.processes.clear();
    this.childProcesses.clear();
    this.loggers.clear();
  }
}
