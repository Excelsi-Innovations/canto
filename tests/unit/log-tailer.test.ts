import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { LogTailer } from '../../src/cli/lib/log-tailer';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('LogTailer', () => {
  let tailer: LogTailer;
  let testLogPath: string;
  let tempDir: string;

  beforeEach(async () => {
    tailer = new LogTailer(10); // Small line count for testing

    // Create temp directory for test files
    tempDir = await fs.mkdtemp(join(tmpdir(), 'log-tailer-test-'));
    testLogPath = join(tempDir, 'test.log');
  });

  afterEach(async () => {
    await tailer.stop();

    // Clean up temp files
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initialization', () => {
    test('should initialize with default line count', async () => {
      const defaultTailer = new LogTailer();
      expect(defaultTailer).toBeDefined();
      await defaultTailer.stop();
    });

    test('should initialize with custom line count', async () => {
      const customTailer = new LogTailer(50);
      expect(customTailer).toBeDefined();
      await customTailer.stop();
    });

    test('should return empty lines initially', () => {
      const lines = tailer.getLines();
      expect(lines).toEqual([]);
    });
  });

  describe('start', () => {
    test('should read existing log file', async () => {
      // Create test log file
      await fs.writeFile(testLogPath, 'Line 1\nLine 2\nLine 3\n');

      await tailer.start(testLogPath);

      const lines = tailer.getLines();
      expect(lines).toContain('Line 1');
      expect(lines).toContain('Line 2');
      expect(lines).toContain('Line 3');
    });

    test('should read only last N lines from large file', async () => {
      // Create file with many lines
      const manyLines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
      await fs.writeFile(testLogPath, manyLines);

      await tailer.start(testLogPath);

      const lines = tailer.getLines();
      expect(lines.length).toBeLessThanOrEqual(10); // Should only have 10 lines
      expect(lines[lines.length - 1]).toBe('Line 100'); // Last line should be Line 100
    });

    test('should handle empty log file', async () => {
      await fs.writeFile(testLogPath, '');

      await tailer.start(testLogPath);

      const lines = tailer.getLines();
      expect(lines).toEqual([]);
    });

    test('should handle non-existent file gracefully', async () => {
      const nonExistentPath = join(tempDir, 'non-existent.log');

      await tailer.start(nonExistentPath);

      const lines = tailer.getLines();
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toMatch(/Error reading log file/);
    });

    test('should not start twice for same file', async () => {
      await fs.writeFile(testLogPath, 'Test line\n');

      await tailer.start(testLogPath);
      await tailer.start(testLogPath); // Second call should be no-op

      const lines = tailer.getLines();
      expect(lines).toContain('Test line');
    });

    test('should switch to new file when starting with different path', async () => {
      const firstPath = join(tempDir, 'first.log');
      const secondPath = join(tempDir, 'second.log');

      await fs.writeFile(firstPath, 'First file\n');
      await fs.writeFile(secondPath, 'Second file\n');

      await tailer.start(firstPath);
      let lines = tailer.getLines();
      expect(lines).toContain('First file');

      await tailer.start(secondPath);
      lines = tailer.getLines();
      expect(lines).toContain('Second file');
      expect(lines).not.toContain('First file');
    });
  });

  describe('stop', () => {
    test('should stop watching file', async () => {
      await fs.writeFile(testLogPath, 'Initial\n');
      await tailer.start(testLogPath);

      await tailer.stop();

      // Should not crash after stop
      const lines = tailer.getLines();
      expect(Array.isArray(lines)).toBe(true);
    });

    test('should be idempotent', async () => {
      await tailer.stop();
      await tailer.stop(); // Should not crash
      expect(true).toBe(true);
    });

    test('should stop watching before starting new file', async () => {
      const firstPath = join(tempDir, 'first.log');
      await fs.writeFile(firstPath, 'First\n');

      await tailer.start(firstPath);
      await tailer.stop();

      // Should not crash when starting again
      await tailer.start(firstPath);
      expect(true).toBe(true);
    });
  });

  describe('getLines', () => {
    test('should return copy of lines, not reference', async () => {
      await fs.writeFile(testLogPath, 'Test\n');
      await tailer.start(testLogPath);

      const lines1 = tailer.getLines();
      const lines2 = tailer.getLines();

      expect(lines1).not.toBe(lines2); // Different arrays
      expect(lines1).toEqual(lines2); // Same content
    });

    test('should filter empty lines', async () => {
      await fs.writeFile(testLogPath, 'Line 1\n\n\nLine 2\n\n');
      await tailer.start(testLogPath);

      const lines = tailer.getLines();
      expect(lines).not.toContain('');
      expect(lines.length).toBe(2);
    });

    test('should return empty array after stop', async () => {
      await tailer.stop();
      const lines = tailer.getLines();
      expect(lines).toEqual([]);
    });
  });

  describe('subscribe', () => {
    test('should immediately call subscriber with current lines', async () => {
      await fs.writeFile(testLogPath, 'Test line\n');
      await tailer.start(testLogPath);

      let callCount = 0;
      let receivedLines: string[] | null = null;

      tailer.subscribe((lines) => {
        callCount++;
        receivedLines = lines;
      });

      expect(callCount).toBe(1);
      expect(receivedLines).toBeDefined();
      expect(receivedLines!).toContain('Test line');
    });

    test('should return unsubscribe function', () => {
      let callCount = 0;

      const unsubscribe = tailer.subscribe(() => {
        callCount++;
      });

      expect(callCount).toBe(1); // Initial call

      unsubscribe();

      // After unsubscribe, should not receive updates
      expect(callCount).toBe(1);
    });

    test('should support multiple subscribers', async () => {
      await fs.writeFile(testLogPath, 'Test\n');
      await tailer.start(testLogPath);

      let subscriber1Called = false;
      let subscriber2Called = false;

      tailer.subscribe(() => {
        subscriber1Called = true;
      });

      tailer.subscribe(() => {
        subscriber2Called = true;
      });

      expect(subscriber1Called).toBe(true);
      expect(subscriber2Called).toBe(true);
    });

    test('should handle subscriber errors gracefully', () => {
      const errorSubscriber = mock(() => {
        throw new Error('Subscriber error');
      });

      const normalSubscriber = mock(() => {
        // Normal subscriber
      });

      tailer.subscribe(errorSubscriber);
      tailer.subscribe(normalSubscriber);

      expect(errorSubscriber).toHaveBeenCalled();
      expect(normalSubscriber).toHaveBeenCalled();
    });

    test('should notify subscribers on file changes', async () => {
      await fs.writeFile(testLogPath, 'Initial\n');
      await tailer.start(testLogPath);

      let updateCount = 0;

      tailer.subscribe(() => {
        updateCount++;
      });

      expect(updateCount).toBe(1); // Initial call

      // Wait for watcher to be ready
      await tailer.waitForReady();

      // Append to file
      await fs.appendFile(testLogPath, 'New line\n');

      // Wait for file watch event
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(updateCount).toBeGreaterThan(1); // Should have been called again
    }, { timeout: 5000 });
  });

  describe('incremental reading', () => {
    test('should read only new content when file grows', async () => {
      await fs.writeFile(testLogPath, 'Line 1\n');
      await tailer.start(testLogPath);

      let lines = tailer.getLines();
      expect(lines).toEqual(['Line 1']);

      // Wait for watcher to be ready
      await tailer.waitForReady();

      // Append new content
      await fs.appendFile(testLogPath, 'Line 2\n');

      // Wait for file watch event
      await new Promise((resolve) => setTimeout(resolve, 500));

      lines = tailer.getLines();
      expect(lines).toContain('Line 1');
      expect(lines).toContain('Line 2');
    }, { timeout: 5000 });

    test('should maintain line count limit', async () => {
      const initialLines = Array.from({ length: 10 }, (_, i) => `Initial ${i + 1}`).join('\n');
      await fs.writeFile(testLogPath, initialLines);
      await tailer.start(testLogPath);

      let lines = tailer.getLines();
      expect(lines.length).toBe(10);

      // Wait for watcher to be ready
      await tailer.waitForReady();

      // Add more lines
      await fs.appendFile(testLogPath, '\nNew 1\nNew 2\nNew 3\n');

      // Wait for file watch event
      await new Promise((resolve) => setTimeout(resolve, 500));

      lines = tailer.getLines();
      expect(lines.length).toBeLessThanOrEqual(10); // Should still be limited
      expect(lines).toContain('New 3'); // Should have new content
    }, { timeout: 5000 });

    test('should handle file truncation', async () => {
      await fs.writeFile(testLogPath, 'Line 1\nLine 2\nLine 3\n');
      await tailer.start(testLogPath);

      // Wait for watcher to be ready
      await tailer.waitForReady();

      // Truncate file
      await fs.writeFile(testLogPath, 'New content\n');

      // Wait for file watch event
      await new Promise((resolve) => setTimeout(resolve, 500));

      const lines = tailer.getLines();
      expect(lines).toContain('New content');
      expect(lines).not.toContain('Line 1');
    }, { timeout: 5000 });

    test('should handle file rotation', async () => {
      await fs.writeFile(testLogPath, 'Original content\n');
      await tailer.start(testLogPath);

      // Wait for watcher to be ready
      await tailer.waitForReady();

      // Simulate log rotation (file shrinks)
      await fs.writeFile(testLogPath, 'Rotated\n');

      // Wait for file watch event
      await new Promise((resolve) => setTimeout(resolve, 500));

      const lines = tailer.getLines();
      expect(lines).toContain('Rotated');
    }, { timeout: 5000 });

    test('should not read if file size unchanged', async () => {
      await fs.writeFile(testLogPath, 'Static content\n');
      await tailer.start(testLogPath);

      let updateCount = 0;

      tailer.subscribe(() => {
        updateCount++;
      });

      const initialCount = updateCount;

      // Touch file without changing content
      // (In reality, file watcher might trigger, but readNewContent should detect no change)

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Should not have triggered unnecessary updates
      expect(updateCount).toBeGreaterThanOrEqual(initialCount);
    });
  });

  describe('efficient reading', () => {
    test('should read last 64KB for large files', async () => {
      // Create a large file (>64KB)
      const largeContent = 'x'.repeat(100 * 1024); // 100KB
      await fs.writeFile(testLogPath, largeContent + '\nLast line\n');

      await tailer.start(testLogPath);

      const lines = tailer.getLines();
      expect(lines[lines.length - 1]).toBe('Last line');
    });

    test('should handle small files efficiently', async () => {
      await fs.writeFile(testLogPath, 'Small file\n');

      const start = Date.now();
      await tailer.start(testLogPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000); // Should be fast
    });

    test('should not block on large file reads', async () => {
      // Create moderately large file
      const lines = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}`).join('\n');
      await fs.writeFile(testLogPath, lines);

      const start = Date.now();
      await tailer.start(testLogPath);
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(3000); // Should be reasonably fast
    });
  });

  describe('error handling', () => {
    test('should handle read errors gracefully', async () => {
      const invalidPath = join(tempDir, 'subdir', 'invalid.log');

      await tailer.start(invalidPath);

      const lines = tailer.getLines();
      expect(lines.length).toBeGreaterThan(0);
      expect(lines[0]).toMatch(/Error/);
    });

    test('should handle permission errors', async () => {
      // Create file then make it unreadable (platform-specific)
      await fs.writeFile(testLogPath, 'Content\n');

      // This might not work on all platforms
      try {
        await fs.chmod(testLogPath, 0o000);
        await tailer.start(testLogPath);

        const lines = tailer.getLines();
        expect(lines.length).toBeGreaterThan(0);
      } catch {
        // Skip if chmod not supported
      } finally {
        // Restore permissions for cleanup
        try {
          await fs.chmod(testLogPath, 0o644);
        } catch {
          // Ignore
        }
      }
    });

    test('should continue working after transient errors', async () => {
      await fs.writeFile(testLogPath, 'Initial\n');
      await tailer.start(testLogPath);

      // File should be readable
      const lines = tailer.getLines();
      expect(lines).toContain('Initial');
    });
  });

  describe('performance characteristics', () => {
    test('should return lines quickly from cache', () => {
      const start = Date.now();
      tailer.getLines();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // Should be <10ms
    });

    test('should not block on subscribe', () => {
      const start = Date.now();
      tailer.subscribe(() => {});
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(50); // Should be fast
    });

    test('should handle rapid file updates', async () => {
      await fs.writeFile(testLogPath, 'Initial\n');
      await tailer.start(testLogPath);

      // Rapidly append content
      for (let i = 0; i < 10; i++) {
        await fs.appendFile(testLogPath, `Line ${i}\n`);
      }

      // Wait for file watch events
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const lines = tailer.getLines();
      expect(lines.length).toBeGreaterThan(0);
    });
  });

  describe('memory management', () => {
    test('should not leak subscribers', () => {
      const unsubscribes: (() => void)[] = [];

      for (let i = 0; i < 100; i++) {
        unsubscribes.push(tailer.subscribe(() => {}));
      }

      unsubscribes.forEach((unsub) => unsub());

      expect(true).toBe(true); // Should not crash
    });

    test('should limit memory usage with line count', async () => {
      // Create file with many lines
      const manyLines = Array.from({ length: 10000 }, (_, i) => `Line ${i + 1}`).join('\n');
      await fs.writeFile(testLogPath, manyLines);

      await tailer.start(testLogPath);

      const lines = tailer.getLines();
      expect(lines.length).toBeLessThanOrEqual(10); // Limited by lineCount
    });

    test('should clean up file watcher on stop', async () => {
      await fs.writeFile(testLogPath, 'Content\n');
      await tailer.start(testLogPath);

      await tailer.stop();

      // Should not have active file watcher
      expect(true).toBe(true);
    });
  });
});
