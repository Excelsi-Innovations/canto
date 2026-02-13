import pc from 'picocolors';
import { ProcessManager } from '../../processes/manager.js';
import { ModuleOrchestrator } from '../../modules/index.js';
import { loadConfig } from '../../config/parser.js';
import { onShutdown } from '../../utils/signals.js';
import { icons, colors } from '../utils/display.js';
import { progressBar, errorBox, successBox, formatDuration } from '../utils/format.js';
import { checkPrerequisites, printPrerequisitesReport } from '../../utils/prerequisites.js';
import { allocatePortsForModules } from '../../utils/ports.js';

interface StartOptions {
  all?: boolean;
  force?: boolean;
  noSetup?: boolean;
}

/**
 * Start command handler
 * Starts one or more modules with their dependencies
 */
export async function startCommand(modules: string[], options: StartOptions): Promise<void> {
  const startTime = Date.now();

  try {
    // Ensure logs directory exists
    const { mkdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    try {
      mkdirSync(join(process.cwd(), 'tmp', 'logs'), { recursive: true });
    } catch {
      // Ignore if exists
    }

    const config = await loadConfig();

    // Check prerequisites before starting
    if (config.global?.prerequisites) {
      console.log(`${colors.cyan(colors.bold(`${icons.check} Checking prerequisites...`))}\n`);
      const results = await checkPrerequisites(config.global.prerequisites);
      const allPassed = results.allMet;

      printPrerequisitesReport(results);
      console.log('');

      if (!allPassed) {
        console.log(
          errorBox(
            `${icons.error} Prerequisites check failed`,
            'Some required prerequisites are not met.\n\n' +
              `${colors.bold('To fix:')}\n` +
              `  Install missing prerequisites or\n` +
              `  Remove them from dev.config.yaml if not needed`,
            ['Run: canto check', 'See documentation for installation instructions']
          )
        );
        process.exit(1);
      }

      console.log(`${colors.green(`${icons.success} All prerequisites met`)}\n`);
    }

    // Smart Setup: Check dependencies
    if (!options.noSetup) {
      // console.log(colors.dim('Checking dependencies...'));
      const { DependencyManager } = await import('../../lib/setup/dependency-manager.js');
      const depManager = new DependencyManager();

      const workspaceModules = config.modules.filter((m) => m.type === 'workspace');
      if (workspaceModules.length > 0) {
        // console.log(colors.dim(`  Verifying dependencies for ${workspaceModules.length} module(s)...`));
        for (const module of workspaceModules) {
          await depManager.checkAndInstall(module, options.force);
        }
        console.log('');
      }
    }

    // Smart Setup: Env Check
    if (!options.noSetup) {
      const { diffEnvFiles } = await import('../../utils/env-diff.js');
      const { join } = await import('node:path');
      const { existsSync } = await import('node:fs');

      const cwd = process.cwd();
      const envPath = join(cwd, '.env');
      const examplePath = join(cwd, '.env.example');

      if (existsSync(examplePath)) {
        const diff = diffEnvFiles(envPath, examplePath);
        if (diff.missingKeys.length > 0) {
          console.log(
            errorBox(
              `${icons.warning} Missing Environment Variables`,
              `Your .env file is missing ${diff.missingKeys.length} variables defined in .env.example.\n` +
                `Missing: ${diff.missingKeys.slice(0, 5).join(', ')}${diff.missingKeys.length > 5 ? '...' : ''}\n\n` +
                `${colors.bold('To fix, run:')}\n` +
                `  ${colors.cyan('canto env --fix')}`,
              ['Run fix command to interactively add them']
            )
          );
          // Optional: Validation strictness might block start here
          // For now, we just warn.
        }
      }
    }

    // Allocate ports if enabled
    if (config.global?.autoAllocatePorts) {
      try {
        console.log(`${colors.cyan(colors.bold(`${icons.sparkles} Allocating ports...`))}\n`);
        const portMap = await allocatePortsForModules(config.modules);

        // Update module environment variables with allocated ports
        for (const module of config.modules) {
          if (portMap.has(module.name) && module.env) {
            const port = portMap.get(module.name);
            if (port && module.env['PORT'] === undefined) {
              module.env['PORT'] = String(port);
              console.log(
                `  ${colors.dim(`${icons.success} ${module.name}:`)} ${colors.cyan(`PORT=${port}`)}`
              );
            }
          }
        }
        console.log('');
      } catch (error) {
        console.log(
          colors.yellow(
            `${icons.warning} Port allocation failed, continuing without auto-allocation...\n`
          )
        );
        console.log(
          colors.dim(`Error: ${error instanceof Error ? error.message : String(error)}\n`)
        );
      }
    }

    const processManager = new ProcessManager();
    const orchestrator = new ModuleOrchestrator(processManager);

    orchestrator.load(config);

    onShutdown(async () => {
      console.log(pc.yellow(`\n${icons.stop} Stopping all modules...`));
      await orchestrator.stopAll();
    });

    const moduleNames = orchestrator.getModuleNames();

    if (moduleNames.length === 0) {
      console.log(
        errorBox('No modules found', 'Your configuration does not have any enabled modules.', [
          'Add modules to your dev.config.yaml',
          'Enable disabled modules by setting enabled: true',
        ])
      );
      process.exit(1);
    }

    const modulesToStart = options.all || modules.length === 0 ? moduleNames : modules;

    for (const name of modulesToStart) {
      if (!moduleNames.includes(name)) {
        console.log(
          errorBox('Module not found', `Module "${name}" does not exist in your configuration.`, [
            `Available modules: ${moduleNames.join(', ')}`,
            'Check your dev.config.yaml file',
          ])
        );
        process.exit(1);
      }
    }

    console.log(`\n${colors.cyan(colors.bold(`${icons.rocket} Canto Dev Launcher`))}\n`);
    console.log(`Starting modules in dependency order...\n`);

    const results = [];

    if (options.all || modules.length === 0) {
      const allResults = await orchestrator.startAll();
      results.push(...allResults);
    } else {
      for (const name of modulesToStart) {
        const moduleResults = await orchestrator.start(name);
        results.push(...moduleResults);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    console.log(`\n${progressBar(successCount, results.length)}\n`);

    const elapsed = Date.now() - startTime;

    if (failCount === 0) {
      console.log(
        successBox(
          `${icons.success} All modules started successfully!`,
          `All ${successCount} modules are now running.\n\n` +
            `${colors.dim(`Elapsed time: ${formatDuration(elapsed)}`)}\n\n` +
            `${colors.bold('Next steps:')}\n` +
            `  ${icons.logs} View logs:  ${colors.cyan('canto logs <module>')}\n` +
            `  ${icons.stats} Status:     ${colors.cyan('canto status')}\n` +
            `  ${icons.stop} Stop all:   ${colors.cyan('canto stop --all')}`
        )
      );
    } else {
      console.log(
        errorBox(
          `${icons.error} Failed to start some modules`,
          `${successCount} succeeded, ${failCount} failed.\n\n` +
            `${colors.bold('Check logs for details:')}\n` +
            `  ${colors.cyan('canto logs <module>')}`
        )
      );
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Configuration file not found')) {
        console.log(
          errorBox(
            `${icons.error} Configuration file not found`,
            'We looked for:\n' +
              '  ✗ dev.config.yaml\n' +
              '  ✗ dev.config.yml\n' +
              '  ✗ dev.config.json\n' +
              '  ✗ dev.config.ts\n' +
              '  ✗ dev.config.js',
            [
              'Create a configuration file in your project root',
              'Use: canto init (coming soon)',
              'See: https://github.com/yourusername/canto#configuration',
            ]
          )
        );
      } else {
        console.log(errorBox(`${icons.error} Error`, error.message));
      }
    } else {
      console.log(errorBox(`${icons.error} Unknown error`, String(error)));
    }
    process.exit(1);
  }
}
