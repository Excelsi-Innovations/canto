#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION } from '../version.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { restartCommand } from './commands/restart.js';
import { checkCommand } from './commands/check.js';
import { initCommand } from './commands/init.js';
import { menuCommand } from './commands/menu.js';

const program = new Command();

program
  .name('canto')
  .description('Universal, stack-agnostic CLI dev launcher for local development')
  .version(VERSION, '-v, --version', 'Output the current version');

program
  .command('init')
  .description('Initialize a new Canto configuration')
  .option('-f, --force', 'Overwrite existing configuration')
  .option('-y, --yes', 'Skip interactive wizard and use defaults')
  .action(initCommand);

program
  .command('start [modules...]')
  .description('Start one or more modules (starts all if none specified)')
  .option('-a, --all', 'Start all enabled modules')
  .action(startCommand);

program
  .command('stop [modules...]')
  .description('Stop one or more modules (stops all if none specified)')
  .option('-a, --all', 'Stop all running modules')
  .action(stopCommand);

program.command('restart <module>').description('Restart a specific module').action(restartCommand);

program.command('check').description('Check if all prerequisites are met').action(checkCommand);

program
  .command('status')
  .description('Show status of all modules')
  .option('-v, --verbose', 'Show detailed status information')
  .action(statusCommand);

program
  .command('logs <module>')
  .description('View logs for a specific module')
  .option('-f, --follow', 'Follow log output', true)
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(logsCommand);

// Default action - show interactive menu
program.action(async () => {
  await menuCommand();
});

program.parse();
