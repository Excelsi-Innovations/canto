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
export const SIDEBAR_LOGO = [
  '  ██████  █████  ███  █',
  ' ██      ██   ██ ████ █',
  ' ██      ███████ ██ ███',
  ' ██      ██   ██ ██  ██',
  '  ██████ ██   ██ ██   █',
];

/**
 * Pessoa quote that rotates
 */
export const PESSOA_QUOTES = [
  '"I am many, and yet I am one." — Fernando Pessoa',
  '"To be great, be whole." — Fernando Pessoa',
  '"I am nothing. I shall never be anything." — Pessoa',
  '"Literature is the proof that life is not enough." — Pessoa',
  '"I carry my awareness of defeat like a flag of victory." — Pessoa',
  '"Everything is worth it if the soul is not small." — Pessoa',
  '"I am the interval between what I wish and what I am." — Pessoa',
];

/**
 * Get a rotating quote based on time (changes every 30s)
 */
export function getCurrentQuote(): string {
  const index = Math.floor(Date.now() / 30000) % PESSOA_QUOTES.length;
  return PESSOA_QUOTES[index]!;
}

// -------------------------------------------------------------------
// Poetic feedback messages — the "voice" of the maestro
// -------------------------------------------------------------------

/**
 * Loading messages (shown during initialization)
 */
export const LOADING_MESSAGES = [
  'Summoning the heteronyms...',
  'Tuning the instruments...',
  'Reading the score...',
  'Gathering the ensemble...',
  'Opening the curtain...',
];

/**
 * Get a random loading message
 */
export function getLoadingMessage(): string {
  const index = Math.floor(Math.random() * LOADING_MESSAGES.length);
  return LOADING_MESSAGES[index]!;
}

/**
 * Poetic action messages by module type
 */
export const POETIC_MESSAGES: Record<string, Record<string, string>> = {
  start: {
    docker: 'Summoning Docker services...',
    workspace: 'Composing the workspace...',
    script: 'Invoking the script...',
    service: 'Awakening the service...',
    default: 'Bringing the voice to life...',
  },
  stop: {
    docker: 'Silencing the containers...',
    workspace: 'Resting the workspace...',
    script: 'Hushing the script...',
    service: 'Putting the service to sleep...',
    default: 'The voice fades to silence...',
  },
  restart: {
    docker: 'Retuning the containers...',
    workspace: 'Reshaping the workspace...',
    script: 'Replaying the script...',
    service: 'Refreshing the service...',
    default: 'The voice finds a new key...',
  },
  error: {
    docker: 'A container lost its melody...',
    workspace: 'The workspace struck a sour note...',
    script: 'The script missed its cue...',
    service: 'The service fell out of rhythm...',
    default: 'A voice went silent unexpectedly...',
  },
  autoRestart: {
    docker: 'Coaxing the container back to the stage...',
    workspace: 'Retuning the workspace...',
    script: 'The script picks up where it left off...',
    service: 'The service returns from intermission...',
    default: 'The maestro calls the voice back...',
  },
};

/**
 * Get a poetic message for an action + module type
 */
export function getPoeticMessage(action: string, moduleType: string): string {
  const actionMessages = POETIC_MESSAGES[action];
  if (!actionMessages) return `${action}...`;
  return actionMessages[moduleType.toLowerCase()] || actionMessages['default'] || `${action}...`;
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
  return palette[index]!;
}
