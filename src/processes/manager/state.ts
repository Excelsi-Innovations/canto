import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { ProcessStatus, type ProcessInfo } from '../types.js';

export class ProcessStateStore {
  private stateFile: string;

  constructor(cwd: string = process.cwd()) {
    this.stateFile = join(cwd, '.canto', 'run', 'processes.json');
  }

  /**
   * Load saved process state from disk
   */
  load(): Map<string, ProcessInfo> {
    const processes = new Map<string, ProcessInfo>();
    try {
      if (existsSync(this.stateFile)) {
        const data = readFileSync(this.stateFile, 'utf-8');
        const rawProcesses = JSON.parse(data) as ProcessInfo[];

        // Verify if processes are actually running
        rawProcesses.forEach((p) => {
          if (p.status === ProcessStatus.RUNNING && p.pid) {
            try {
              // Check if process exists (throws if not)
              process.kill(p.pid, 0);
              processes.set(p.id, p);
            } catch {
              // Process died while Canto was off
              p.status = ProcessStatus.STOPPED;
              p.error = 'Process terminated unexpectedly';
              p.stoppedAt = new Date();
              processes.set(p.id, p);
            }
          } else {
            processes.set(p.id, p);
          }
        });
      }
    } catch (_error) {
      // Graceful fail for state loading
    }
    return processes;
  }

  /**
   * Save current process state to disk
   */
  async save(processes: Map<string, ProcessInfo>): Promise<void> {
    try {
      const dir = dirname(this.stateFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data = Array.from(processes.values()).map((p) => ({
        ...p,
        // Don't serialize onStop as it's a function
        onStop: undefined,
      }));

      await writeFile(this.stateFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`ERROR: Failed to save state to ${this.stateFile}:`, error);
    }
  }
}
