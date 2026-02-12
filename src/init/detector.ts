import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type ProjectType = 'monorepo' | 'single' | 'microservices';
export type WorkspaceCategory = 'app' | 'lib' | 'worker' | 'infra';

export interface DetectedWorkspace {
  name: string;
  path: string; // Relative path from root
  packageManager: PackageManager;
  category: WorkspaceCategory;
  hasDevScript: boolean;
  hasBuildScript: boolean;
  hasTestScript: boolean;
  workerEntryPoints: string[]; // e.g. ["src/worker.ts"]
  envFiles: string[]; // e.g. [".env", ".env.example"]
  nodeVersion?: string;
  dependencies?: string[];
  devDependencies?: string[];
}

export interface DetectedDockerService {
  name: string;
  image?: string;
  ports?: string[];
}

export interface DetectedDocker {
  composeFiles: string[];
  hasDockerfile: boolean;
  services: DetectedDockerService[];
}

export interface ProjectDetectionResult {
  projectType: ProjectType;
  workspaces: DetectedWorkspace[];
  docker: DetectedDocker;
  packageManager: PackageManager;
  rootPath: string;
  nodeVersion?: string;
  rootScripts: Record<string, string>;
}

/**
 * Detect package manager from lock files
 */
export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'bun.lockb')) || existsSync(join(dir, 'bun.lock'))) return 'bun';
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Detect Node version from multiple sources
 */
function detectNodeVersion(dir: string): string | undefined {
  // 1. Check engines.node in package.json
  try {
    const pkgPath = join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      if (pkg.engines?.node) return pkg.engines.node;
    }
  } catch {
    // ignore
  }

  // 2. Check .nvmrc
  try {
    const nvmrcPath = join(dir, '.nvmrc');
    if (existsSync(nvmrcPath)) {
      return readFileSync(nvmrcPath, 'utf-8').trim();
    }
  } catch {
    // ignore
  }

  // 3. Check .node-version
  try {
    const nodeVersionPath = join(dir, '.node-version');
    if (existsSync(nodeVersionPath)) {
      return readFileSync(nodeVersionPath, 'utf-8').trim();
    }
  } catch {
    // ignore
  }

  return undefined;
}

/**
 * Detect environment files in a directory
 */
function detectEnvFiles(dir: string): string[] {
  try {
    return readdirSync(dir).filter((f) => f.startsWith('.env'));
  } catch {
    return [];
  }
}

/**
 * Check for worker entry points (worker.ts, consumer.ts)
 */
function detectWorkerEntryPoints(dir: string): string[] {
  const entryPoints: string[] = [];
  const srcDir = join(dir, 'src');

  if (existsSync(srcDir)) {
    try {
      const files = readdirSync(srcDir);
      for (const file of files) {
        if (
          file.match(/^(worker|consumer|queue|job).*\.ts$/) &&
          !file.endsWith('.spec.ts') &&
          !file.endsWith('.test.ts')
        ) {
          entryPoints.push(join('src', file).replace(/\\/g, '/'));
        }
      }
    } catch {
      // ignore
    }
  }
  return entryPoints;
}

/**
 * Determine workspace category based on heuristics
 */
function detectCategory(
  workspace: Omit<DetectedWorkspace, 'category'> & { hasWorkerScript: boolean }
): WorkspaceCategory {
  const path = workspace.path.replace(/\\/g, '/');
  const name = workspace.name.toLowerCase();

  // 1. Explicit directory naming
  if (path.includes('packages/') || path.includes('libs/')) return 'lib';
  if (
    path.includes('apps/') ||
    path.includes('services/') ||
    path.includes('backend') ||
    path.includes('frontend') ||
    path.includes('web') ||
    path.includes('api')
  ) {
    if (name.includes('worker') || workspace.hasWorkerScript) {
      // It might be a worker app
      // But if it has a 'dev' script it's likely an app that CAN act as a worker or has a worker mode
      // If it ONLY has worker script and NO dev script, it's definitely a worker
      if (!workspace.hasDevScript && workspace.hasWorkerScript) return 'worker';

      // If it matches worker naming conventions strictly
      if (name.endsWith('-worker') || name.includes('consumer')) return 'worker';
    }
    return 'app';
  }

  // 2. Script indications
  if (workspace.hasDevScript) return 'app';
  if (workspace.hasWorkerScript) return 'worker';

  // 3. Default fallback
  return 'lib';
}

/**
 * Parse package.json and extract details
 */
