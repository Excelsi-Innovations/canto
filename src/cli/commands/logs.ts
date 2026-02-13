import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import { loadConfig } from '../../config/parser.js';
import { icons, colors } from '../utils/display.js';
import { errorBox } from '../utils/format.js';
import { resolve } from 'path';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { DockerExecutor } from '../../modules/docker.js';
import { getContainerLogsCommand } from '../../utils/docker.js';

interface LogsOptions {
  follow?: boolean;
  lines?: string;
}

/**
 * Logs command handler
 * Views logs for a specific module or container
 * Supports syntax: "module" or "module:container"
 */
export async function logsCommand(target: string, options: LogsOptions): Promise<void> {
  try {
    const config = await loadConfig();

    // Check if target is in "module:container" format
    const [moduleName, containerName] = target.includes(':') ? target.split(':') : [target, null];

    // If container name is specified, get Docker container logs
    if (containerName) {
      const processManager = ProcessManager.getInstance();
      const orchestrator = new ModuleOrchestrator(processManager);
      const dockerExecutor = new DockerExecutor(processManager);

      orchestrator.load(config);

      const module = orchestrator.getModule(moduleName);

      if (!module) {
        console.log(
          errorBox(
            `${icons.error} Module not found`,
            `Module "${moduleName}" does not exist in your configuration.`,
            ['Check your dev.config.yaml file', 'Use: canto status']
          )
        );
        process.exit(1);
      }

      if (module.type !== 'docker') {
        console.log(
          errorBox(
            `${icons.error} Not a Docker module`,
            `Module "${moduleName}" is not a Docker module.\n\n` +
              'Container-specific logs are only available for Docker modules.',
            ['Use: canto logs <module>', 'For Docker modules use: canto logs <module>:<container>']
          )
        );
        process.exit(1);
      }

      // Get containers for this module
      const services = dockerExecutor.getServices(module);
      const service = services.find(
        (s) => s.container && (s.container.name === containerName || s.name === containerName)
      );

      if (!service?.container) {
        console.log(
          errorBox(
            `${icons.error} Container not found`,
            `Container "${containerName}" not found in module "${moduleName}".\n\n` +
              `Available containers:\n${services
                .filter((s) => s.container)
                .map((s) => `  • ${s.container?.name}`)
                .join('\n')}`,
            ['Check: canto status', 'Make sure the container is running']
          )
        );
        process.exit(1);
      }

      const lines = parseInt(options.lines ?? '50', 10);
      const follow = options.follow ?? false;
      const logsCmd = getContainerLogsCommand(service.container.name, lines, follow);

      console.log(
        colors.cyan(
          `\n${icons.logs} ${follow ? 'Following' : 'Viewing'} logs: ${colors.bold(moduleName)}:${colors.bold(containerName)}${follow ? ' (Ctrl+C to stop)' : ''}\n`
        )
      );
      console.log(`${colors.dim('─'.repeat(80))}\n`);

      // Execute docker logs command
      const cmdParts = logsCmd.split(' ');
      const cmd = cmdParts[0];
      const args = cmdParts.slice(1);

      if (!cmd) {
        console.log(errorBox(`${icons.error} Error`, 'Invalid docker logs command'));
        process.exit(1);
      }

      const docker = spawn(cmd, args, { stdio: 'inherit' });

      docker.on('close', (code: number | null) => {
        if (code !== 0 && code !== null) {
          console.log(colors.error(`\nDocker logs process exited with code ${code}`));
        }
        process.exit(code ?? 0);
      });

      process.on('SIGINT', () => {
        docker.kill();
        process.exit(0);
      });

      return;
    }

    // Regular module logs (non-Docker or module-level)
    const logsDir = config.global?.logsDir ?? './tmp';
    const logFile = resolve(logsDir, `${moduleName}.log`);

    if (!existsSync(logFile)) {
      console.log(
        errorBox(
          `${icons.error} Log file not found`,
          `No log file found for module "${moduleName}".\n\n` + `Expected location: ${logFile}`,
          [
            'The module may not have been started yet',
            'Check if the module name is correct',
            'For Docker containers use: canto logs <module>:<container>',
          ]
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
