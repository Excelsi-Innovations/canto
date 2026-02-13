/**
 * Shared types for CLI components
 */

export interface ModuleStatus {
  name: string;
  type: string;
  status: 'RUNNING' | 'STOPPED' | 'STARTING' | 'STOPPING' | 'ERROR';
  pid?: number;
  uptime?: number;
  startedAt?: Date;
  cpu?: number;
  memory?: number;
  containers?: Array<{
    name: string;
    status: string;
    health?: string;
    ports: string[];
  }>;
}

export type Screen =
  | 'dashboard'
  | 'modules'
  | 'logs'
  | 'env'
  | 'help'
  | 'history'
  | 'details'
  | 'commander'
  | 'migrations';

export interface ScreenProps {
  onBack: () => void;
  onQuit: () => void;
}
