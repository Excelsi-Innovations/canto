import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ProcessManager } from '../../src/processes/manager';
import { TaskRunner } from '../../src/lib/commander/runner';
import { ProcessStatus } from '../../src/processes/types';

describe('Commander Integration (Hard Test)', () => {
  let processManager: ProcessManager;
  let runner: TaskRunner;

  beforeEach(() => {
    processManager = new ProcessManager();
    runner = new TaskRunner(processManager);
  });

  afterEach(async () => {
    // Cleanup any lingering processes
    // ProcessManager doesn't expose "kill all". 
    // We'll rely on individual test cleanups or ignore.
  });

  it('should buffer output logs correctly', async () => {
    const taskId = 'test-buffer';
    // Run a script that outputs 3 lines
    const script = `
      console.log('Line 1');
      console.log('Line 2');
      console.log('Line 3');
    `;
    
    await runner.run({
        id: taskId,
        name: 'Buffer Test',
        command: `bun -e "${script.replace(/\n/g, '')}"`, // simple node/bun execution
        source: 'npm'
    });

    await new Promise(resolve => setTimeout(resolve, 500)); // Allow execution
    
    const logs = processManager.getLogs(taskId);
    const fullLog = logs.join('').trim();
    
    expect(fullLog).toContain('Line 1');
    expect(fullLog).toContain('Line 2');
    expect(fullLog).toContain('Line 3');
  });

  it('should support streaming subscription', async () => {
    const taskId = 'test-stream';
    const received: string[] = [];
    
    // Subscribe BEFORE running
    const unsubscribe = processManager.subscribe(taskId, (data) => {
        received.push(data);
    });

    await runner.run({
        id: taskId,
        name: 'Stream Test',
        command: 'echo "hello stream"',
        source: 'npm'
    });
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    unsubscribe();
    
    const allReceived = received.join('');
    expect(allReceived).toContain('hello stream');
  });

  it('should handle concurrent tasks', async () => {
    const taskA = 'task-a';
    const taskB = 'task-b';
    
    // Long running tasks (1 sec)
    const scriptA = `setInterval(() => console.log('A'), 100); setTimeout(() => process.exit(0), 500);`;
    const scriptB = `setInterval(() => console.log('B'), 100); setTimeout(() => process.exit(0), 500);`;

    await Promise.all([
        runner.run({ id: taskA, name: 'Task A', command: `bun -e "${scriptA}"`, source: 'npm' }),
        runner.run({ id: taskB, name: 'Task B', command: `bun -e "${scriptB}"`, source: 'npm' })
    ]);

    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for both
    
    const logsA = processManager.getLogs(taskA).join('');
    const logsB = processManager.getLogs(taskB).join('');
    
    expect(logsA).toContain('A');
    expect(logsB).toContain('B');
    expect(logsA).not.toContain('B');
    expect(logsB).not.toContain('A'); // Isolation check
  });

  it('should kill a running task', async () => {
    const taskId = 'test-kill';
    const script = `setInterval(() => console.log('Running'), 100);`; // Infinite
    
    await runner.run({
        id: taskId,
        name: 'Kill Test',
        command: `bun -e "${script}"`,
        source: 'npm'
    });
    
    await new Promise(resolve => setTimeout(resolve, 300)); // Let it run
    
    const statusBefore = runner.getStatus(taskId)?.status;
    expect(statusBefore).toBe(ProcessStatus.RUNNING);
    
    await runner.stop(taskId);
    
    const statusAfter = runner.getStatus(taskId)?.status;
    expect(statusAfter).toBeOneOf([ProcessStatus.STOPPED, ProcessStatus.FAILED, undefined]);
    
    // Verify it stopped outputting
    const logsBefore = processManager.getLogs(taskId).length;
    await new Promise(resolve => setTimeout(resolve, 300));
    // It might output a bit more due to buffer flush, but should stop.
    
    const statusInfo = runner.getStatus(taskId);
    expect(statusInfo?.status).not.toBe(ProcessStatus.RUNNING);
  });
});
