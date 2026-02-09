import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';
import pc from 'picocolors';

/**
 * Environment variable entry
 */
export interface EnvVar {
  key: string;
  value: string;
  comment?: string;
  lineNumber: number;
}

/**
 * Environment file information
 */
export interface EnvFile {
  path: string;
  relativePath: string;
  exists: boolean;
  variables: EnvVar[];
  isExample: boolean;
}

/**
 * Port information detected from env files
 */
export interface PortInfo {
  key: string;
  value: number;
  source: string; // file path
  module?: string; // associated module
}

/**
 * Parse a .env file and extract variables
 *
 * @param filePath - Path to .env file
 * @returns Array of environment variables
 */
export function parseEnvFile(filePath: string): EnvVar[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const variables: EnvVar[] = [];

    let currentComment: string | undefined;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Skip empty lines
      if (trimmed === '') {
        currentComment = undefined;
        return;
      }

      // Capture comments
      if (trimmed.startsWith('#')) {
        currentComment = trimmed.substring(1).trim();
        return;
      }

      // Parse variable (KEY=VALUE or KEY="VALUE" or KEY='VALUE')
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        const key = match[1] ?? '';
        const rawValue = match[2] ?? '';
        let value = rawValue.trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.substring(1, value.length - 1);
        }

        variables.push({
          key,
          value,
          comment: currentComment,
          lineNumber: index + 1,
        });

        currentComment = undefined;
      }
    });

    return variables;
  } catch (error) {
    console.error(pc.yellow(`⚠️  Failed to parse ${filePath}: ${error}`));
    return [];
  }
}

/**
 * Detect all .env files in a directory (recursively)
 *
 * @param rootDir - Root directory to search
 * @param maxDepth - Maximum recursion depth (default: 3)
 * @returns Array of .env file paths
 */
export function detectEnvFiles(rootDir: string, maxDepth = 3): EnvFile[] {
  const envFiles: EnvFile[] = [];
  const rootPath = resolve(rootDir);

  function searchDir(dir: string, depth: number) {
    if (depth > maxDepth) return;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        // Skip node_modules, .git, dist, build, etc.
        if (
          entry.name === 'node_modules' ||
          entry.name === '.git' ||
          entry.name === 'dist' ||
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === 'coverage'
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          searchDir(fullPath, depth + 1);
        } else if (entry.isFile() && entry.name.match(/^\.env/)) {
          const variables = parseEnvFile(fullPath);
          envFiles.push({
            path: fullPath,
            relativePath: relative(rootPath, fullPath),
            exists: true,
            variables,
            isExample: entry.name.includes('example') || entry.name.includes('template'),
          });
        }
      }
    } catch (_error) {
      // Silently skip directories we can't read
    }
  }

  searchDir(rootPath, 0);
  return envFiles;
}

/**
 * Detect ports from environment variables
 *
 * @param envFiles - Array of environment files
 * @returns Array of port information
 */
export function detectPorts(envFiles: EnvFile[]): PortInfo[] {
  const ports: PortInfo[] = [];

  for (const file of envFiles) {
    for (const variable of file.variables) {
      // Check if variable key contains PORT
      if (variable.key.toUpperCase().includes('PORT')) {
        const portValue = parseInt(variable.value, 10);
        if (!isNaN(portValue) && portValue > 0 && portValue < 65536) {
          ports.push({
            key: variable.key,
            value: portValue,
            source: file.relativePath,
          });
        }
      }
    }
  }

  return ports;
}

/**
 * Compare two env files and find missing/extra variables
 *
 * @param actualFile - Actual .env file (e.g., .env)
 * @param exampleFile - Example .env file (e.g., .env.example)
 * @returns Comparison result
 */
export function compareEnvFiles(
  actualFile: EnvFile,
  exampleFile: EnvFile
): {
  missing: string[]; // Keys in example but not in actual
  extra: string[]; // Keys in actual but not in example
  common: string[]; // Keys in both
} {
  const actualKeys = new Set(actualFile.variables.map((v) => v.key));
  const exampleKeys = new Set(exampleFile.variables.map((v) => v.key));

  const missing = Array.from(exampleKeys).filter((key) => !actualKeys.has(key));
  const extra = Array.from(actualKeys).filter((key) => !exampleKeys.has(key));
  const common = Array.from(actualKeys).filter((key) => exampleKeys.has(key));

  return { missing, extra, common };
}

/**
 * Find .env.example for a given .env file
 *
 * @param envPath - Path to .env file
 * @returns Path to .env.example if found, null otherwise
 */
export function findEnvExample(envPath: string): string | null {
  const dir = dirname(envPath);
  const possibleNames = ['.env.example', '.env.template', '.env.sample', '.env.dist'];

  for (const name of possibleNames) {
    const examplePath = join(dir, name);
    if (existsSync(examplePath)) {
      return examplePath;
    }
  }

  return null;
}

/**
 * Validate environment variables against required keys
 *
 * @param envFile - Environment file to validate
 * @param requiredKeys - Array of required variable keys
 * @returns Validation result
 */
export function validateEnv(
  envFile: EnvFile,
  requiredKeys: string[]
): {
  valid: boolean;
  missing: string[];
  empty: string[]; // Keys that exist but have empty values
} {
  const actualKeys = new Map(envFile.variables.map((v) => [v.key, v.value]));
  const missing: string[] = [];
  const empty: string[] = [];

  for (const key of requiredKeys) {
    if (!actualKeys.has(key)) {
      missing.push(key);
    } else if (actualKeys.get(key)?.trim() === '') {
      empty.push(key);
    }
  }

  return {
    valid: missing.length === 0 && empty.length === 0,
    missing,
    empty,
  };
}

/**
 * Group environment files by directory
 *
 * @param envFiles - Array of environment files
 * @returns Map of directory to env files
 */
export function groupEnvFilesByDirectory(envFiles: EnvFile[]): Map<string, EnvFile[]> {
  const groups = new Map<string, EnvFile[]>();

  for (const file of envFiles) {
    const dir = dirname(file.relativePath);
    const existing = groups.get(dir) ?? [];
    existing.push(file);
    groups.set(dir, existing);
  }

  return groups;
}

/**
 * Extract module association from .env file path
 * e.g., apps/backend/.env -> backend
 *
 * @param envPath - Path to .env file
 * @returns Module name or null
 */
export function extractModuleFromPath(envPath: string): string | null {
  const parts = envPath.split(/[\\/]/);

  // Look for common directory patterns
  const moduleIndex = parts.findIndex((p) =>
    ['apps', 'packages', 'services', 'modules'].includes(p)
  );

  if (moduleIndex !== -1 && moduleIndex < parts.length - 1) {
    return parts[moduleIndex + 1] ?? null;
  }

  // Fallback: use parent directory name
  if (parts.length > 1) {
    return parts[parts.length - 2] ?? null;
  }

  return null;
}
