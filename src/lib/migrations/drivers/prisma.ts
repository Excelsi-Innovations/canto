import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { type IMigrationDriver } from '../driver.interface.js';
import { type Migration, type MigrationStatus } from '../types.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const defaultExecAsync = promisify(exec);

export class PrismaDriver implements IMigrationDriver {
  name = 'prisma';
  label = 'Prisma ORM';

  capabilities = {
    canRollback: false, // Prisma doesn't support 'down' migrations easily
    canGenerate: true,
    canReset: true,
  };

  private execAsync: (
    command: string,
    options?: Record<string, unknown>
  ) => Promise<{ stdout: string; stderr: string }>;

  constructor(
    execImpl?: (
      command: string,
      options?: Record<string, unknown>
    ) => Promise<{ stdout: string; stderr: string }>
  ) {
    this.execAsync =
      execImpl ??
      (defaultExecAsync as unknown as (
        command: string,
        options?: Record<string, unknown>
      ) => Promise<{ stdout: string; stderr: string }>);
  }

  async detect(cwd: string): Promise<boolean> {
    this.projectRoot = null; // Reset for each call
    // 1. Check root
    if (this.checkPath(join(cwd, 'prisma', 'schema.prisma'), cwd)) return true;
    if (this.checkPath(join(cwd, 'schema.prisma'), cwd)) return true;

    // 2. Monorepo / Sub-directory detection
    const commonDirs = ['packages', 'apps', 'services', 'backend'];

    for (const dir of commonDirs) {
      const basePath = join(cwd, dir);
      if (existsSync(basePath)) {
        try {
          if (statSync(basePath).isDirectory()) {
            const subdirs = readdirSync(basePath);
            for (const sub of subdirs) {
              const subPath = join(basePath, sub);
              if (existsSync(subPath) && statSync(subPath).isDirectory()) {
                // Check packages/foo/prisma/schema.prisma
                if (this.checkPath(join(subPath, 'prisma', 'schema.prisma'), subPath)) return true;
                // Check packages/foo/schema.prisma
                if (this.checkPath(join(subPath, 'schema.prisma'), subPath)) return true;
              }
            }
          }
        } catch {
          // Ignore access errors
        }
      }
    }

    return false;
  }

  private projectRoot: string | null = null;

  private checkPath(schemaPath: string, root: string): boolean {
    if (existsSync(schemaPath)) {
      this.projectRoot = root;
      return true;
    }
    return false;
  }

  /**
   * Execute command in the detected root if available, otherwise use provided cwd
   */
  private async run(command: string, cwd: string): Promise<{ stdout: string; stderr: string }> {
    const workingDir = this.projectRoot ?? cwd;
    return this.execAsync(command, { cwd: workingDir });
  }
  async getStatus(cwd: string): Promise<Migration[]> {
    try {
      // Use 'prisma migrate status' to get raw status
      // Note: This command fails if DB is unreachable.
      // We might need a more robust way, but this is V1.
      const { stdout } = await this.run('npx prisma migrate status', cwd);
      return this.parseStatusOutput(stdout);
    } catch (_error: unknown) {
      // const message = error instanceof Error ? error.message : String(error);
      // console.warn('Prisma migrate status failed:', message);

      // Fallback: Read local migration files if DB is unreachable
      // This won't show 'applied' status correctly but at least shows files
      return this.getLocalMigrations(cwd);
    }
  }

  async apply(cwd: string): Promise<void> {
    await this.run('npx prisma migrate deploy', cwd);
  }

  async reset(cwd: string): Promise<void> {
    // forceful reset
    await this.run('npx prisma migrate reset --force', cwd);
  }

  async generate(cwd: string, name: string): Promise<string> {
    const { stdout } = await this.run(`npx prisma migrate dev --name ${name} --create-only`, cwd);
    return stdout;
  }

  private parseStatusOutput(output: string): Migration[] {
    const migrations: Migration[] = [];

    // Prisma output format varies, but usually lists migrations.
    // This is a naive parser for V1.
    // Enhancing this requires parsing the table output or JSON if available (unstable).

    // Example output to parse:
    // Status: 3 migrations found in prisma/migrations
    //
    // 20231026120000_init   (applied)
    // 20231027143000_add_user (pending)

    const lines = output.split('\n');
    const regex = /^(\d+)_(\w+)\s+\((applied|pending)\)/;

    // Use current time for timestamp approximation if parsing details fails
    // Ideally we parse the timestamp from the ID '20231026...'

    for (const line of lines) {
      const match = line.trim().match(regex);
      if (match) {
        const [_, id, name, statusRaw] = match as unknown as [string, string, string, string];

        let status: MigrationStatus = 'pending';
        if (statusRaw === 'applied') status = 'applied';

        migrations.push({
          id: `${id}_${name}`,
          name,
          timestamp: this.parseTimestampFromId(id),
          status,
          appliedAt: status === 'applied' ? new Date() : undefined, // We don't know exact applied time from thisCLI
        });
      }
    }

    return migrations;
  }

  private getLocalMigrations(_cwd: string): Migration[] {
    // Fallback detection
    // TODO: Implement fs scan of prisma/migrations folder
    return [];
  }

  private parseTimestampFromId(id: string): Date {
    // Format: YYYYMMDDHHmmss
    try {
      const year = parseInt(id.substring(0, 4));
      const month = parseInt(id.substring(4, 6)) - 1;
      const day = parseInt(id.substring(6, 8));
      const hour = parseInt(id.substring(8, 10));
      const min = parseInt(id.substring(10, 12));
      const sec = parseInt(id.substring(12, 14));
      return new Date(year, month, day, hour, min, sec);
    } catch {
      return new Date();
    }
  }
}
