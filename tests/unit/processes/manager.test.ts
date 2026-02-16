import { mock } from 'bun:test';
import { ProcessStatus } from '../../../src/processes/types.js';


mock.module('../../../src/processes/manager/launcher.js', () => ({
  spawnProcess: mock(async (options, onUpdate) => {
    const info = { 
      id: options.id, 
      command: options.command, 
      status: ProcessStatus.RUNNING,
      startedAt: new Date(),
      pid: 12345
    };
    onUpdate(info);
    return {
      success: true,
      processInfo: info,
      pid: 12345,
      child: {} as any
    };
  }),
}));

mock.module('../../../src/processes/manager/killing.js', () => ({
  terminateProcess: mock(async () => ({ success: true })),
}));

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ProcessManager } from '../../../src/processes/manager.js';
import type { ProcessStateStore } from '../../../src/processes/manager/state.js';

describe('ProcessManager', () => {
  let manager: ProcessManager;

  beforeEach(() => {
    // We need to clear the singleton instance for testing
    // @ts-ignore
    ProcessManager.instance = undefined;
    const mockStore = {
      load: mock(() => new Map()),
      save: mock(() => {}),
    } as unknown as ProcessStateStore;

    manager = ProcessManager.getInstance(mockStore);

    // Mock process.kill to avoid ESRCH errors with mock PIDs
    const originalKill = process.kill;
    // @ts-ignore
    process.kill = (pid: number, signal: string | number) => {
      if (pid === 12345) return true;
      return originalKill(pid, signal);
    };
    // @ts-ignore
    manager.originalKill = originalKill; 
  });

  afterEach(() => {
    // @ts-ignore
    if (manager.originalKill) {
      // @ts-ignore
      process.kill = manager.originalKill;
    }
  });

  it('should maintain singleton pattern', () => {
    const manager2 = ProcessManager.getInstance();
    expect(manager).toBe(manager2);
  });

  it('should spawn a process and track it', async () => {
    const result = await manager.spawn({
      id: 'test-proc',
      command: 'echo',
    });

    expect(result.success).toBe(true);
    expect(manager.getProcess('test-proc')).toBeDefined();
    expect(manager.isRunning('test-proc')).toBe(true);
  });

  it('should return all processes', async () => {
    await manager.spawn({ id: 'p1', command: 'echo' });
    await manager.spawn({ id: 'p2', command: 'echo' });
    
    const all = manager.getAllProcesses();
    expect(all.length).toBe(2);
  });

  it('should stop a running process', async () => {
    await manager.spawn({ id: 'p1', command: 'echo' });
    
    const result = await manager.stop('p1');
    expect(result.success).toBe(true);
    expect(manager.isRunning('p1')).toBe(false);
  });

  it('should handle stopAll', async () => {
    await manager.spawn({ id: 'p1', command: 'echo' });
    await manager.spawn({ id: 'p2', command: 'echo' });
    
    await manager.stopAll();
    expect(manager.isRunning('p1')).toBe(false);
    expect(manager.isRunning('p2')).toBe(false);
  });
});
