import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type ProjectType = 'monorepo' | 'single' | 'microservices';

export interface DetectedWorkspace {
  name: string;
  path: string;
  packageManager: PackageManager;
  hasDevScript: boolean;
  hasBuildScript: boolean;
  hasTestScript: boolean;
}

export interface DetectedDocker {
  composeFiles: string[];
  hasDockerfile: boolean;
}

export interface ProjectDetectionResult {
  projectType: ProjectType;
  workspaces: DetectedWorkspace[];
  docker: DetectedDocker;
  packageManager: PackageManager;
  rootPath: string;
}

/**
 * Detect package manager from lock files
 *
 * @param dir - Directory to check
 * @returns Detected package manager
 */
export function detectPackageManager(dir: string): PackageManager {
  if (existsSync(join(dir, 'bun.lockb'))) return 'bun';
  if (existsSync(join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(dir, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

/**
 * Check if a directory is a valid workspace with package.json
 *
 * @param dir - Directory path
 * @returns True if valid workspace
 */
function isValidWorkspace(dir: string): boolean {
  const packageJsonPath = join(dir, 'package.json');
  return existsSync(packageJsonPath);
}

/**
 * Parse package.json and extract scripts
 *
 * @param dir - Directory path
 * @returns Workspace information or null
 */
function parseWorkspace(dir: string, packageManager: PackageManager): DetectedWorkspace | null {
  const packageJsonPath = join(dir, 'package.json');

  if (!existsSync(packageJsonPath)) return null;

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      name?: string;
      scripts?: Record<string, string>;
    };

    const scripts = pkg.scripts ?? {};

    return {
      name: pkg.name ?? dir.split(/[/\\]/).pop() ?? 'unknown',
      path: dir,
      packageManager,
      hasDevScript: scripts['dev'] !== undefined || scripts['start'] !== undefined,
      hasBuildScript: scripts['build'] !== undefined,
      hasTestScript: scripts['test'] !== undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Detect Docker Compose files
 *
 * @param dir - Root directory
 * @returns Docker detection result
 */
function detectDocker(dir: string): DetectedDocker {
  const composeFiles: string[] = [];

  const possibleComposeFiles = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
    'docker-compose.dev.yml',
    'docker-compose.dev.yaml',
  ];

  for (const file of possibleComposeFiles) {
    if (existsSync(join(dir, file))) {
      composeFiles.push(file);
    }
  }

  const hasDockerfile = existsSync(join(dir, 'Dockerfile'));

  return { composeFiles, hasDockerfile };
}

/**
 * Detect monorepo workspaces from package.json
 *
 * @param dir - Root directory
 * @param packageManager - Package manager
 * @returns Array of detected workspaces
 */
function detectMonorepoWorkspaces(
  dir: string,
  packageManager: PackageManager
): DetectedWorkspace[] {
  const packageJsonPath = join(dir, 'package.json');

  if (!existsSync(packageJsonPath)) return [];

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content) as {
      workspaces?: string[] | { packages?: string[] };
    };

    let workspacePatterns: string[] = [];

    if (Array.isArray(pkg.workspaces)) {
      workspacePatterns = pkg.workspaces;
    } else if (pkg.workspaces?.packages) {
      workspacePatterns = pkg.workspaces.packages;
    }

    const workspaces: DetectedWorkspace[] = [];

    for (const pattern of workspacePatterns) {
      // Simple glob expansion for patterns like "apps/*" or "packages/*"
      if (pattern.endsWith('/*')) {
        const baseDir = pattern.slice(0, -2);
        const fullPath = join(dir, baseDir);

        if (!existsSync(fullPath)) continue;

        const entries = readdirSync(fullPath);

        for (const entry of entries) {
          const entryPath = join(fullPath, entry);
          const stat = statSync(entryPath);

          if (stat.isDirectory() && isValidWorkspace(entryPath)) {
            const workspace = parseWorkspace(entryPath, packageManager);
            if (workspace) workspaces.push(workspace);
          }
        }
      } else {
        // Direct path
        const fullPath = join(dir, pattern);
        if (isValidWorkspace(fullPath)) {
          const workspace = parseWorkspace(fullPath, packageManager);
          if (workspace) workspaces.push(workspace);
        }
      }
    }

    return workspaces;
  } catch {
    return [];
  }
}

/**
 * Detect standalone workspaces in common directories
 *
 * @param dir - Root directory
 * @param packageManager - Package manager
 * @returns Array of detected workspaces
 */
function detectStandaloneWorkspaces(
  dir: string,
  packageManager: PackageManager
): DetectedWorkspace[] {
  const workspaces: DetectedWorkspace[] = [];

  // Common workspace directories
  const commonDirs = ['apps', 'packages', 'services', 'backend', 'frontend', 'api', 'web'];

  for (const commonDir of commonDirs) {
    const fullPath = join(dir, commonDir);

    if (!existsSync(fullPath)) continue;

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      // Check if it's a workspace itself
      if (isValidWorkspace(fullPath)) {
        const workspace = parseWorkspace(fullPath, packageManager);
        if (workspace) workspaces.push(workspace);
      } else {
        // Check subdirectories
        try {
          const entries = readdirSync(fullPath);

          for (const entry of entries) {
            const entryPath = join(fullPath, entry);
            const entryStat = statSync(entryPath);

            if (entryStat.isDirectory() && isValidWorkspace(entryPath)) {
              const workspace = parseWorkspace(entryPath, packageManager);
              if (workspace) workspaces.push(workspace);
            }
          }
        } catch {
          // Ignore read errors
        }
      }
    }
  }

  return workspaces;
}

/**
 * Detect project structure and configuration
 *
 * @param rootPath - Root directory to analyze (defaults to cwd)
 * @returns Project detection result
 */
export function detectProject(rootPath: string = process.cwd()): ProjectDetectionResult {
  const packageManager = detectPackageManager(rootPath);
  const docker = detectDocker(rootPath);

  // Try monorepo detection first
  let workspaces = detectMonorepoWorkspaces(rootPath, packageManager);
  let projectType: ProjectType = 'monorepo';

  // If no monorepo workspaces found, try standalone detection
  if (workspaces.length === 0) {
    workspaces = detectStandaloneWorkspaces(rootPath, packageManager);

    if (workspaces.length === 0) {
      // Check if root is a workspace
      if (isValidWorkspace(rootPath)) {
        const rootWorkspace = parseWorkspace(rootPath, packageManager);
        if (rootWorkspace) {
          workspaces = [rootWorkspace];
          projectType = 'single';
        }
      }
    } else {
      projectType = workspaces.length > 1 ? 'microservices' : 'single';
    }
  }

  return {
    projectType,
    workspaces,
    docker,
    packageManager,
    rootPath,
  };
}