function parseWorkspace(
  dir: string,
  packageManager: PackageManager,
  rootDir: string
): DetectedWorkspace | null {
  const packageJsonPath = join(dir, 'package.json');

  if (!existsSync(packageJsonPath)) return null;

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      name?: string;
      scripts?: Record<string, string>;
      engines?: { node?: string };
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const scripts = pkg.scripts ?? {};
    const relativePath = dir === rootDir ? '.' : dir.replace(rootDir, '').replace(/^[/\\]+/, '');

    const hasDevScript = scripts['dev'] !== undefined || scripts['start'] !== undefined;
    const hasWorkerScript = Object.keys(scripts).some(
      (s) => s.includes('worker') || s.includes('consumer')
    );
    const workerEntryPoints = detectWorkerEntryPoints(dir);

    // Check for @nestjs/bullmq or similar worker deps
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    const hasWorkerDep = Object.keys(allDeps).some(
      (d) => d.includes('bullmq') || d.includes('rabbitmq') || d.includes('kafka')
    );

    const tempWorkspace = {
      name: pkg.name ?? basename(dir),
      path: relativePath, // Standardize to relative path
      packageManager,
      hasDevScript,
      hasBuildScript: scripts['build'] !== undefined,
      hasTestScript: scripts['test'] !== undefined,
      workerEntryPoints,
      envFiles: detectEnvFiles(dir),
      nodeVersion: pkg.engines?.node,
      dependencies: Object.keys(pkg.dependencies ?? {}),
      devDependencies: Object.keys(pkg.devDependencies ?? {}),
    };

    return {
      ...tempWorkspace,
      category: detectCategory({
        ...tempWorkspace,
        hasWorkerScript: hasWorkerScript || (hasWorkerDep && workerEntryPoints.length > 0),
      }),
    };
  } catch {
    return null;
  }
}

/**
 * Parse Docker Compose file to extract services
 */
function parseDockerCompose(filePath: string): DetectedDockerService[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseYaml(content) as {
      services?: Record<string, { image?: string; ports?: string[] }>;
    };

    if (!parsed.services) return [];

    return Object.entries(parsed.services).map(([name, config]) => ({
      name,
      image: config.image,
      ports: config.ports?.map(String),
    }));
  } catch {
    return [];
  }
}

/**
 * Detect Docker Compose files and services
 */
function detectDocker(dir: string, maxDepth = 3): DetectedDocker {
  const composeFiles: string[] = [];
  let hasDockerfile = false;
  const services: DetectedDockerService[] = [];

  const possibleComposeFiles = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    'docker-compose.dev.yml',
    'docker-compose.dev.yaml',
  ];

  const searchDir = (currentDir: string, depth: number): void => {
    if (depth > maxDepth) return;

    try {
      // Check for compose files
      for (const file of possibleComposeFiles) {
        const fullPath = join(currentDir, file);
        if (existsSync(fullPath)) {
          const relativePath =
            currentDir === dir
              ? file
              : join(currentDir.replace(dir, '').slice(1), file).replace(/\\/g, '/');

          if (!composeFiles.includes(relativePath)) {
            composeFiles.push(relativePath);
            // Parse services
            const foundServices = parseDockerCompose(fullPath);
            services.push(...foundServices);
          }
        }
      }

      // Check for Dockerfile
      if (!hasDockerfile && existsSync(join(currentDir, 'Dockerfile'))) {
        hasDockerfile = true;
      }

      // Recursively search common infra dirs
      if (depth < maxDepth) {
        const commonInfraDirs = [
          'infra',
          'infrastructure',
          'docker',
          'deployments',
          '.docker',
          'apps',
          'packages',
        ];

        // Also allow searching root-level directories initially
        const dirsToSearch =
          depth === 0
            ? readdirSync(currentDir).filter((d) => {
                const s = statSync(join(currentDir, d));
                return s.isDirectory() && !d.startsWith('.') && d !== 'node_modules';
              })
            : commonInfraDirs;

        for (const subdir of dirsToSearch) {
          // If we are searching specific common infra dirs
          if (depth > 0 && !commonInfraDirs.includes(subdir)) continue;

          const subdirPath = join(currentDir, subdir);
          if (existsSync(subdirPath) && statSync(subdirPath).isDirectory()) {
            searchDir(subdirPath, depth + 1);
          }
        }
      }
    } catch {
      // Ignore
    }
  };

  searchDir(dir, 0);

  return { composeFiles, hasDockerfile, services };
}

/**
 * Detect workspaces from pnpm-workspace.yaml
 */
function detectPnpmWorkspaces(dir: string, packageManager: PackageManager): DetectedWorkspace[] {
  const workspaceYamlPath = join(dir, 'pnpm-workspace.yaml');
  if (!existsSync(workspaceYamlPath)) return [];

  try {
    const content = readFileSync(workspaceYamlPath, 'utf-8');
    const yaml = parseYaml(content) as { packages?: string[] };
    const patterns = yaml.packages ?? [];
    return scanWorkspacePatterns(dir, patterns, packageManager);
  } catch {
    return [];
  }
}

/**
 * Scan workspace patterns (glob-like)
 */
