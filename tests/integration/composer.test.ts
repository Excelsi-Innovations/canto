import { describe, it, expect } from 'bun:test';
import { detectProject } from '../../src/init/detector';
import { initState, type ComposerState } from '../../src/init/composer-state';
import { generateConfig } from '../../src/init/templates';
import { join } from 'node:path';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';

const TEST_DIR = join(process.cwd(), 'tmp', 'composer-test');

describe('Composer Logic Integration', () => {
  // Setup dummy project structure
  const setupProject = () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    mkdirSync(TEST_DIR, { recursive: true });

    // Root package.json
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify({
      name: 'monorepo-root',
      workspaces: ['apps/*', 'packages/*'],
      scripts: {
        'db:migrate': 'prisma migrate deploy', // Should be detected as custom script
        'test': 'jest' // Should be ignored
      },
      engines: { node: '>=20.0.0' }
    }));

    // App workspace
    mkdirSync(join(TEST_DIR, 'apps', 'web'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'apps', 'web', 'package.json'), JSON.stringify({
      name: 'web-app',
      scripts: { dev: 'next dev', build: 'next build' }
    }));

    // Lib workspace
    mkdirSync(join(TEST_DIR, 'packages', 'ui'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'packages', 'ui', 'package.json'), JSON.stringify({
      name: 'ui-lib',
      scripts: { build: 'tsc' }
    }));

    // Infra
    writeFileSync(join(TEST_DIR, 'docker-compose.yml'), `
services:
  db:
    image: postgres:15
    ports:
      - "5432:5432"
`);
  };

  const cleanupProject = () => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
  };

  it('should detect project structure correctly', () => {
    setupProject();
    const detection = detectProject(TEST_DIR);

    expect(detection.projectType).toBe('monorepo');
    expect(detection.workspaces).toHaveLength(2);
    expect(detection.docker.composeFiles).toHaveLength(1);
    expect(detection.nodeVersion).toBe('>=20.0.0');
    expect(detection.rootScripts['db:migrate']).toBeDefined();

    cleanupProject();
  });

  it('should initialize state with correct defaults', () => {
    setupProject();
    const detection = detectProject(TEST_DIR);
    const state = initState(detection);

    // Verify modules
    const webApp = state.modules.find(m => m.name === 'web-app');
    const uiLib = state.modules.find(m => m.name === 'ui-lib');
    const infra = state.modules.find(m => m.name === 'infra');

    expect(webApp).toBeDefined();
    expect(webApp?.category).toBe('app');
    expect(webApp?.enabled).toBe(true); // Apps enabled by default
    expect(webApp?.dependsOn).toContain('infra'); // Should depend on infra

    expect(uiLib).toBeDefined();
    expect(uiLib?.category).toBe('lib');
    expect(uiLib?.enabled).toBe(false); // Libs disabled by default (enabled: undefined -> false in getDefaults logic? checking...)

    // Verify infra
    expect(infra).toBeDefined();
    expect(infra?.type).toBe('docker');
    expect(infra?.enabled).toBe(true);

    // Verify custom scripts
    expect(state.customScripts['db:migrate']).toBe(true);
    expect(state.customScripts['test']).toBeUndefined(); // specifcally filtered out

    cleanupProject();
  });

  it('should generate valid config from state', () => {
    setupProject();
    const detection = detectProject(TEST_DIR);
    const state = initState(detection);
    const config = generateConfig(state);

    expect(config.version).toBe('1');
    expect(config.global?.prerequisites.node).toBe('>=20.0.0');
    expect(config.global?.prerequisites.docker).toBe(true);
    
    // Check modules
    const appModule = config.modules.find(m => m.name === 'web-app');
    expect(appModule).toBeDefined();
    if (appModule?.type === 'workspace') {
      expect(appModule.run?.dev).toContain('npm run dev');
    }
    expect(appModule?.dependsOn).toContain('infra');

    // Check custom scripts
    expect(config.customScripts?.['db:migrate']).toBe('prisma migrate deploy');

    cleanupProject();
  });
});
