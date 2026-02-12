import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { MigrationService } from '../../../src/lib/migrations/service.js';
import { type IMigrationDriver } from '../../../src/lib/migrations/driver.interface.js';

describe('MigrationService', () => {
    let service: MigrationService;
    const mockDriver: IMigrationDriver = {
        name: 'mock',
        label: 'Mock Driver',
        capabilities: {
            canGenerate: true,
            canRollback: true,
            canReset: true,
        },
        detect: mock(async () => true),
        getStatus: mock(async () => []),
        apply: mock(async () => {}),
        reset: mock(async () => {}),
        rollback: mock(async () => {}),
        generate: mock(async () => 'ok'),
    };

    beforeEach(() => {
        // Singleton reset logic? Ideally we'd reset the instance but it's private.
        // For unit testing singletons we might need to expose a reset method or use a fresh instance logic if possible.
        // Or just rely on re-registering the driver.
        // Actually, `getInstance` returns the same instance.
        // Let's interact with the singleton as is, but maybe clear its drivers?
        // Service doesn't expose list of drivers publicly or clear method.
        // We can just add our mock driver.
        service = MigrationService.getInstance();
        service.clearDrivers(); // Remove default PrismaDriver
        service.registerDriver(mockDriver);
    });

    it('should detect and set active driver', async () => {
        const cwd = '/tmp/test';
        const detected = await service.detect(cwd);
        expect(detected).toBe(mockDriver);
        expect(service.getActiveDriver()).toBe(mockDriver);
        expect(mockDriver.detect).toHaveBeenCalledWith(cwd);
    });

    it('should delegate getStatus to active driver', async () => {
        const cwd = '/tmp/test';
        await service.detect(cwd); // Ensure active
        await service.getStatus(cwd);
        expect(mockDriver.getStatus).toHaveBeenCalledWith(cwd);
    });

    it('should delegate apply to active driver', async () => {
        const cwd = '/tmp/test';
        await service.detect(cwd);
        await service.apply(cwd);
        expect(mockDriver.apply).toHaveBeenCalledWith(cwd);
    });
});
