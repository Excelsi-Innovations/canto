import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { diffEnvFiles } from '../../../src/utils/env-diff';
import { writeFileSync, unlinkSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('env-diff utility', () => {
  let tempDir: string;
  let envFile: string;
  let exampleFile: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'env-diff-test-'));
    envFile = join(tempDir, 'test.env');
    exampleFile = join(tempDir, 'test.env.example');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('should identify missing keys', () => {
    writeFileSync(envFile, 'EXISTING=1\n');
    writeFileSync(exampleFile, 'EXISTING=1\nMISSING_1=foo\nMISSING_2=bar\n');

    const result = diffEnvFiles(envFile, exampleFile);
    
    expect(result.missingKeys).toEqual(['MISSING_1', 'MISSING_2']);
    expect(result.currentKeys).toContain('EXISTING');
    expect(result.exampleKeys).toContain('MISSING_1');
  });

  it('should return empty list when no keys missing', () => {
    writeFileSync(envFile, 'KEY1=1\nKEY2=2\nEXTRA=3');
    writeFileSync(exampleFile, 'KEY1=1\nKEY2=2');

    const result = diffEnvFiles(envFile, exampleFile);

    expect(result.missingKeys).toHaveLength(0);
  });

  it('should handle missing files gracefully', () => {
    const result = diffEnvFiles(
      join(tempDir, 'nonexistent.env'),
      join(tempDir, 'nonexistent.env.example'),
    );
    expect(result.missingKeys).toHaveLength(0);
  });
});
