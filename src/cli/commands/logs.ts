import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { loadConfig } from '../../config/parser.js';
import { icons, colors } from '../utils/display.js';
import { errorBox } from '../utils/format.js';
import { resolve } from 'path';

interface LogsOptions {
  follow?: boolean;
  lines?: string;
}

/**
 * Logs command handler
 * Views logs for a specific module
 */
export async function logsCommand(moduleName: string, options: LogsOptions): Promise<void> {
  try {
    const config = await loadConfig();
    const logsDir = config.global?.logsDir ?? './tmp';
    const logFile = resolve(logsDir, `${moduleName}.log`);

    if (!existsSync(logFile)) {
      console.log(
        errorBox(
          `${icons.error} Log file not found`,
          `No log file found for module "${moduleName}".\n\n` + `Expected location: ${logFile}`,
          ['The module may not have been started yet', 'Check if the module name is correct']
        )
      );
      process.exit(1);
    }

    const lines = parseInt(options.lines ?? '50', 10);

    if (options.follow) {
      console.log(
        colors.cyan(`\n${icons.logs} Following logs: ${colors.bold(moduleName)} (Ctrl+C to stop)\n`)
      );
      console.log(`${colors.dim('─'.repeat(80))}\n`);

      const tail = spawn('tail', ['-f', '-n', String(lines), logFile]);

      tail.stdout.on('data', (data) => {
        process.stdout.write(data.toString());
      });

      tail.stderr.on('data', (data) => {
        process.stderr.write(data.toString());
      });

      tail.on('close', (code) => {
        if (code !== 0) {
          console.log(colors.error(`\nTail process exited with code ${code}`));
        }
      });

      process.on('SIGINT', () => {
        tail.kill();
        process.exit(0);
      });
    } else {
      console.log(colors.cyan(`\n${icons.logs} Last ${lines} lines: ${colors.bold(moduleName)}\n`));
      console.log(`${colors.dim('─'.repeat(80))}\n`);

      const content = readFileSync(logFile, 'utf-8');
      const allLines = content.split('\n');
      const lastLines = allLines.slice(-lines);

      console.log(lastLines.join('\n'));
      console.log();
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log(errorBox(`${icons.error} Error`, error.message));
    } else {
      console.log(errorBox(`${icons.error} Unknown error`, String(error)));
    }
    process.exit(1);
  }
}
