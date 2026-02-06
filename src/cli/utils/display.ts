import pc from 'picocolors';

export const icons = {
  docker: '🐳',
  workspace: '📦',
  custom: '⚙️',
  success: '✓',
  error: '✗',
  pending: '⏸',
  starting: '⏳',
  running: '●',
  stopped: '○',
  logs: '📄',
  rocket: '🚀',
  stats: '📊',
  warning: '⚠️',
  info: 'ℹ',
  question: '❓',
  restart: '🔄',
  stop: '⏹',
  sparkles: '✨',
  uptime: '↑',
  down: '↓',
  bullet: '•',
  check: '🔍',
  compare: '⚖️',
};

export const colors = {
  success: pc.green,
  error: pc.red,
  warning: pc.yellow,
  info: pc.blue,
  dim: pc.dim,
  bold: pc.bold,
  cyan: pc.cyan,
  magenta: pc.magenta,
  green: pc.green,
  yellow: pc.yellow,
};

export function statusColor(status: string): (str: string) => string {
  switch (status) {
    case 'RUNNING':
      return colors.success;
    case 'STARTING':
      return colors.warning;
    case 'STOPPED':
    case 'FAILED':
      return colors.error;
    case 'PENDING':
      return colors.dim;
    default:
      return (str: string) => str;
  }
}

export function statusIcon(status: string): string {
  switch (status) {
    case 'RUNNING':
      return icons.success;
    case 'STARTING':
      return icons.starting;
    case 'STOPPED':
      return icons.stopped;
    case 'FAILED':
      return icons.error;
    case 'PENDING':
      return icons.pending;
    default:
      return icons.bullet;
  }
}

export function moduleTypeIcon(type: string): string {
  switch (type) {
    case 'docker':
      return icons.docker;
    case 'workspace':
      return icons.workspace;
    case 'custom':
      return icons.custom;
    default:
      return icons.bullet;
  }
}
