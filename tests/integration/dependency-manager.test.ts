import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { DependencyManager } from '../../src/lib/setup/dependency-manager.js';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import type { Module } from '../../src/config/schema.js';

const TEST_DIR = join(process.cwd(), 'tmp', 'test-deps');
const CACHE_DIR = join(process.cwd(), '.canto', 'cache');
const HASH_FILE = join(CACHE_DIR, 'deps.hash.json');

describe('DependencyManager Integration', () => {
  let manager: DependencyManager;

  beforeEach(() => {
    // Clean up
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    if (existsSync(HASH_FILE)) rmSync(HASH_FILE, { force: true });
    
    mkdirSync(TEST_DIR, { recursive: true });
    
    // Create dummy module structure
    mkdirSync(join(TEST_DIR, 'module-a'));
    writeFileSync(join(TEST_DIR, 'module-a', 'package.json'), JSON.stringify({ name: 'module-a' }));
    writeFileSync(join(TEST_DIR, 'module-a', 'package-lock.json'), JSON.stringify({ name: 'module-a', version: '1.0.0' }));

    manager = new DependencyManager();
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('should detect changes and run install when lockfile changes', async () => {
    const module: Module = {
      name: 'module-a',
      path: join(TEST_DIR, 'module-a'),
      type: 'workspace',
      packageManager: 'npm',
      enabled: true,
      dependsOn: [],
      run: {}
    };

    // Mock ProcessManager spawn to avoid actual install
    // We need to access the private processManager or mock the spawn method if it was protected.
    // Since we can't easily mock private properties in TS without casting, we'll spy on the prototype or the instance method if accessible.
    // However, DependencyManager uses a private processManager.
    // For this integration test, we might want to mock the `processManager.spawn` method.
    // A better approach for integration might be to spy on `manager['processManager'].spawn`.
    
    // @ts-ignore
    const spawnSpy = spyOn(manager.processManager, 'spawn').mockResolvedValue({ success: true, processInfo: { id: 'test-proc', pid: 123, command: 'npm install' } });
    // @ts-ignore
    const waitSpy = spyOn(manager, 'waitForProcess').mockResolvedValue();

    // First run: should install
    const result1 = await manager.checkAndInstall(module);
    expect(result1).toBe(true);
    expect(spawnSpy).toHaveBeenCalledTimes(1);

    // Second run: no change, should not install
    spawnSpy.mockClear();
    const result2 = await manager.checkAndInstall(module);
    expect(result2).toBe(true);
    expect(spawnSpy).toHaveBeenCalledTimes(0);

    // Modify lockfile
    writeFileSync(join(TEST_DIR, 'module-a', 'package-lock.json'), JSON.stringify({ name: 'module-a', version: '1.0.1' }));

    // Third run: changed, should install
    const result3 = await manager.checkAndInstall(module);
    expect(result3).toBe(true);
    expect(spawnSpy).toHaveBeenCalledTimes(1);
    
    // Verify cache file exists
    expect(existsSync(HASH_FILE)).toBe(true);
    const cache = JSON.parse(readFileSync(HASH_FILE, 'utf-8'));
    expect(cache['module-a']).toBeDefined();
  });
});
