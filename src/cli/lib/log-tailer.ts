import { promises as fs } from 'fs';
import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';

export type LogSubscriber = (lines: string[]) => void;

/**
 * Efficiently tails log files without blocking.
 * Only reads new content and uses file watching.
 */
export class LogTailer {
  private filePath: string | null = null;
  private lines: string[] = [];
  private lineCount: number;
  private fileWatcher: FSWatcher | null = null;
  private lastPosition: number = 0;
  private subscribers: Set<LogSubscriber> = new Set();
  private isStopped: boolean = false;
  private readyPromise: Promise<void> | null = null;

  constructor(lineCount: number = 100) {
    this.lineCount = lineCount;
  }

  /**
   * Start tailing a log file.
   */
  async start(filePath: string): Promise<void> {
    if (this.filePath === filePath && this.fileWatcher) {
      return; // Already tailing this file
    }

    // Stop previous tail
    await this.stop();

    this.isStopped = false;
    this.filePath = filePath;

    try {
      // Read last N lines efficiently
      await this.readLastLines();

      if (this.isStopped) return;

      // Watch for changes (non-blocking)
      this.watchFile();

      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      if (this.isStopped) return;

      this.lines = [
        `Error reading log file: ${error instanceof Error ? error.message : String(error)}`,
      ];
      this.notifySubscribers();
    }
  }

  /**
   * Stop tailing.
   */
  stop(): void {
    this.isStopped = true;

    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.filePath = null;
    this.lastPosition = 0;
    this.readyPromise = null;
  }

  /**
   * Get current lines.
   */
  getLines(): string[] {
    return [...this.lines];
  }

  /**
   * Subscribe to log updates.
   */
  subscribe(callback: LogSubscriber): () => void {
    this.subscribers.add(callback);

    // Immediately call with current lines
    try {
      callback(this.lines);
    } catch {
      // Ignore subscriber errors
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Read last N lines from file efficiently.
   * Only reads the end of the file, not the entire content.
   */
  private async readLastLines(): Promise<void> {
    if (!this.filePath || this.isStopped) return;

    let fd: fs.FileHandle | undefined;

    try {
      const stats = await fs.stat(this.filePath);

      if (this.isStopped) return;

      const fileSize = stats.size;

      // Read last 64KB (or entire file if smaller)
      const bufferSize = Math.min(64 * 1024, fileSize);
      const buffer = Buffer.alloc(bufferSize);

      fd = await fs.open(this.filePath, 'r');
      const readPosition = Math.max(0, fileSize - bufferSize);

      await fd.read(buffer, 0, bufferSize, readPosition);

      const text = buffer.toString('utf-8');
      const allLines = text.split('\n').filter((line) => line.trim() !== '');

      // Take last N lines
      this.lines = allLines.slice(-this.lineCount);
      this.lastPosition = fileSize;
    } catch (error) {
      this.lines = [
        `Error reading log file: ${error instanceof Error ? error.message : String(error)}`,
      ];
    } finally {
      if (fd) {
        await fd.close().catch(() => {});
      }
    }
  }

  /**
   * Watch file for changes using chokidar and read new content.
   * More reliable and cross-platform than fs.watch.
   */
  private watchFile(): void {
    if (!this.filePath) return;

    const filePathToWatch = this.filePath;

    // Create ready promise
    let resolveReady: () => void = () => {};
    this.readyPromise = new Promise((resolve) => {
      resolveReady = resolve;
    });

    try {
      this.fileWatcher = chokidar.watch(filePathToWatch, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 50, // Fast response for logs
          pollInterval: 10,
        },
      });

      this.fileWatcher.on('ready', () => {
        if (resolveReady) resolveReady();
      });

      this.fileWatcher.on('change', async () => {
        await this.readNewContent();
      });

      // Handle log rotation
      this.fileWatcher.on('unlink', () => {
        this.lines = ['Log file was removed or rotated'];
        this.notifySubscribers();
      });

      this.fileWatcher.on('add', async () => {
        // File was re-created after rotation
        await this.readLastLines();
        this.notifySubscribers();
      });

      this.fileWatcher.on('error', () => {
        // Silently fail on watcher errors
        if (resolveReady) resolveReady(); // Resolve to avoid hanging
      });
    } catch (_error) {
      // Silently fail if watching not supported
      if (resolveReady) resolveReady();
    }
  }

  /**
   * Wait for the file watcher to be ready.
   * Useful for testing.
   */
  async waitForReady(): Promise<void> {
    if (this.readyPromise) {
      await this.readyPromise;
    }
  }

  /**
   * Read only new content from file (incremental read).
   */
  private async readNewContent(): Promise<void> {
    if (!this.filePath || this.isStopped) return;

    let fd: fs.FileHandle | undefined;

    try {
      const stats = await fs.stat(this.filePath);

      // Check if stopped during async operation
      if (!this.filePath || this.isStopped) return;

      const fileSize = stats.size;

      if (fileSize < this.lastPosition) {
        // File was truncated or rotated, re-read entire tail
        await this.readLastLines();
        this.notifySubscribers();
        return;
      }

      if (fileSize === this.lastPosition) {
        return; // No new content
      }

      // Read only new bytes
      const newBytes = fileSize - this.lastPosition;
      const buffer = Buffer.alloc(newBytes);

      fd = await fs.open(this.filePath, 'r');
      await fd.read(buffer, 0, newBytes, this.lastPosition);

      const newText = buffer.toString('utf-8');
      const newLines = newText.split('\n').filter((line) => line.trim() !== '');

      // Append new lines and trim to lineCount
      this.lines = [...this.lines, ...newLines].slice(-this.lineCount);
      this.lastPosition = fileSize;

      // Notify subscribers
      this.notifySubscribers();
    } catch (_error) {
      // Silently fail on read errors
    } finally {
      if (fd) {
        await fd.close().catch(() => {});
      }
    }
  }

  /**
   * Notify all subscribers of new lines.
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.lines);
      } catch (_error) {
        // Ignore subscriber errors
      }
    });
  }
}
