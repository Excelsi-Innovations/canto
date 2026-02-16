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
  _test_setPlatform,
} from '../../../src/utils/platform.js';
import { execSync } from 'node:child_process';
import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// Mock node:child_process safely
mock.module('node:child_process', () => ({
  execSync: mock(),
  exec: mock(),
  spawn: mock(),
}));

describe('platform utilities', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    (execSync as any).mockClear();
    _test_setPlatform(undefined); // Reset
  });

  afterEach(() => {
    _test_setPlatform(undefined);
    process.env = { ...originalEnv };
  });

  it('should detect Windows platform', () => {
    _test_setPlatform('win32');
    expect(detectPlatform()).toBe('windows');
    expect(isWindows()).toBe(true);
    expect(isMacOS()).toBe(false);
    expect(isLinux()).toBe(false);
  });

  it('should detect macOS platform', () => {
    _test_setPlatform('darwin');
    expect(detectPlatform()).toBe('macos');
    expect(isWindows()).toBe(false);
    expect(isMacOS()).toBe(true);
    expect(isLinux()).toBe(false);
  });

  it('should detect Linux platform', () => {
    _test_setPlatform('linux');
    expect(detectPlatform()).toBe('linux');
    expect(isWindows()).toBe(false);
    expect(isMacOS()).toBe(false);
    expect(isLinux()).toBe(true);
  });

  it('should detect unknown platform', () => {
    _test_setPlatform('android'); // An example of an unknown platform
    expect(detectPlatform()).toBe('unknown');
    expect(isWindows()).toBe(false);
    expect(isMacOS()).toBe(false);
    expect(isLinux()).toBe(false);
  });
});
