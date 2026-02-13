import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { computeFileHash } from '../../utils/hashing.js';
import { ProcessManager } from '../../processes/manager.js';
import { icons, colors } from '../../cli/utils/display.js';
import type { Module } from '../../config/schema.js';
import type { PackageManager } from '../../init/detector.js';

const CACHE_DIR = '.canto/cache';
const HASH_FILE = 'deps.hash.json';

interface DependencyHash {
  [moduleName: string]: {
    lockfile: string;
    hash: string;
    lastChecked: string;
  };
}

export class DependencyManager {
  private cachePath: string;
  private hashes: DependencyHash = {};
  private processManager: ProcessManager;

  constructor() {
    this.cachePath = join(process.cwd(), CACHE_DIR, HASH_FILE);
    this.processManager = ProcessManager.getInstance();
    this.ensureCacheDir();
    this.loadCache();
  }

  private ensureCacheDir() {
    const dir = join(process.cwd(), CACHE_DIR);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private loadCache() {
    if (existsSync(this.cachePath)) {
      try {
        const content = readFileSync(this.cachePath, 'utf-8');
        this.hashes = JSON.parse(content);
      } catch (_error) {
        // Corrupt cache, ignore
        this.hashes = {};
      }
    }
  }

  private saveCache() {
    writeFileSync(this.cachePath, JSON.stringify(this.hashes, null, 2), 'utf-8');
  }

  private async getLockFile(
    modulePath: string,
    pm: PackageManager | undefined
  ): Promise<string | null> {
    // Detect lockfile based on package manager or look for common ones
    const lockfiles = {
      npm: 'package-lock.json',
      yarn: 'yarn.lock',
      pnpm: 'pnpm-lock.yaml',
      bun: 'bun.lockb',
    };

    if (pm && lockfiles[pm]) {
      const path = join(modulePath, lockfiles[pm]);
      if (existsSync(path)) return path;
    }

    // Fallback search
    for (const file of Object.values(lockfiles)) {
      const path = join(modulePath, file);
      if (existsSync(path)) return path;
    }

    // Rust
    const cargoLock = join(modulePath, 'Cargo.lock');
    if (existsSync(cargoLock)) return cargoLock;

    // PHP
    const composerLock = join(modulePath, 'composer.lock');
    if (existsSync(composerLock)) return composerLock;

    // Python
    const poetryLock = join(modulePath, 'poetry.lock');
    if (existsSync(poetryLock)) return poetryLock;

    // Go
    const goSum = join(modulePath, 'go.sum');
    if (existsSync(goSum)) return goSum;

    return null;
  }

  private getInstallCommand(module: Module): string | null {
    if (module.type !== 'workspace') return null;

    // Check if user defined a specific install command (future feature)
    // For now, infer from package manager
    const pm = module.packageManager === 'auto' ? 'npm' : module.packageManager;

    switch (pm) {
      case 'npm':
        return 'npm install';
      case 'yarn':
        return 'yarn install';
      case 'pnpm':
        return 'pnpm install';
      case 'bun':
        return 'bun install';
      default:
        return 'npm install';
    }
  }

  /**
   * Check if dependencies need installation and run install if necessary
   */
  async checkAndInstall(module: Module, force: boolean = false): Promise<boolean> {
    if (module.type !== 'workspace') return true;

    const lockfilePath = await this.getLockFile(
      module.path,
      module.packageManager === 'auto' ? undefined : module.packageManager
    );

    if (!lockfilePath) {
      // No lockfile found, can't track. Might verify `node_modules` existence in future.
      return true;
    }

    try {
      const currentHash = await computeFileHash(lockfilePath);
      const cached = this.hashes[module.name];

      if (!force && cached?.hash === currentHash && cached.lockfile === lockfilePath) {
        // Hash matches, skip install
        console.log(`${icons.check} ${colors.dim(`Dependencies up-to-date for ${module.name}`)}`);
        return true;
      }

      // Hash mismatch or force, install needed
      const installCmd = this.getInstallCommand(module);
      if (!installCmd) return true;

      console.log(`${icons.info} ${colors.cyan(`Installing dependencies for ${module.name}...`)}`);

      const result = await this.processManager.spawn({
        id: `install-${module.name}-${Date.now()}`,
        command: installCmd,
        cwd: module.path,
        logFile: `./tmp/${module.name}-install.log`,
      });

      // Wait for process to finish (ProcessManager.spawn returns immediately)
      // We need a way to wait. For now, we might need to assume sync or poll logic.
      // Or change ProcessManager to support await on exit.
      // Actually, standard spawn in node returns child process.
      // Our manager returns { success, processInfo }.
      // We need to implement a wait mechanism in ProcessManager or here.

      // Temporary: rudimentary polling since we don't have waitForExit in ProcessManager yet
      // Ideally we should add waitForExit to ProcessManager

      if (result.success) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        await this.waitForProcess(result.processInfo!.id);
      }

      // Update cache
      this.hashes[module.name] = {
        lockfile: lockfilePath,
        hash: currentHash,
        lastChecked: new Date().toISOString(),
      };
      this.saveCache();

      console.log(`${icons.success} ${colors.green(`Dependencies installed for ${module.name}`)}`);
      return true;
    } catch (error) {
      console.error(
        `${icons.error} ${colors.error(`Failed to check/install dependencies for ${module.name}:`)}`,
        error
      );
      return false;
    }
  }

  private async waitForProcess(id: string): Promise<void> {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (!this.processManager.isRunning(id)) {
          clearInterval(interval);
          resolve();
        }
      }, 100);
    });
  }
}
