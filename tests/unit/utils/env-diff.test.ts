import { describe, it, expect } from 'bun:test';
import { diffEnvFiles } from '../../../src/utils/env-diff';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('env-diff utility', () => {
  const envFile = join(process.cwd(), 'test.env');
  const exampleFile = join(process.cwd(), 'test.env.example');

  const cleanup = () => {
    if (existsSync(envFile)) unlinkSync(envFile);
    if (existsSync(exampleFile)) unlinkSync(exampleFile);
  };

  it('should identify missing keys', () => {
    writeFileSync(envFile, 'EXISTING=1\n');
    writeFileSync(exampleFile, 'EXISTING=1\nMISSING_1=foo\nMISSING_2=bar\n');

    const result = diffEnvFiles(envFile, exampleFile);
    
    expect(result.missingKeys).toEqual(['MISSING_1', 'MISSING_2']);
    expect(result.currentKeys).toContain('EXISTING');
    expect(result.exampleKeys).toContain('MISSING_1');
    
    cleanup();
  });

  it('should return empty list when no keys missing', () => {
    writeFileSync(envFile, 'KEY1=1\nKEY2=2\nEXTRA=3');
    writeFileSync(exampleFile, 'KEY1=1\nKEY2=2');

    const result = diffEnvFiles(envFile, exampleFile);

    expect(result.missingKeys).toHaveLength(0);
    
    cleanup();
  });

  it('should handle missing files gracefully', () => {
    cleanup(); // Ensure files don't exist
    const result = diffEnvFiles(envFile, exampleFile);
    expect(result.missingKeys).toHaveLength(0);
  });
});
