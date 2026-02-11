import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';

export interface EnvDiff {
  missingKeys: string[];
  exampleKeys: string[];
  currentKeys: string[];
}

/**
 * Compare current .env with .env.example (or similar)
 *
 * @param currentPath Path to current .env file
 * @param examplePath Path to example .env file
 * @returns Object containing missing keys
 */
export function diffEnvFiles(currentPath: string, examplePath: string): EnvDiff {
  const currentContent = existsSync(currentPath) ? readFileSync(currentPath, 'utf-8') : '';
  const exampleContent = existsSync(examplePath) ? readFileSync(examplePath, 'utf-8') : '';

  const current = parse(currentContent);
  const example = parse(exampleContent);

  const currentKeys = Object.keys(current);
  const exampleKeys = Object.keys(example);

  const missingKeys = exampleKeys.filter((key) => !currentKeys.includes(key));

  return {
    missingKeys,
    exampleKeys,
    currentKeys,
  };
}
