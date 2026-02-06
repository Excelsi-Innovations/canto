type ShutdownHandler = () => void | Promise<void>;

const SHUTDOWN_SIGNALS: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

/**
 * Manages graceful shutdown handlers for process termination signals
 * Supports SIGINT, SIGTERM, and Windows-specific signals (CTRL+C)
 */
export class SignalHandler {
  private handlers: ShutdownHandler[] = [];
  private registered = false;

  /**
   * Register a handler to be called on process shutdown
   * Signal listeners are registered automatically on first handler
   *
   * @param handler - Function to execute during shutdown (sync or async)
   */
  onShutdown(handler: ShutdownHandler): void {
    this.handlers.push(handler);

    if (!this.registered) {
      this.registerSignalListeners();
      this.registered = true;
    }
  }

  private registerSignalListeners(): void {
    for (const signal of SHUTDOWN_SIGNALS) {
      process.on(signal, async () => {
        console.log(`\n📴 Received ${signal}, shutting down gracefully...`);
        await this.executeHandlers();
        process.exit(0);
      });
    }

    // Windows doesn't properly emit SIGINT, requires readline workaround
    if (process.platform === 'win32') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.on('SIGINT', async () => {
        console.log('\n📴 Received SIGINT (Ctrl+C), shutting down gracefully...');
        await this.executeHandlers();
        process.exit(0);
      });
    }

    process.on('uncaughtException', async (error) => {
      console.error('💥 Uncaught Exception:', error);
      await this.executeHandlers();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason) => {
      console.error('💥 Unhandled Rejection:', reason);
      await this.executeHandlers();
      process.exit(1);
    });
  }

  private async executeHandlers(): Promise<void> {
    const promises = this.handlers.map((handler) => {
      try {
        return handler();
      } catch (error) {
        console.error('Error in shutdown handler:', error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all registered handlers
   * Useful for testing
   */
  clear(): void {
    this.handlers = [];
  }
}

export const globalSignalHandler = new SignalHandler();

/**
 * Register a handler to be called on process shutdown
 * Uses the global SignalHandler instance
 *
 * @param handler - Function to execute during shutdown (sync or async)
 */
export function onShutdown(handler: ShutdownHandler): void {
  globalSignalHandler.onShutdown(handler);
}
