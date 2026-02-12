import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { render } from 'ink';
import React from 'react';
import { detectProject } from '../../init/detector.js';
import { generateConfig, configToYaml } from '../../init/templates.js';
import { CantoComposer } from '../../init/composer.js';
import { initState } from '../../init/composer-state.js';
import { icons, colors } from '../utils/display.js';
import { errorBox, successBox } from '../utils/format.js';

interface InitOptions {
  force?: boolean;
  yes?: boolean;
}

/**
 * Init command handler
 * Initializes a new Canto configuration with interactive wizard
 */
export async function initCommand(options: InitOptions): Promise<void> {
  try {
    const configPath = join(process.cwd(), 'dev.config.yaml');

    // Check if config alreadyists
    if (existsSync(configPath) && !options.force) {
      console.log(
        errorBox(
          `${icons.error} Configuration already exists`,
          `File already exists: dev.config.yaml\n\n` +
            `${colors.bold('Options:')}\n` +
            `  • Remove the existing file\n` +
            `  • Use --force to overwrite\n` +
            `  • Edit the file manually`
        )
      );
      process.exit(1);
    }

    console.log(
      `\n${colors.cyan(colors.bold(`${icons.rocket} Initializing Canto Configuration`))}\n`
    );

    // Detect project structure
    console.log(`${icons.info} Detecting project structure...\n`);
    const detection = detectProject(process.cwd());

    if (detection.workspaces.length === 0 && detection.docker.composeFiles.length === 0) {
      console.log(
        errorBox(
          `${icons.error} No project detected`,
          'Could not detect any workspaces or Docker Compose files.\n\n' +
            `${colors.bold('Make sure you run this command from:')}\n` +
            `  • A Node.js project root\n` +
            `  • A monorepo root\n` +
            `  • A directory with docker-compose.yml`
        )
      );
      process.exit(1);
    }

    // Skip wizard if --yes flag is provided
    if (options.yes) {
      // Create a default state from detection and generate config
      const defaultState = initState(detection);
      const config = generateConfig(defaultState);

      const yaml = configToYaml(config);
      writeFileSync(configPath, yaml, 'utf-8');

      console.log(
        successBox(
          `${icons.success} Configuration created!`,
          `Created: dev.config.yaml\n\n` +
            `${colors.bold('Detected:')}\n` +
            `  • ${detection.workspaces.length} workspace(s)\n` +
            `  • ${detection.docker.composeFiles.length} Docker Compose file(s)\n\n` +
            `${colors.bold('Next steps:')}\n` +
            `  ${icons.check} Review: cat dev.config.yaml\n` +
            `  ${icons.rocket} Start: canto start --all`
        )
      );
      return;
    }

    // Launch interactive wizard
    // Enter alternate screen buffer for full-screen experience
    process.stdout.write('\x1b[?1049h');

    const { waitUntilExit } = render(
      React.createElement(CantoComposer, {
        detection,
        onComplete: (state) => {
          // Leave alternate screen buffer before showing success
          process.stdout.write('\x1b[?1049l');

          const config = generateConfig(state);
          const yaml = configToYaml(config);
          writeFileSync(configPath, yaml, 'utf-8');

          console.log(
            `\n${successBox(
              `${icons.success} Configuration created!`,
              `Created: dev.config.yaml\n\n` +
                `${colors.bold('Modules configured:')}\n` +
                `  • ${config.modules.length} module(s)\n\n` +
                `${colors.bold('Launching dashboard...')}`
            )}\n`
          );

          // Auto-launch dashboard after successful init
          // We need a short delay to let the UI cleanup
          setTimeout(async () => {
            try {
              const { dashboardCommand } = await import('./dashboard.js');
              await dashboardCommand();
            } catch (e) {
              console.error(e);
              process.exit(1);
            }
          }, 800);
        },
        onCancel: () => {
          // Leave alternate screen buffer
          process.stdout.write('\x1b[?1049l');
          console.log(`\n${colors.yellow(`${icons.info} Initialization cancelled`)}\n`);
          process.exit(0);
        },
      })
    );

    await waitUntilExit();
  } catch (error) {
    if (error instanceof Error) {
      console.log(errorBox(`${icons.error} Error`, error.message));
    } else {
      console.log(errorBox(`${icons.error} Unknown error`, String(error)));
    }
    process.exit(1);
  }
}