function scanWorkspacePatterns(
  rootDir: string,
  patterns: string[],
  packageManager: PackageManager
): DetectedWorkspace[] {
  const workspaces: DetectedWorkspace[] = [];
  const seenPaths = new Set<string>();

  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      // "packages/*"
      const baseDir = join(rootDir, pattern.replace('/*', ''));
      if (existsSync(baseDir)) {
        try {
          const items = readdirSync(baseDir);
          for (const item of items) {
            const itemPath = join(baseDir, item);
            if (statSync(itemPath).isDirectory() && existsSync(join(itemPath, 'package.json'))) {
              if (seenPaths.has(itemPath)) continue;
              const ws = parseWorkspace(itemPath, packageManager, rootDir);
              if (ws) {
                workspaces.push(ws);
                seenPaths.add(itemPath);
              }
            }
          }
        } catch {
          // ignore
        }
      }
    } else {
      // Exact path or other glob (simplified support for now)
      const fullPath = join(rootDir, pattern);
      if (
        existsSync(fullPath) &&
        statSync(fullPath).isDirectory() &&
        existsSync(join(fullPath, 'package.json'))
      ) {
        if (seenPaths.has(fullPath)) continue;
        const ws = parseWorkspace(fullPath, packageManager, rootDir);
        if (ws) {
          workspaces.push(ws);
          seenPaths.add(fullPath);
        }
      }
    }
  }
  return workspaces;
}

/**
 * Detect project structure
 */
export function detectProject(rootPath: string = process.cwd()): ProjectDetectionResult {
  const packageManager = detectPackageManager(rootPath);
  const docker = detectDocker(rootPath);
  const nodeVersion = detectNodeVersion(rootPath);

  // Root scripts
  let rootScripts: Record<string, string> = {};
  if (existsSync(join(rootPath, 'package.json'))) {
    try {
      const pkg = JSON.parse(readFileSync(join(rootPath, 'package.json'), 'utf-8'));
      rootScripts = pkg.scripts ?? {};
    } catch {
      // ignore
    }
  }

  let workspaces: DetectedWorkspace[] = [];
  let projectType: ProjectType = 'monorepo';

  // 1. Try pnpm workspaces
  if (packageManager === 'pnpm') {
    workspaces = detectPnpmWorkspaces(rootPath, packageManager);
  }

  // 2. Try package.json workspaces (npm/yarn/bun)
  if (workspaces.length === 0) {
    if (existsSync(join(rootPath, 'package.json'))) {
      try {
        const pkg = JSON.parse(readFileSync(join(rootPath, 'package.json'), 'utf-8'));
        if (pkg.workspaces) {
          const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages;
          if (patterns) {
            workspaces = scanWorkspacePatterns(rootPath, patterns, packageManager);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  // 3. Fallback: Standalone detection in common dirs
  if (workspaces.length === 0) {
    const commonDirs = ['apps', 'packages', 'services', 'backend', 'frontend', 'api', 'web'];
    const patterns = commonDirs.map((d) => `${d}/*`);
    // Also allow root if no subdirs found
    workspaces = scanWorkspacePatterns(rootPath, patterns, packageManager);

    if (workspaces.length === 0 && existsSync(join(rootPath, 'package.json'))) {
      const rootWs = parseWorkspace(rootPath, packageManager, rootPath);
      if (rootWs) {
        workspaces = [rootWs];
        projectType = 'single';
      }
    }
  }

  if (workspaces.length > 0 && projectType !== 'single') {
    projectType = workspaces.length > 1 ? 'monorepo' : 'single';
    // Heuristic: if it has packages/ dir it's definitely monorepo-ish
    if (workspaces.some((w) => w.path.startsWith('packages/'))) projectType = 'monorepo';
  }

  // Handle embedded workers (sibling modules)
  // For each workspace, if it has a detected worker entry point but wasn't categorized as 'worker',
  // we conceptually tag it. The ComposerState will split it if needed, or we can split it here.
  // To keep detector pure, we just pass the info (workerEntryPoints) and let the Composer State split it.

  return {
    projectType,
    workspaces,
    docker,
    packageManager,
    rootPath,
    nodeVersion,
    rootScripts,
  };
}

// Zod Schemas for validation
export const PackageManagerSchema = z.enum(['npm', 'yarn', 'pnpm', 'bun']);
export const ProjectTypeSchema = z.enum(['monorepo', 'single', 'microservices']);
export const WorkspaceCategorySchema = z.enum(['app', 'lib', 'worker', 'infra']);

export const DetectedWorkspaceSchema = z.object({
  name: z.string(),
  path: z.string(),
  packageManager: PackageManagerSchema,
  category: WorkspaceCategorySchema,
  hasDevScript: z.boolean(),
  hasBuildScript: z.boolean(),
  hasTestScript: z.boolean(),
  workerEntryPoints: z.array(z.string()),
  envFiles: z.array(z.string()),
  nodeVersion: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  devDependencies: z.array(z.string()).optional(),
});

export const DetectedDockerServiceSchema = z.object({
  name: z.string(),
  image: z.string().optional(),
  ports: z.array(z.string()).optional(),
});

export const DetectedDockerSchema = z.object({
  composeFiles: z.array(z.string()),
  hasDockerfile: z.boolean(),
  services: z.array(DetectedDockerServiceSchema),
});

export const ProjectDetectionResultSchema = z.object({
  projectType: ProjectTypeSchema,
  workspaces: z.array(DetectedWorkspaceSchema),
  docker: DetectedDockerSchema,
  packageManager: PackageManagerSchema,
  rootPath: z.string(),
  nodeVersion: z.string().optional(),
  rootScripts: z.record(z.string(), z.string()),
});

