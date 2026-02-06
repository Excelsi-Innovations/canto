import pc from 'picocolors';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { loadConfig } from '../../config/parser.js';
import { icons, colors } from '../utils/display.js';
import { errorBox, successBox } from '../utils/format.js';

/**
 * Restart command handler
 * Restarts a specific module
 */
export async function restartCommand(moduleName: string): Promise<void> {
  try {
    const config = await loadConfig();
    const processManager = new ProcessManager();
    const orchestrator = new ModuleOrchestrator(processManager);

    orchestrator.load(config);

    console.log(pc.cyan(`\n${icons.restart} Restarting ${moduleName}...\n`));

    const result = await orchestrator.restart(moduleName);

    if (result.success) {
      console.log(
        successBox(
          `${icons.success} Module restarted successfully`,
          `${moduleName} has been restarted.\n\n` +
            `${colors.dim(`PID: ${result.pid}`)}\n\n` +
            `${colors.bold('View logs:')}\n` +
            `  ${colors.cyan(`canto logs ${moduleName}`)}`
        )
      );
    } else {
      console.log(
        errorBox(
          `${icons.error} Failed to restart module`,
          `Failed to restart ${moduleName}.\n\n` + `${result.error ?? 'Unknown error'}`,
          [`Check logs: canto logs ${moduleName}`]
        )
      );
      process.exit(1);
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
