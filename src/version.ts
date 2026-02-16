import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion: string | null = null;

export function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    const __dirname = fileURLToPath(new URL('.', import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
    cachedVersion = pkg.version;
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export const VERSION = getVersion();
export const version = VERSION;
