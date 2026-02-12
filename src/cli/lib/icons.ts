/**
 * Contextual icons for different module types and statuses
 * Using Nerd Fonts / Unicode glyphs
 */

export const MODULE_ICONS: Record<string, string> = {
  // Module types
  workspace: '📦',
  docker: '🐳',
  'docker-compose': '🐋',
  script: '📜',
  service: '⚙️',
  backend: '🔧',
  frontend: '🎨',
  api: '🔌',
  database: '',
  default: '◆',
};

export const STATUS_ICONS: Record<string, string> = {
  RUNNING: '●',
  STOPPED: '○',
  STARTING: '◐',
  STOPPING: '◑',
  ERROR: '✗',
};

export const TECH_ICONS: Record<string, string> = {
  // Frontend
  react: '',
  vue: '󰡄',
  angular: '',
  svelte: '',
  next: '', // Ícone específico do Next.js

  // Backend
  node: '󰎙',
  express: '',
  nestjs: '',
  python: '',
  django: '',
  flask: '',
  // Databases
  postgres: '',
  mysql: '',
  mongodb: '',
  redis: '',

  // Other
  docker: '󰡨',
  kubernetes: '󱃾',
  git: '󰊢',
  npm: '',
  yarn: '',
  pnpm: '',
  bun: '',
  default: '',
};
/**
 * Get icon for module type
 */
export function getModuleIcon(type: string, name?: string): string {
  // Check if name contains tech keywords
  if (name) {
    const lowerName = name.toLowerCase();

    // Check tech keywords in name
    for (const [tech, icon] of Object.entries(TECH_ICONS)) {
      if (lowerName.includes(tech)) {
        return icon;
      }
    }
  }

  // Fall back to module type icon
  return MODULE_ICONS[type.toLowerCase()] ?? MODULE_ICONS['default'] ?? '◆';
}

/**
 * Get icon for status
 */
export function getStatusIcon(status: string): string {
  if (!status || typeof status !== 'string') return '?';
  return STATUS_ICONS[status.toUpperCase()] ?? '?';
}

/**
 * Get color-coded status display
 */
export function getStatusDisplay(status: string): {
  icon: string;
  label: string;
  color: 'green' | 'red' | 'yellow' | 'gray';
} {
  const statusMap: Record<
    string,
    { icon: string; label: string; color: 'green' | 'red' | 'yellow' | 'gray' }
  > = {
    RUNNING: { icon: '●', label: 'Running', color: 'green' },
    STOPPED: { icon: '○', label: 'Stopped', color: 'gray' },
    STARTING: { icon: '◐', label: 'Starting', color: 'yellow' },
    STOPPING: { icon: '◑', label: 'Stopping', color: 'yellow' },
    ERROR: { icon: '✗', label: 'Error', color: 'red' },
  };

  if (!status || typeof status !== 'string') {
    return { icon: '?', label: String(status || 'Unknown'), color: 'gray' };
  }

  return statusMap[status.toUpperCase()] ?? { icon: '?', label: status, color: 'gray' };
}

/**
 * Keyboard shortcut icons
 */
export const HOTKEY_ICONS = {
  start: '▶',
  stop: '■',
  restart: '↻',
  logs: '📄',
  search: '🔍',
  favorite: '★',
  select: '☑',
  help: '?',
  quit: '⏻',
  back: '←',
  enter: '↵',
  arrow: '↕',
};

/**
 * Get hotkey display with icon
 */
export function getHotkeyDisplay(key: string, action: string, icon?: string): string {
  const displayIcon = icon ?? HOTKEY_ICONS[action.toLowerCase() as keyof typeof HOTKEY_ICONS] ?? '';
  return `[${key}] ${displayIcon} ${action}`;
}
