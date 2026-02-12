export type MigrationStatus = 'applied' | 'pending' | 'failed' | 'future';

export interface Migration {
  id: string;          // e.g. "20231026120000_init"
  name: string;        // e.g. "init"
  timestamp: Date;
  status: MigrationStatus;
  appliedAt?: Date;
}
