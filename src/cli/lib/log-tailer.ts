import { promises as fs, watch, FSWatcher } from 'fs';

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
    this.stop();

    this.filePath = filePath;

    try {
      // Read last N lines efficiently
      await this.readLastLines();

      // Watch for changes
      this.watchFile();

      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
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
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    this.filePath = null;
    this.lastPosition = 0;
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
    if (!this.filePath) return;

    try {
      const stats = await fs.stat(this.filePath);
      const fileSize = stats.size;

      // Read last 64KB (or entire file if smaller)
      const bufferSize = Math.min(64 * 1024, fileSize);
      const buffer = Buffer.alloc(bufferSize);

      const fd = await fs.open(this.filePath, 'r');
      const readPosition = Math.max(0, fileSize - bufferSize);

      await fd.read(buffer, 0, bufferSize, readPosition);
      await fd.close();

      const text = buffer.toString('utf-8');
      const allLines = text.split('\n').filter((line) => line.trim() !== '');

      // Take last N lines
      this.lines = allLines.slice(-this.lineCount);
      this.lastPosition = fileSize;
    } catch (error) {
      this.lines = [
        `Error reading log file: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
  }

  /**
   * Watch file for changes and read new content.
   */
  private watchFile(): void {
    if (!this.filePath) return;

    try {
      this.fileWatcher = watch(this.filePath, async (eventType) => {
        if (eventType === 'change') {
          await this.readNewContent();
        }
      });
    } catch (error) {
      // Silently fail if watching not supported
    }
  }

  /**
   * Read only new content from file (incremental read).
   */
  private async readNewContent(): Promise<void> {
    if (!this.filePath) return;

    try {
      const stats = await fs.stat(this.filePath);
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

      const fd = await fs.open(this.filePath, 'r');
      await fd.read(buffer, 0, newBytes, this.lastPosition);
      await fd.close();

      const newText = buffer.toString('utf-8');
      const newLines = newText.split('\n').filter((line) => line.trim() !== '');

      // Append new lines and trim to lineCount
      this.lines = [...this.lines, ...newLines].slice(-this.lineCount);
      this.lastPosition = fileSize;

      // Notify subscribers
      this.notifySubscribers();
    } catch (error) {
      // Silently fail on read errors
    }
  }

  /**
   * Notify all subscribers of new lines.
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(this.lines);
      } catch (error) {
        // Ignore subscriber errors
      }
    });
  }
}
