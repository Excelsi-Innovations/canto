import { mock } from 'bun:test';
import { EventEmitter } from 'node:events';

// Mock child_process BEFORE importing the module under test
const mockChildProcess = new EventEmitter() as any;
mockChildProcess.pid = 12345;
mockChildProcess.stdout = new EventEmitter();
mockChildProcess.stderr = new EventEmitter();
mockChildProcess.unref = mock(() => {});

mock.module('child_process', () => ({
  spawn: mock(() => mockChildProcess),
}));

import { describe, it, expect, beforeEach } from 'bun:test';
import { spawnProcess } from '../../../src/processes/manager/launcher.js';
import { ProcessStatus, type SpawnOptions } from '../../../src/processes/types.js';

describe('spawnProcess', () => {
  let onUpdate: any;
  let onOutput: any;
  let getLogger: any;

  beforeEach(() => {
    onUpdate = mock(() => {});
    onOutput = mock(() => {});
    getLogger = mock(() => undefined);
    // Reset EventEmitter listeners
    mockChildProcess.removeAllListeners();
    mockChildProcess.stdout.removeAllListeners();
    mockChildProcess.stderr.removeAllListeners();
  });

  it('should spawn a process and update status to running', async () => {
    const options: SpawnOptions = {
      id: 'test-spawn',
      command: 'echo',
      args: ['hello'],
    };

    const promise = spawnProcess(options, onUpdate, onOutput, getLogger);
    
    // It should immediately update to starting then running
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
      status: ProcessStatus.STARTING 
    }));
    
    const result = await promise;
    expect(result.success).toBe(true);
    expect(result.pid).toBe(12345);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
      status: ProcessStatus.RUNNING,
      pid: 12345
    }));
  });

  it('should handle process output', async () => {
    const options: SpawnOptions = {
      id: 'test-output',
      command: 'echo',
    };

    await spawnProcess(options, onUpdate, onOutput, getLogger);
    
    mockChildProcess.stdout.emit('data', Buffer.from('hello from stdout'));
    expect(onOutput).toHaveBeenCalledWith('test-output', 'hello from stdout', 'stdout');

    mockChildProcess.stderr.emit('data', Buffer.from('hello from stderr'));
    expect(onOutput).toHaveBeenCalledWith('test-output', 'hello from stderr', 'stderr');
  });

  it('should handle process exit', async () => {
    const options: SpawnOptions = {
      id: 'test-exit',
      command: 'echo',
    };

    await spawnProcess(options, onUpdate, onOutput, getLogger);
    
    mockChildProcess.emit('exit', 0, null);
    
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
      status: ProcessStatus.STOPPED,
      exitCode: 0
    }));
  });

  it('should handle process failure', async () => {
    const options: SpawnOptions = {
      id: 'test-fail',
      command: 'nonexistent',
    };

    await spawnProcess(options, onUpdate, onOutput, getLogger);
    
    mockChildProcess.emit('exit', 1, null);
    
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ 
      status: ProcessStatus.FAILED,
      exitCode: 1
    }));
  });
});
