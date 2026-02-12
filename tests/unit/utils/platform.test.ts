import {
  detectPlatform,
  isWindows,
  isMacOS,
  isLinux,
  getPlatformCommand,
  getShell,
  getPathSeparator,
  isWSL,
  getTerminalType,
  supports256Colors,
  getRenderingHints,
  Platform,
} from '../../../src/utils/platform.js';
import { execSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// Mock node:child_process to prevent actual command execution
mock.module('node:child_process', () => ({
  execSync: mock(),
}));

describe('platform utilities', () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset mocks before each test
    (execSync as any).mockClear();
    // jest.resetModules() is not needed as the module is stateless and we are mocking process manually
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
    process.env = originalEnv;
  });

  it('should detect Windows platform', () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });
    expect(detectPlatform()).toBe('windows');
    expect(isWindows()).toBe(true);
    expect(isMacOS()).toBe(false);
    expect(isLinux()).toBe(false);
  });

  it('should detect macOS platform', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
    });
    expect(detectPlatform()).toBe('macos');
    expect(isWindows()).toBe(false);
    expect(isMacOS()).toBe(true);
    expect(isLinux()).toBe(false);
  });

  it('should detect Linux platform', () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux',
    });
    expect(detectPlatform()).toBe('linux');
    expect(isWindows()).toBe(false);
    expect(isMacOS()).toBe(false);
    expect(isLinux()).toBe(true);
  });

  it('should detect unknown platform', () => {
    Object.defineProperty(process, 'platform', {
      value: 'android', // An example of an unknown platform
    });
    expect(detectPlatform()).toBe('unknown');
    expect(isWindows()).toBe(false);
    expect(isMacOS()).toBe(false);
    expect(isLinux()).toBe(false);
  });
});
