import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Task {
  id: string; // unique id (e.g., npm:build)
  name: string; // display name (e.g., build)
  source: 'npm' | 'makefile' | 'justfile' | 'deno' | 'bun' | 'pnpm' | 'yarn';
  command: string; // actual command to run
  description?: string;
}

export class TaskScanner {
  private cwd: string;

  constructor(cwd: string = process.cwd()) {
    this.cwd = cwd;
  }

  async scan(): Promise<Task[]> {
    const taskMap = new Map<string, Task>();

    // 1. Scan package.json
    for (const task of this.scanPackageJson()) {
      taskMap.set(task.id, task);
    }

    // 2. Scan Makefile
    for (const task of this.scanMakefile()) {
      if (!taskMap.has(task.id)) {
        taskMap.set(task.id, task);
      }
    }

    // 3. Scan Justfile (future)
    // const justTasks = this.scanJustfile();

    return Array.from(taskMap.values());
  }

  private detectPackageManager(): string {
    if (existsSync(join(this.cwd, 'bun.lockb')) || existsSync(join(this.cwd, 'bun.lock')))
      return 'bun';
    if (existsSync(join(this.cwd, 'pnpm-lock.yaml'))) return 'pnpm';
    if (existsSync(join(this.cwd, 'yarn.lock'))) return 'yarn';
    return 'npm';
  }

  private scanPackageJson(): Task[] {
    const pkgPath = join(this.cwd, 'package.json');
    if (!existsSync(pkgPath)) return [];

    const pm = this.detectPackageManager();

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (!pkg.scripts) return [];

      return Object.entries(pkg.scripts).map(([name, command]) => ({
        id: `${pm}:${name}`,
        name,
        source: pm as Task['source'],
        command: String(command),
        description: `Run ${pm} script: ${name}`,
      }));
    } catch {
      return [];
    }
  }

  private scanMakefile(): Task[] {
    const makePath = join(this.cwd, 'Makefile');
    if (!existsSync(makePath)) return [];

    try {
      const content = readFileSync(makePath, 'utf-8');
      const tasks: Task[] = [];
      const seen = new Set<string>();
      const lines = content.split('\n');

      for (const line of lines) {
        // Regex to find targets: "target:" or "target: dependencies"
        // Exclude .PHONY and hidden targets
        const match = line.match(/^([a-zA-Z0-9_-]+):/);
        if (match?.[1] && !match[1].startsWith('.') && !seen.has(match[1])) {
          const name = match[1];
          seen.add(name);
          tasks.push({
            id: `make:${name}`,
            name,
            source: 'makefile',
            command: `make ${name}`,
            description: `Run make target: ${name}`,
          });
        }
      }

      return tasks;
    } catch {
      return [];
    }
  }
}
