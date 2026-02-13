export enum ProcessStatus {
  IDLE = 'idle',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  FAILED = 'failed',
}

export interface SpawnOptions {
  id: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  logFile?: string;
  shell?: boolean | string;
  detached?: boolean;
  onExit?: (code: number | null, signal: NodeJS.Signals | null) => void;
  onStop?: () => Promise<void> | void;
  onData?: (data: string) => void;
  onError?: (data: string) => void;
}

export interface ProcessInfo {
  id: string;
  pid?: number;
  status: ProcessStatus;
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  logFile?: string;
  startedAt?: Date;
  stoppedAt?: Date;
  exitCode?: number;
  error?: string;
  detached?: boolean;
  onStop?: () => Promise<void> | void;
}

export interface ProcessResult {
  success: boolean;
  processInfo: ProcessInfo;
  pid?: number;
  error?: string;
}
