import { loadConfig } from '../../config/parser.js';
import { checkPrerequisites, printPrerequisitesReport } from '../../utils/prerequisites.js';
import { icons, colors } from '../utils/display.js';
import { successBox, errorBox } from '../utils/format.js';

/**
 * Check command handler
 * Validates that all prerequisites are met
 */
export async function checkCommand(): Promise<void> {
  try {
    const config = await loadConfig();

    console.log(`\n${colors.cyan(colors.bold(`${icons.check} Checking Prerequisites`))}\n`);

    if (!config.global?.prerequisites) {
      console.log(
        successBox(
          `${icons.success} No prerequisites configured`,
          'Your configuration does not specify any prerequisites.\n\n' +
            `${colors.bold('To add prerequisites:')}\n` +
            `Add a "prerequisites" section to your dev.config.yaml`
        )
      );
      return;
    }

    const results = checkPrerequisites(config.global.prerequisites);
    const allPassed = results.allMet;

    printPrerequisitesReport(results);
    console.log('');

    if (allPassed) {
      const checkCount = [results.docker, results.dockerCompose, results.node].filter(
        (r) => r !== undefined
      ).length;

      console.log(
        successBox(
          `${icons.success} All prerequisites met`,
          `All ${checkCount} prerequisite checks passed.\n\n` +
            `${colors.bold('You are ready to start:')}\n` +
            `  ${colors.cyan('canto start --all')}`
        )
      );
    } else {
      const checkCount = [results.docker, results.dockerCompose, results.node].filter(
        (r) => r !== undefined
      ).length;
      const failedCount = [
        results.docker?.installed && results.docker?.running,
        results.dockerCompose?.installed,
        results.node?.meetsRequirement,
      ].filter((r) => r === false).length;

      console.log(
        errorBox(
          `${icons.error} Prerequisites check failed`,
          `${failedCount} of ${checkCount} checks failed.\n\n` +
            `${colors.bold('To fix:')}\n` +
            `  Install missing prerequisites or\n` +
            `  Update configuration to reflect your setup`,
          ['See documentation for installation instructions']
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
