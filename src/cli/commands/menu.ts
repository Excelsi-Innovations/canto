import { render } from 'ink';
import React from 'react';
import { loadConfig } from '../../config/parser.js';
import { InteractiveMenu } from '../components/menu.js';
import { icons, colors } from '../utils/display.js';
import { errorBox } from '../utils/format.js';
import { startCommand } from './start.js';
import { stopCommand } from './stop.js';
import { statusCommand } from './status.js';
import { logsCommand } from './logs.js';
import { restartCommand } from './restart.js';
import { checkCommand } from './check.js';

/**
 * Menu command handler
 * Launches interactive TUI menu
 */
export async function menuCommand(): Promise<void> {
  try {
    const config = await loadConfig();

    const handleAction = async (action: string, target?: string): Promise<void> => {
      // Exit Ink rendering temporarily for command execution
      app.unmount();

      console.log(''); // Add spacing

      switch (action) {
        case 'start-all':
          await startCommand([], { all: true });
          break;
        case 'stop-all':
          await stopCommand([], { all: true });
          break;
        case 'status':
          await statusCommand({});
          break;
        case 'check':
          await checkCommand();
          break;
        case 'logs':
          if (target) {
            await logsCommand(target, { follow: true, lines: '50' });
          }
          break;
        case 'restart':
          if (target) {
            await restartCommand(target);
          }
          break;
      }

      console.log(''); // Add spacing
      console.log(colors.dim('Press any key to return to menu...'));

      // Wait for user input before returning to menu
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();

        // Restart menu
        console.clear();
        app = render(
          React.createElement(InteractiveMenu, {
            config,
            onAction: handleAction,
          })
        );
      });
    };

    let app = render(
      React.createElement(InteractiveMenu, {
        config,
        onAction: handleAction,
      })
    );

    await app.waitUntilExit();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('Configuration file not found')) {
        console.log(
          errorBox(
            `${icons.error} Configuration file not found`,
            'No configuration file detected in current directory.\n\n' +
              `${colors.bold('To get started:')}\n` +
              `  ${icons.rocket} Run: ${colors.cyan('canto init')}\n\n` +
              `Or use direct commands:\n` +
              `  ${colors.cyan('canto start <module>')}\n` +
              `  ${colors.cyan('canto --help')}`
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
