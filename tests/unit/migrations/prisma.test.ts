import { describe, it, expect, mock, beforeEach, spyOn } from 'bun:test';
import * as fs from 'node:fs';
import { PrismaDriver } from '../../../src/lib/migrations/drivers/prisma.js';
import { join } from 'node:path';

describe('PrismaDriver', () => {
  let driver: PrismaDriver;
  const cwd = '/tmp/test-project';
  
  const mockExec = mock(async (cmd: string) => {
    if (cmd.includes('status')) {
        return { 
          stdout: `
Status: 2 migrations found in prisma/migrations

20231026120000_init   (applied)
20231027143000_add_user (pending)
`, 
          stderr: '' 
        };
    }
    return { stdout: '', stderr: '' };
  });

  beforeEach(() => {
    mockExec.mockClear();
    driver = new PrismaDriver(mockExec);
  });
  
  it('should detect prisma project', async () => {
    const spy = spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (typeof path === 'string') {
        return path.includes('schema.prisma');
      }
      return false;
    });

    const isPrisma = await driver.detect(cwd);
    expect(isPrisma).toBe(true);
    expect(spy).toHaveBeenCalled();
    
    spy.mockRestore();
  });
  
  it('should parse status output correctly', async () => {
    const status = await driver.getStatus(cwd);
    
    expect(status).toHaveLength(2);
    expect(status[0].name).toBe('init');
    expect(status[0].status).toBe('applied');
    
    expect(status[1].name).toBe('add_user');
    expect(status[1].status).toBe('pending');
  });
  
  it('should execute apply command', async () => {
    await driver.apply(cwd);
    expect(mockExec).toHaveBeenCalledWith(expect.stringContaining('prisma migrate deploy'), expect.any(Object));
  });
});
