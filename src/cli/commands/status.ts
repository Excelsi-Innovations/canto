import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { loadConfig } from '../../config/parser.js';
import { icons, colors, moduleTypeIcon } from '../utils/display.js';
import { errorBox, columns } from '../utils/format.js';
import { DockerExecutor } from '../../modules/docker.js';
import { getContainerStatusDisplay, formatPorts } from '../../utils/docker.js';

interface StatusOptions {
  verbose?: boolean;
}

/**
 * Status command handler
 * Shows status of all modules
 */
export async function statusCommand(_options: StatusOptions): Promise<void> {
  try {
    const config = await loadConfig();
    const processManager = new ProcessManager();
    const orchestrator = new ModuleOrchestrator(processManager);
    const dockerExecutor = new DockerExecutor(processManager);

    orchestrator.load(config);

    const moduleNames = orchestrator.getModuleNames();

    console.log(`\n${colors.cyan(colors.bold(`${icons.rocket} Canto Dev Launcher - Status`))}\n`);

    if (moduleNames.length === 0) {
      console.log(colors.dim('No modules configured.\n'));
      return;
    }

    const runningModules: string[][] = [];
    const stoppedModules: string[][] = [];

    for (const name of moduleNames) {
      const module = orchestrator.getModule(name);
      if (!module) continue;

      const icon = moduleTypeIcon(module.type);
      const status = processManager.getStatus(name);
      const pid = processManager.getPid(name);

      const portInfo =
        module.env?.['PORT'] !== undefined ? ` ${colors.cyan(`PORT=${module.env['PORT']}`)}` : '';

      // For Docker modules, show containers
      if (module.type === 'docker') {
        const services = dockerExecutor.getServices(module);

        if (services.length > 0) {
          // Module header row
          const moduleHeader = [
            colors.dim('┌'),
            colors.bold(colors.cyan(name)),
            `${icon} ${module.type}`,
            services.length > 0 ? `${services.length} services` : 'No containers',
          ];

          const isRunning = services.some((s) => s.container?.status === 'running');

          if (isRunning || status === 'RUNNING') {
            runningModules.push(moduleHeader);

            // Container rows
            for (const service of services) {
              if (service.container) {
                const statusDisplay = getContainerStatusDisplay(service.container.status);
                const ports = formatPorts(service.container.ports);

                runningModules.push([
                  colors.dim('├─'),
                  `  ${service.container.name}`,
                  `${statusDisplay.color(statusDisplay.icon)} ${statusDisplay.color(service.container.status)}`,
                  ports ? colors.cyan(ports) : colors.dim('no ports'),
                ]);
              } else {
                runningModules.push([
                  colors.dim('├─'),
                  `  ${service.name}`,
                  colors.dim('○ not found'),
                  '',
                ]);
              }
            }

            // Closing line
            runningModules.push([colors.dim('└'), '', '', '']);
          } else {
            stoppedModules.push(moduleHeader);

            // Container rows
            for (const service of services) {
              if (service.container) {
                const statusDisplay = getContainerStatusDisplay(service.container.status);
                stoppedModules.push([
                  colors.dim('├─'),
                  `  ${service.container.name}`,
                  `${statusDisplay.color(statusDisplay.icon)} ${statusDisplay.color(service.container.status)}`,
                  '',
                ]);
              } else {
                stoppedModules.push([
                  colors.dim('├─'),
                  `  ${service.name}`,
                  colors.dim('○ not found'),
                  '',
                ]);
              }
            }

            // Closing line
            stoppedModules.push([colors.dim('└'), '', '', '']);
          }
        } else {
          // No services found, show as regular module
          const row = [
            status === 'RUNNING' ? colors.success(icons.success) : colors.dim(icons.stopped),
            colors.bold(name),
            `${icon} ${module.type}`,
            pid ? `PID ${pid}${portInfo}` : 'Not running',
          ];

          if (status === 'RUNNING') {
            runningModules.push(row);
          } else {
            stoppedModules.push(row);
          }
        }
      } else {
        // Non-Docker modules
        const row = [
          status === 'RUNNING' ? colors.success(icons.success) : colors.dim(icons.stopped),
          colors.bold(name),
          `${icon} ${module.type}`,
          pid ? `PID ${pid}${portInfo}` : 'Not running',
        ];

        if (status === 'RUNNING') {
          runningModules.push(row);
        } else {
          stoppedModules.push(row);
        }
      }
    }

    if (runningModules.length > 0) {
      console.log(colors.success(colors.bold('RUNNING')));
      console.log(columns(runningModules, [3, 30, 20, 20]));
      console.log();
    }

    if (stoppedModules.length > 0) {
      console.log(colors.dim(colors.bold('STOPPED')));
      console.log(columns(stoppedModules, [3, 30, 20, 20]));
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
