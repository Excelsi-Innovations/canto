import { existsSync, mkdirSync, createWriteStream, type WriteStream } from 'fs';
import { dirname } from 'path';

export class ProcessLogger {
  private writeStream?: WriteStream;
  private logFile?: string;

  constructor(logFile?: string) {
    this.logFile = logFile;
    if (logFile) {
      this.initializeLogFile(logFile);
    }
  }

  private initializeLogFile(logFile: string): void {
    try {
      const dir = dirname(logFile);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      this.writeStream = createWriteStream(logFile, {
        flags: 'a',
        encoding: 'utf8',
      });

      this.writeStream.on('error', (error) => {
        console.error(`Failed to write to log file ${logFile}:`, error);
      });
    } catch (error) {
      console.error(`Failed to initialize log file ${logFile}:`, error);
    }
  }

  /**
   * Write log message with timestamp
   *
   * @param message - Message to log
   * @param prefix - Optional prefix (e.g., module name)
   */
  log(message: string, prefix?: string): void {
    const timestamp = new Date().toISOString();
    const prefixStr = prefix ? `[${prefix}]` : '';
    const logLine = `[${timestamp}]${prefixStr} ${message}\n`;

    if (this.writeStream && !this.writeStream.destroyed) {
      this.writeStream.write(logLine);
    }
  }

  /**
   * Write stdout data
   *
   * @param data - Stdout data to write
   * @param prefix - Optional prefix (e.g., module name)
   */
  stdout(data: string, prefix?: string): void {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line) => this.log(line, prefix));
  }

  /**
   * Write stderr data
   *
   * @param data - Stderr data to write
   * @param prefix - Optional prefix (e.g., module name)
   */
  stderr(data: string, prefix?: string): void {
    const lines = data.toString().split('\n').filter(Boolean);
    lines.forEach((line) => this.log(`[ERROR] ${line}`, prefix));
  }

  /**
   * Close the log stream
   *
   * @returns Promise that resolves when stream is closed
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.writeStream && !this.writeStream.destroyed) {
        this.writeStream.end(() => resolve());
      } else {
        resolve();
      }
    });
  }

  /**
   * Get the log file path
   *
   * @returns Log file path, or undefined if not configured
   */
  getLogFile(): string | undefined {
    return this.logFile;
  }
}
