import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { computeFileHash } from '../../../src/utils/hashing';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('hashing utility', () => {
  const testFile = join(process.cwd(), 'test-hash.txt');

  afterEach(() => {
    if (existsSync(testFile)) {
      unlinkSync(testFile);
    }
  });

  it('should compute correct SHA-256 hash', async () => {
    writeFileSync(testFile, 'hello world');
    const hash = await computeFileHash(testFile);
    // sha256 of "hello world"
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('should change hash when content changes', async () => {
    writeFileSync(testFile, 'content 1');
    const hash1 = await computeFileHash(testFile);
    
    writeFileSync(testFile, 'content 2');
    const hash2 = await computeFileHash(testFile);

    expect(hash1).not.toBe(hash2);
  });
});
