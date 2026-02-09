#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import { VERSION } from '../version.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { statusCommand } from './commands/status.js';
import { logsCommand } from './commands/logs.js';
import { restartCommand } from './commands/restart.js';
import { checkCommand } from './commands/check.js';
import { initCommand } from './commands/init.js';
import { dashboardCommand } from './commands/dashboard.js';
import { envCommand } from './commands/env.js';
import { updateCommand } from './commands/update.js';
import { errorBox } from './utils/format.js';

// Global error handlers - NEVER let Canto crash!
process.on('uncaughtException', (error: Error) => {
  console.error(`\n${  errorBox('Uncaught Exception', error.message)}`);
  console.error(pc.dim('\nStack trace:'));
  console.error(pc.dim(error.stack ?? 'No stack trace available'));
  console.error(pc.yellow('\n⚠️  Canto is still running. Use Ctrl+C to exit.\n'));
});

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`\n${  errorBox('Unhandled Promise Rejection', message)}`);
  if (reason instanceof Error && reason.stack) {
    console.error(pc.dim('\nStack trace:'));
    console.error(pc.dim(reason.stack));
  }
  console.error(pc.yellow('\n⚠️  Canto is still running. Use Ctrl+C to exit.\n'));
});

// Graceful shutdown on SIGINT/SIGTERM
process.on('SIGINT', async () => {
  console.log(pc.cyan('\n\n👋 Canto shutting down gracefully...\n'));
  const { shutdownPreferencesManager } = await import('../utils/preferences-manager.js');
  await shutdownPreferencesManager();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log(pc.cyan('\n\n👋 Canto shutting down gracefully...\n'));
  const { shutdownPreferencesManager } = await import('../utils/preferences-manager.js');
  await shutdownPreferencesManager();
  process.exit(0);
});

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
  .command('logs <target>')
  .description('View logs for a module or container (use module:container for Docker containers)')
  .option('-f, --follow', 'Follow log output', true)
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action(logsCommand);

program
  .command('env')
  .description('Manage environment variables')
  .option('--list', 'List all environment files')
  .option('--ports', 'Show port assignments from env files')
  .option('--check', 'Check for missing variables')
  .option('--diff <file>', 'Compare env file with its example')
  .action(envCommand);

program
  .command('dashboard')
  .alias('dash')
  .description('Launch interactive dashboard (OS-style interface)')
  .action(dashboardCommand);

program.command('update').description('Update Canto to the latest version').action(updateCommand);

// Default action - show interactive dashboard
program.action(async () => {
  await dashboardCommand();
});

program.parse();
