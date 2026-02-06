import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { loadConfig } from '../../config/parser.js';
import { icons, colors, moduleTypeIcon } from '../utils/display.js';
import { errorBox, columns } from '../utils/format.js';

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

    if (runningModules.length > 0) {
      console.log(colors.success(colors.bold(`RUNNING (${runningModules.length} modules)`)));
      console.log(columns(runningModules, [3, 20, 15, 15]));
      console.log();
    }

    if (stoppedModules.length > 0) {
      console.log(colors.dim(colors.bold(`STOPPED (${stoppedModules.length} modules)`)));
      console.log(columns(stoppedModules, [3, 20, 15, 15]));
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
