import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

/**
 * Compute SHA-256 hash of a file
 *
 * @param filePath Path to the file
 * @returns Hex string of the hash
 */
export async function computeFileHash(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  const hash = createHash('sha256');
  hash.update(content);
  return hash.digest('hex');
}
