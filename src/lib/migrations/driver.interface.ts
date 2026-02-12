import type { Migration } from './types.js';

/**
 * Agnostic interface for database migration drivers.
 * Supports various models (linear, up/down) via capability flags.
 */
export interface IMigrationDriver {
  /**
   * Driver identifier (e.g. 'prisma', 'typeorm')
   */
  name: string;

  /**
   * Human-readable label (e.g. 'Prisma ORM')
   */
  label: string;

  /**
   * Capabilities supported by this driver
   */
  capabilities: {
    canRollback: boolean;   // Supports 'down' migrations
    canGenerate: boolean;   // Supports creating new migration files
    canReset: boolean;      // Supports database reset
  };

  /**
   * Detect if this driver is applicable to the given project root
   * @param cwd Project root directory
   */
  detect(cwd: string): Promise<boolean>;

  /**
   * Get the current status of all migrations
   * @param cwd Project root directory
   */
  getStatus(cwd: string): Promise<Migration[]>;

  /**
   * Apply pending migrations
   * @param cwd Project root directory
   */
  apply(cwd: string): Promise<void>;

  /**
   * Rollback the last batch of migrations
   * Optional - check capabilities.canRollback first
   */
  rollback?(cwd: string, steps?: number): Promise<void>;

  /**
   * Reset the database (drop all data and re-apply schema)
   * Optional - check capabilities.canReset first
   */
  reset?(cwd: string): Promise<void>;

  /**
   * Generate a new migration file
   * Optional - check capabilities.canGenerate first
   */
  generate?(cwd: string, name: string): Promise<string>;
}
