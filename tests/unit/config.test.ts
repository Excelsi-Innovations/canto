import { describe, test, expect } from 'bun:test';
import { resolve } from 'path';
import { validateConfig, safeValidateConfig } from '../../src/config/schema';
import {
  loadConfig,
  loadConfigSync,
  findConfigFile,
  ConfigNotFoundError,
} from '../../src/config/parser';

const FIXTURES_DIR = resolve(__dirname, '../fixtures');
const JSON_ONLY_DIR = resolve(__dirname, '../fixtures/json-only');
const INVALID_CONFIG_DIR = resolve(__dirname, '../fixtures/invalid-config');

describe('Config Schema Validation', () => {
  test('should validate a valid config object', () => {
    const validConfig = {
      modules: [
        {
          name: 'test-module',
          type: 'workspace',
          path: './test',
          run: {
            dev: 'npm run dev',
          },
        },
      ],
    };

    const result = validateConfig(validConfig);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]?.name).toBe('test-module');
  });

  test('should reject invalid config (missing required fields)', () => {
    const invalidConfig = {
      modules: [
        {
          name: 'test',
          type: 'workspace',
          // missing required 'path' and 'run'
        },
      ],
    };

    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test('should reject config with invalid module type', () => {
    const invalidConfig = {
      modules: [
        {
          name: 'test',
          type: 'invalid-type',
          path: './test',
        },
      ],
    };

    expect(() => validateConfig(invalidConfig)).toThrow();
  });

  test('should apply default values', () => {
    const config = {
      modules: [
        {
          name: 'test',
          type: 'workspace',
          path: './test',
          run: { dev: 'npm run dev' },
        },
      ],
    };

    const result = validateConfig(config);
    expect(result.version).toBe('1'); // default
    expect(result.modules[0]?.enabled).toBe(true); // default
    expect(result.modules[0]?.dependsOn).toEqual([]); // default
  });

  test('safeValidateConfig should return success for valid config', () => {
    const validConfig = {
      modules: [
        {
          name: 'test',
          type: 'workspace',
          path: './test',
          run: { dev: 'npm run dev' },
        },
      ],
    };

    const result = safeValidateConfig(validConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.modules).toHaveLength(1);
    }
  });

  test('safeValidateConfig should return errors for invalid config', () => {
    const invalidConfig = {
      modules: 'not-an-array',
    };

    const result = safeValidateConfig(invalidConfig);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors).toBeDefined();
    }
  });
});

describe('Config File Discovery', () => {
  test('should find YAML config file', () => {
    const found = findConfigFile(FIXTURES_DIR);
    expect(found).toBeTruthy();
    expect(found).toContain('dev.config.yaml');
  });

  test('should return null when no config file exists', () => {
    const found = findConfigFile('/nonexistent/path');
    expect(found).toBeNull();
  });
});

describe('Config Loading - Sync', () => {
  test('should load and validate YAML config', () => {
    const config = loadConfigSync(FIXTURES_DIR);
    expect(config.modules).toHaveLength(4);
    expect(config.modules[0]?.name).toBe('backend');
    expect(config.modules[0]?.type).toBe('workspace');
  });

  test('should load JSON config when no YAML exists', () => {
    const config = loadConfigSync(JSON_ONLY_DIR);
    expect(config.modules.length).toBeGreaterThan(0);
    expect(config.modules[0]?.name).toBe('json-backend');
    expect(config.modules[1]?.name).toBe('json-frontend');
  });

  test('should throw ConfigNotFoundError when no config exists', () => {
    expect(() => loadConfigSync('/nonexistent/path')).toThrow(ConfigNotFoundError);
  });

  test('should throw validation error for invalid config', () => {
    expect(() => loadConfigSync(INVALID_CONFIG_DIR)).toThrow();
  });
});

describe('Config Loading - Async', () => {
  test('should load and validate YAML config asynchronously', async () => {
    const config = await loadConfig(FIXTURES_DIR);
    expect(config.modules).toHaveLength(4);
    expect(config.modules[0]?.name).toBe('backend');
  });

  test('should throw ConfigNotFoundError when no config exists', async () => {
    await expect(loadConfig('/nonexistent/path')).rejects.toThrow(ConfigNotFoundError);
  });
});

describe('Module Types', () => {
  test('should validate workspace module', () => {
    const config = {
      modules: [
        {
          name: 'backend',
          type: 'workspace',
          path: './apps/backend',
          run: {
            dev: 'npm run dev',
            build: 'npm run build',
            test: 'npm test',
          },
          packageManager: 'pnpm',
        },
      ],
    };

    const result = validateConfig(config);
    const module = result.modules[0];
    expect(module?.type).toBe('workspace');
    if (module?.type === 'workspace') {
      expect(module.path).toBe('./apps/backend');
      expect(module.run.dev).toBe('npm run dev');
      expect(module.packageManager).toBe('pnpm');
    }
  });

  test('should validate docker module', () => {
    const config = {
      modules: [
        {
          name: 'infra',
          type: 'docker',
          composeFile: './docker-compose.yaml',
          services: ['postgres', 'redis'],
        },
      ],
    };

    const result = validateConfig(config);
    const module = result.modules[0];
    expect(module?.type).toBe('docker');
    if (module?.type === 'docker') {
      expect(module.composeFile).toBe('./docker-compose.yaml');
      expect(module.services).toEqual(['postgres', 'redis']);
    }
  });

  test('should validate custom module', () => {
    const config = {
      modules: [
        {
          name: 'worker',
          type: 'custom',
          command: 'node worker.js',
          cwd: './apps/backend',
        },
      ],
    };

    const result = validateConfig(config);
    const module = result.modules[0];
    expect(module?.type).toBe('custom');
    if (module?.type === 'custom') {
      expect(module.command).toBe('node worker.js');
      expect(module.cwd).toBe('./apps/backend');
    }
  });
});
