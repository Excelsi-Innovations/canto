import { VERSION } from '../../version.js';

/**
 * The Monolith ASCII Art Logo
 * Inspired by Fernando Pessoa's heteronyms:
 * Each process is a different "self" of the project,
 * and Canto is the maestro that unites them.
 */
const versionTag = `v${VERSION}`;

export const LOGO_LINES = [
  '▄█████████████████████████████████████████████▄',
  '██▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀██',
  '██   █▀▀▀  █▀▀█  █▄  █  ▀█▀  █▀▀█            ██',
  '██   █     █▄▄█  █ █ █   █   █  █            ██',
  `██   █▄▄▄  █  █  █  ▀█   █   █▄▄█  ${versionTag.padEnd(10)}██`,
  '██                                           ██',
  '██   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░    ██',
  '██   ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▀▀▀▀▀▀▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒    ██',
  '██   ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▄▄▄▄  ▐▓▓▓▓▓▓▓▓▓▓▓▓▓    ██',
  '██   ██████████████  ████  ▐█████████████    ██',
  '██   ██████████████  ▀▀▀▀  ▐█████████████    ██',
  '██   ██████████████▄▄▄▄▄▄▄▄██████████████    ██',
  '██   ████████████████████████████████████    ██',
  '██                                           ██',
  '██   "I am many, and yet I am one."          ██',
  '██   — Fernando Pessoa                       ██',
  '██▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄██',
];

/**
 * Compact logo for the sidebar (fits in ~26 chars width)
 * Using simple ASCII for maximum compatibility
 */
export const MINI_MONOLITH = [
  '   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   ',
  '   █ ▄▀▄ █ ▄▀▄ █ ▄ █ ▄▀▄ █   ',
  '   █ █ █ █ █▄█ █ █ █ █ █ █   ',
  '   █ ▀▄▀ █ █ █ █ ▀ █ ▀▄▀ █   ',
  '   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   ',
];

/**
 * Compact logo for the sidebar (fits in ~26 chars width)
 * Using simple ASCII for maximum compatibility
 */
export const SIDEBAR_LOGO = MINI_MONOLITH;

/**
 * Pessoa quote that rotates
 */
export const PESSOA_QUOTES = [
  '"I am many, and yet I am one." — Fernando Pessoa',
  '"To be great, be whole." — Fernando Pessoa',
  '"Literature is the proof that life is not enough." — Pessoa',
  '"Everything is worth it if the soul is not small." — Pessoa',
  '"I am the interval between what I wish and what I am." — Pessoa',
];

/**
 * Get a rotating quote based on time (changes every 30s)
 */
export function getCurrentQuote(): string {
  const index = Math.floor(Date.now() / 30000) % PESSOA_QUOTES.length;
  return PESSOA_QUOTES[index] ?? PESSOA_QUOTES[0] ?? '';
}

// -------------------------------------------------------------------
// Status messages
// -------------------------------------------------------------------

/**
 * Loading messages (shown during initialization)
 */
export const LOADING_MESSAGES = [
  'Initializing Canto...',
  'Loading configuration...',
  'Checking system resources...',
  'Preparing workspace...',
];

/**
 * Get a random loading message
 */
export function getLoadingMessage(): string {
  const index = Math.floor(Math.random() * LOADING_MESSAGES.length);
  return LOADING_MESSAGES[index] ?? 'Loading...';
}

/**
 * Action messages by module type
 */
export const POETIC_MESSAGES: Record<string, Record<string, string>> = {
  start: {
    docker: 'Starting Docker services...',
    workspace: 'Starting workspace module...',
    script: 'Executing script...',
    service: 'Starting service...',
    default: 'Starting module...',
  },
  stop: {
    docker: 'Stopping Docker services...',
    workspace: 'Stopping workspace module...',
    script: 'Stopping script...',
    service: 'Stopping service...',
    default: 'Stopping module...',
  },
  restart: {
    docker: 'Restarting Docker services...',
    workspace: 'Restarting workspace module...',
    script: 'Restarting script...',
    service: 'Restarting service...',
    default: 'Restarting module...',
  },
  error: {
    docker: 'Docker service unreachable or failed',
    workspace: 'Workspace module failed',
    script: 'Script execution failed',
    service: 'Service failed',
    default: 'Module failed unexpectedly',
  },
  autoRestart: {
    docker: 'Auto-restarting Docker service...',
    workspace: 'Auto-restarting workspace...',
    script: 'Auto-restarting script...',
    service: 'Auto-restarting service...',
    default: 'Auto-restarting module...',
  },
};

/**
 * Get a poetic message for an action + module type
 */
export function getPoeticMessage(action: string, moduleType: string): string {
  const actionMessages = POETIC_MESSAGES[action];
  if (!actionMessages) return `${action}...`;
  return actionMessages[moduleType.toLowerCase()] ?? actionMessages['default'] ?? `${action}...`;
}

/**
 * Pulse border colors — cycles between two colors
 * Used for the "breathing" animation on the monolith
 */
export const PULSE_COLORS = {
  idle: ['#3C3C3C', '#4A4A4A', '#585858', '#4A4A4A'], // subtle gray breathing
  loading: ['#565F89', '#7AA2F7', '#BB9AF7', '#7AA2F7'], // blue-purple loading
  success: ['#4EC9B0', '#50FA7B', '#4EC9B0', '#3DA88C'], // green flash
  error: ['#F48771', '#FF5555', '#F48771', '#C0392B'], // red flash
};

/**
 * Get the current pulse color for a given state
 * Cycles through the palette every ~600ms per step
 */
export function getPulseColor(state: keyof typeof PULSE_COLORS): string {
  const palette = PULSE_COLORS[state];
  const index = Math.floor(Date.now() / 600) % palette.length;
  return palette[index] ?? palette[0] ?? '#000000';
}
