import pc from 'picocolors';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { loadConfig } from '../../config/parser.js';
import { icons, colors } from '../utils/display.js';
import { errorBox, successBox } from '../utils/format.js';

interface StopOptions {
  all?: boolean;
}

/**
 * Stop command handler
 * Stops one or more running modules
 */
export async function stopCommand(modules: string[], options: StopOptions): Promise<void> {
  try {
    const config = await loadConfig();
    const processManager = ProcessManager.getInstance();
    const orchestrator = new ModuleOrchestrator(processManager);

    orchestrator.load(config);

    if (options.all || modules.length === 0) {
      console.log(pc.yellow(`\n${icons.stop} Stopping all modules...\n`));
      await orchestrator.stopAll();
      console.log(
        successBox(
          `${icons.success} All modules stopped`,
          'All modules have been stopped successfully.'
        )
      );
    } else {
      console.log(pc.yellow(`\n${icons.stop} Stopping modules...\n`));

      for (const name of modules) {
        try {
          await orchestrator.stop(name);
          console.log(colors.success(`  ${icons.success} ${name} stopped`));
        } catch (error) {
          console.log(colors.error(`  ${icons.error} Failed to stop ${name}: ${error}`));
        }
      }

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
