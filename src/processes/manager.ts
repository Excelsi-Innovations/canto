import { type ChildProcess } from 'child_process';
import { ProcessLogger } from './logger.js';
import { ProcessStatus, type ProcessInfo, type SpawnOptions, type ProcessResult } from './types.js';
import { ProcessStateStore } from './manager/state.js';
import { terminateProcess } from './manager/killing.js';
import { spawnProcess } from './manager/launcher.js';

export class ProcessManager {
  private processes: Map<string, ProcessInfo> = new Map();
  private childProcesses: Map<string, ChildProcess> = new Map();
  private loggers: Map<string, ProcessLogger> = new Map();
  private stateStore: ProcessStateStore;

  // Log handling
  private outputs: Map<string, string[]> = new Map();
  private listeners: Map<string, Set<(data: string) => void>> = new Map();

  private static instance: ProcessManager;

  private constructor(stateStore?: ProcessStateStore) {
    this.stateStore = stateStore ?? new ProcessStateStore();
    this.processes = this.stateStore.load();
  }

  public static getInstance(stateStore?: ProcessStateStore): ProcessManager {
    if (!ProcessManager.instance) {
      ProcessManager.instance = new ProcessManager(stateStore);
    }
    return ProcessManager.instance;
  }

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
   */
  async spawn(options: SpawnOptions): Promise<ProcessResult> {
    const { id } = options;

    if (this.processes.has(id)) {
      const existing = this.processes.get(id);
      if (existing?.status === ProcessStatus.RUNNING) {
        return { success: false, processInfo: existing, error: `Process ${id} is already running` };
      }
    }

    if (options.logFile && !this.loggers.has(id)) {
      this.loggers.set(id, new ProcessLogger(options.logFile));
    }

    const result = await spawnProcess(
      options,
      async (info) => {
        this.processes.set(id, info);
        // We don't await this to keep UI responsive during high-frequency updates
        // But we catch errors to avoid unhandled rejections
        this.stateStore
          .save(this.processes)
          .catch((err) => console.error('Failed to save state during update:', err));
      },
      (id, text, type) => {
        this.handleOutput(id, text, type);
      },
      (id) => this.loggers.get(id)
    );

    if (result.success && result.child) {
      this.childProcesses.set(id, result.child);
    }

    return { success: result.success, processInfo: result.processInfo, error: result.error };
  }

  private handleOutput(id: string, text: string, type: 'stdout' | 'stderr') {
    let buffer = this.outputs.get(id);
    if (!buffer) {
      buffer = [];
      this.outputs.set(id, buffer);
    }
    buffer.push(text);
    if (buffer.length > 2000) buffer.shift();

    this.listeners.get(id)?.forEach((cb) => cb(text));
    const logger = this.loggers.get(id);
    if (type === 'stdout') logger?.stdout(text, id);
    else logger?.stderr(text, id);
  }

  /**
   * Stop a running process
   */
  async stop(id: string, signal: NodeJS.Signals = 'SIGTERM'): Promise<ProcessResult> {
    const processInfo = this.processes.get(id);
    if (processInfo?.status !== ProcessStatus.RUNNING) {
      return {
        success: false,
        processInfo:
          processInfo ?? ({ id, command: '', status: ProcessStatus.IDLE } as ProcessInfo),
        error: !processInfo ? `Process ${id} not found` : `Process ${id} is not running`,
      };
    }

    const child = this.childProcesses.get(id);
    const result = await terminateProcess(id, processInfo, child, signal, this.loggers.get(id));

    if (result.success) {
      processInfo.status = ProcessStatus.STOPPED;
      processInfo.stoppedAt = new Date();
      this.processes.set(id, processInfo);
      this.childProcesses.delete(id);
      await this.stateStore.save(this.processes);
    }

    return { success: result.success, processInfo, error: result.error };
  }

  /**
   * Restart a process
   */
  async restart(id: string): Promise<ProcessResult> {
    const processInfo = this.processes.get(id);
    if (!processInfo) {
      return {
        success: false,
        processInfo: { id, command: '', status: ProcessStatus.IDLE },
        error: `Process ${id} not found`,
      };
    }

    if (processInfo.status === ProcessStatus.RUNNING) {
      await this.stop(id);
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

  getProcess(id: string): ProcessInfo | undefined {
    return this.processes.get(id);
  }

  /**
   * Get process info (alias for getProcess)
   */
  getStatus(id: string): ProcessInfo | undefined {
    return this.getProcess(id);
  }

  /**
   * Get process PID
   */
  getPid(id: string): number | undefined {
    return this.processes.get(id)?.pid;
  }

  getAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values());
  }

  isRunning(id: string): boolean {
    const proc = this.processes.get(id);
    if (proc?.status !== ProcessStatus.RUNNING) return false;

    if (proc.pid) {
      try {
        process.kill(proc.pid, 0);
        return true;
      } catch {
        proc.status = ProcessStatus.STOPPED;
        this.stateStore.save(this.processes);
        return false;
      }
    }
    return false;
  }

  async stopAll(signal: NodeJS.Signals = 'SIGTERM'): Promise<void> {
    const running = Array.from(this.processes.values()).filter(
      (p) => p.status === ProcessStatus.RUNNING
    );
    await Promise.all(running.map((p) => this.stop(p.id, signal)));
  }

  async cleanup(): Promise<void> {
    await this.stopAll('SIGTERM');
    await Promise.all(Array.from(this.loggers.values()).map((l) => l.close()));
    this.processes.clear();
    this.childProcesses.clear();
    this.loggers.clear();
  }
}
