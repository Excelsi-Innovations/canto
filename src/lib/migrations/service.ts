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
    if (!this.activeDriver) {
      const detected = await this.detect(cwd);
      if (!detected) throw new Error('No migration driver detected for this project.');
    }
    return this.activeDriver!.getStatus(cwd);
  }

  async apply(cwd: string): Promise<void> {
    if (!this.activeDriver) throw new Error('No active migration driver.');
    await this.activeDriver!.apply(cwd);
  }

  async reset(cwd: string): Promise<void> {
    if (!this.activeDriver) throw new Error('No active migration driver.');
    
    if (!this.activeDriver!.capabilities.canReset) {
      throw new Error(`Driver '${this.activeDriver!.label}' does not support database reset.`);
    }
    
    // Safety check? (maybe in UI layer, but service should probably allow force)
    if (this.activeDriver!.reset) {
        await this.activeDriver!.reset(cwd);
    }
  }

  async rollback(cwd: string, steps = 1): Promise<void> {
    if (!this.activeDriver) throw new Error('No active migration driver.');
    
    if (!this.activeDriver!.capabilities.canRollback) {
      throw new Error(`Driver '${this.activeDriver!.label}' does not support rollback.`);
    }

    if (this.activeDriver!.rollback) {
        await this.activeDriver!.rollback(cwd, steps);
    }
  }
}
