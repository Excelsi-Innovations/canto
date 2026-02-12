import { type IMigrationDriver } from './driver.interface.js';
import { type Migration } from './types.js';
import { PrismaDriver } from './drivers/prisma.js';

export class MigrationService {
  private static instance: MigrationService;
  private drivers: IMigrationDriver[] = [];
  private activeDriver: IMigrationDriver | null = null;

  private constructor() {
    // Register available drivers
    this.registerDriver(new PrismaDriver());
  }

  static getInstance(): MigrationService {
    if (!MigrationService.instance) {
      MigrationService.instance = new MigrationService();
    }
    return MigrationService.instance;
  }

  registerDriver(driver: IMigrationDriver): void {
    this.drivers.push(driver);
  }

  /**
   * Clear all drivers (useful for testing)
   */
  clearDrivers(): void {
    this.drivers = [];
  }

  /**
   * Detect which driver manages migrations in the current directory
   */
  async detect(cwd: string): Promise<IMigrationDriver | null> {
    for (const driver of this.drivers) {
      if (await driver.detect(cwd)) {
        this.activeDriver = driver;
        return driver;
      }
    }
    this.activeDriver = null;
    return null;
  }

  getActiveDriver(): IMigrationDriver | null {
    return this.activeDriver;
  }

  // --- Operations delegated to active driver ---

  async getStatus(cwd: string): Promise<Migration[]> {
    let driver = this.activeDriver;
    if (!driver) {
      const detected = await this.detect(cwd);
      if (!detected) throw new Error('No migration driver detected for this project.');
      driver = detected;
    }
    return driver.getStatus(cwd);
  }

  async apply(cwd: string): Promise<void> {
    const driver = this.activeDriver;
    if (!driver) throw new Error('No active migration driver.');
    await driver.apply(cwd);
  }

  async reset(cwd: string): Promise<void> {
    const driver = this.activeDriver;
    if (!driver) throw new Error('No active migration driver.');

    if (!driver.capabilities.canReset) {
      throw new Error(`Driver '${driver.label}' does not support database reset.`);
    }

    // Safety check? (maybe in UI layer, but service should probably allow force)
    if (driver.reset) {
      await driver.reset(cwd);
    }
  }

  async rollback(cwd: string, steps = 1): Promise<void> {
    const driver = this.activeDriver;
    if (!driver) throw new Error('No active migration driver.');

    if (!driver.capabilities.canRollback) {
      throw new Error(`Driver '${driver.label}' does not support rollback.`);
    }

    if (driver.rollback) {
      await driver.rollback(cwd, steps);
    }
  }
}
