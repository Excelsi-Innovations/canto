import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { ProcessStateStore } from '../../../src/processes/manager/state.js';
import { ProcessStatus, type ProcessInfo } from '../../../src/processes/types.js';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('ProcessStateStore', () => {
  let tempDir: string;
  let store: ProcessStateStore;

  beforeEach(() => {
    const projectTmp = join(process.cwd(), 'tmp');
    if (!existsSync(projectTmp)) {
      mkdirSync(projectTmp, { recursive: true });
    }
    tempDir = mkdtempSync(join(projectTmp, 'canto-state-test-'));
    store = new ProcessStateStore(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should save and load process state correctly', () => {
    const processes = new Map<string, ProcessInfo>();
    const info: ProcessInfo = {
      id: 'test-1',
      command: 'node -e "setInterval(() => {}, 1000)"',
      status: ProcessStatus.STOPPED,
      startedAt: new Date(Date.now() - 10000),
      stoppedAt: new Date(),
    };
    processes.set(info.id, info);

    store.save(processes);

    // Verify file exists
    expect(existsSync(join(tempDir, '.canto', 'run', 'processes.json'))).toBe(true);

    const loaded = store.load();
    expect(loaded.size).toBe(1);
    const loadedInfo = loaded.get('test-1');
    expect(loadedInfo).toBeDefined();
    expect(loadedInfo?.id).toBe('test-1');
    expect(loadedInfo?.status).toBe(ProcessStatus.STOPPED);
    expect(loadedInfo?.startedAt).toBeDefined();
    expect(loadedInfo?.onStop).toBeUndefined(); // Should not persist functions
  });

  it('should detect if a "running" process is actually dead on load', () => {
    const processes = new Map<string, ProcessInfo>();
    const info: ProcessInfo = {
      id: 'dead-process',
      command: 'echo "I am dead"',
      status: ProcessStatus.RUNNING,
      pid: 999999, // Highly likely to be dead
      startedAt: new Date(),
    };
    processes.set(info.id, info);

    store.save(processes);

    // Mock process.kill to throw for our fake PID
    const originalKill = process.kill;
    process.kill = (pid: number, signal: string | number) => {
      if (pid === 999999) throw new Error('ESRCH');
      return originalKill(pid, signal);
    };

    try {
      const loaded = store.load();
      const loadedInfo = loaded.get('dead-process');
      expect(loadedInfo?.status).toBe(ProcessStatus.STOPPED);
      expect(loadedInfo?.error).toContain('terminated unexpectedly');
    } finally {
      process.kill = originalKill;
    }
  });

  it('should handle empty or missing state file gracefully', () => {
    const loaded = store.load();
    expect(loaded.size).toBe(0);
  });

  it('should create directories if they do not exist on save', () => {
    const freshDir = join(tempDir, 'fresh-subdir');
    const freshStore = new ProcessStateStore(freshDir);
    const processes = new Map<string, ProcessInfo>();
    
    freshStore.save(processes);
    
    expect(existsSync(join(freshDir, '.canto', 'run'))).toBe(true);
  });
});
