/**
 * Platform detection utilities
 * Cross-platform compatibility helpers
 */

import { execSync } from 'node:child_process';

export type Platform = 'windows' | 'linux' | 'macos' | 'unknown';

/**
 * Detect the current operating system platform
 *
 * @returns Platform identifier
 */
export function detectPlatform(): Platform {
  const { platform } = process;

  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

/**
 * Check if running on Windows
 *
 * @returns True if Windows, false otherwise
 */
export function isWindows(): boolean {
  return process.platform === 'win32';
}

/**
 * Check if running on macOS
 *
 * @returns True if macOS, false otherwise
 */
export function isMacOS(): boolean {
  return process.platform === 'darwin';
}

/**
 * Check if running on Linux
 *
 * @returns True if Linux, false otherwise
 */
export function isLinux(): boolean {
  return process.platform === 'linux';
}

/**
 * Get platform-specific command
 * Useful for commands that differ between platforms
 *
 * @param commands - Object with platform-specific commands
 * @returns Command for current platform
 */
export function getPlatformCommand(commands: {
  windows: string;
  macos: string;
  linux: string;
}): string {
  const platform = detectPlatform();

  switch (platform) {
    case 'windows':
      return commands.windows;
    case 'macos':
      return commands.macos;
    case 'linux':
      return commands.linux;
    default:
      return commands.linux;
  }
}

/**
 * Get platform-specific shell
 *
 * @returns Shell executable for current platform
 */
export function getShell(): string {
  return isWindows() ? 'cmd.exe' : '/bin/sh';
}

/**
 * Get platform-specific path separator
 *
 * @returns Path separator character
 */
export function getPathSeparator(): string {
  return isWindows() ? '\\' : '/';
}

/**
 * Check if running in WSL (Windows Subsystem for Linux)
 *
 * @returns True if running in WSL
 */
export function isWSL(): boolean {
  if (!isLinux()) return false;

  try {
    const release = execSync('uname -r', { encoding: 'utf8' });
    return release.toLowerCase().includes('microsoft') || release.toLowerCase().includes('wsl');
  } catch {
    return false;
  }
}

/**
 * Get the terminal type
 */
export function getTerminalType(): string {
  return process.env['TERM'] || 'unknown';
}

/**
 * Checks if terminal supports 256 colors
 */
export function supports256Colors(): boolean {
  const term = process.env['TERM'] || '';
  return term.includes('256color') || term.includes('24bit') || term.includes('truecolor');
}

/**
 * Gets platform-specific rendering hints for terminal UI
 */
export interface RenderingHints {
  isWSL: boolean;
  terminalType: string;
  supports256Colors: boolean;
  platform: Platform;
}

export function getRenderingHints(): RenderingHints {
  return {
    isWSL: isWSL(),
    terminalType: getTerminalType(),
    supports256Colors: supports256Colors(),
    platform: detectPlatform(),
  };
}
