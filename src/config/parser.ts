import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { parse as parseYAML } from 'yaml';
import { safeValidateConfig, type Config } from './schema.js';

const CONFIG_FILES = [
  'dev.config.yaml',
  'dev.config.yml',
  'dev.config.json',
  'dev.config.ts',
  'dev.config.js',
] as const;

export type ConfigFile = (typeof CONFIG_FILES)[number];

export class ConfigNotFoundError extends Error {
  constructor(searchPath: string) {
    super(
      `Configuration file not found in ${searchPath}. ` +
        `Expected one of: ${CONFIG_FILES.join(', ')}`
    );
    this.name = 'ConfigNotFoundError';
  }
}

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly file: string,
    public readonly zodError?: unknown
  ) {
    super(`Invalid configuration in ${file}: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

/**
 * Find configuration file in the given directory
 * Searches for dev.config.* files in order of precedence: YAML > JSON > TS/JS
 *
 * @param searchDir - Directory to search in (defaults to current working directory)
 * @returns Full path to config file, or null if not found
 */
export function findConfigFile(searchDir: string = process.cwd()): string | null {
  for (const file of CONFIG_FILES) {
    const fullPath = resolve(searchDir, file);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

function loadYAML(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  try {
    return parseYAML(content);
  } catch (error) {
    throw new ConfigValidationError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }
}

function loadJSON(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf-8');
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new ConfigValidationError(
      `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }
}

// ⚠️ Security warning: executes arbitrary code from config file
async function loadTSOrJS(filePath: string): Promise<unknown> {
  console.warn('WARNING: Loading TypeScript/JavaScript config file. This executes arbitrary code!');
  console.warn(`   File: ${filePath}`);
  console.warn('   Only proceed if you trust this configuration source.\n');

  try {
    const module = await import(filePath);
    return module.default ?? module;
  } catch (error) {
    throw new ConfigValidationError(
      `Failed to load TS/JS module: ${error instanceof Error ? error.message : String(error)}`,
      filePath
    );
  }
}

async function parseConfigFile(filePath: string): Promise<unknown> {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'yaml':
    case 'yml':
      return loadYAML(filePath);

    case 'json':
      return loadJSON(filePath);

    case 'ts':
    case 'js':
      return await loadTSOrJS(filePath);

    default:
      throw new ConfigValidationError(`Unsupported file extension: ${ext}`, filePath);
  }
}

/**
 * Load and validate configuration from file (async)
 * Supports YAML, JSON, TypeScript, and JavaScript config files
 *
 * @param searchDir - Directory to search for config file (defaults to cwd)
 * @param validate - Whether to validate against Zod schema (default: true)
 * @returns Parsed and validated configuration object
 * @throws {ConfigNotFoundError} When no config file is found
 * @throws {ConfigValidationError} When config is invalid or fails schema validation
 *
 * @example
 * const config = await loadConfig('./my-project');
 */
export async function loadConfig(
  searchDir: string = process.cwd(),
  validate: boolean = true
): Promise<Config> {
  const configPath = findConfigFile(searchDir);
  if (!configPath) {
    throw new ConfigNotFoundError(searchDir);
  }

  console.log(`📄 Loading configuration from: ${configPath}`);

  const rawConfig = await parseConfigFile(configPath);

  if (!validate) {
    return rawConfig as Config;
  }

  const result = safeValidateConfig(rawConfig);
  if (!result.success) {
    const formattedErrors = result.errors.issues
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new ConfigValidationError(
      `Configuration validation failed:\n${formattedErrors}`,
      configPath,
      result.errors
    );
  }

  console.log(`✅ Configuration validated successfully`);
  return result.data;
}

/**
 * Load and validate configuration from file (synchronous)
 * Only supports YAML and JSON files (TS/JS require async import)
 *
 * @param searchDir - Directory to search for config file (defaults to cwd)
 * @param validate - Whether to validate against Zod schema (default: true)
 * @returns Parsed and validated configuration object
 * @throws {Error} When attempting to load TS/JS config synchronously
 * @throws {ConfigNotFoundError} When no config file is found
 * @throws {ConfigValidationError} When config is invalid or fails schema validation
 *
 * @example
 * const config = loadConfigSync('./my-project');
 */
export function loadConfigSync(
  searchDir: string = process.cwd(),
  validate: boolean = true
): Config {
  const configPath = findConfigFile(searchDir);
  if (!configPath) {
    throw new ConfigNotFoundError(searchDir);
  }

  const ext = configPath.split('.').pop()?.toLowerCase();
  if (ext === 'ts' || ext === 'js') {
    throw new Error(
      'Cannot load TypeScript/JavaScript config synchronously. Use loadConfig() instead.'
    );
  }

  console.log(`📄 Loading configuration from: ${configPath}`);

  let rawConfig: unknown;
  if (ext === 'yaml' || ext === 'yml') {
    rawConfig = loadYAML(configPath);
  } else if (ext === 'json') {
    rawConfig = loadJSON(configPath);
  } else {
    throw new ConfigValidationError(`Unsupported file extension: ${ext}`, configPath);
  }

  if (!validate) {
    return rawConfig as Config;
  }

  const result = safeValidateConfig(rawConfig);
  if (!result.success) {
    const formattedErrors = result.errors.issues
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');

    throw new ConfigValidationError(
      `Configuration validation failed:\n${formattedErrors}`,
      configPath,
      result.errors
    );
  }

  console.log(`✅ Configuration validated successfully`);
  return result.data;
}
