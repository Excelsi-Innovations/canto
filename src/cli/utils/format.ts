import pc from 'picocolors';

/**
 * Draw a box around text
 */
export function box(content: string, options: { title?: string; padding?: number } = {}): string {
  const lines = content.split('\n');
  const padding = options.padding ?? 1;
  const maxWidth = Math.max(...lines.map((l) => l.length));
  const width = maxWidth + padding * 2;

  const top = options.title
    ? `┌─ ${options.title} ${'─'.repeat(width - options.title.length - 2)}┐`
    : `┌${'─'.repeat(width)}┐`;

  const bottom = `└${'─'.repeat(width)}┘`;

  const padded = lines.map((line) => {
    const pad = ' '.repeat(padding);
    const spacer = ' '.repeat(maxWidth - line.length);
    return `│${pad}${line}${spacer}${pad}│`;
  });

  return [top, ...padded, bottom].join('\n');
}

/**
 * Create a horizontal separator line
 */
export function separator(width = 80, char = '─'): string {
  return char.repeat(width);
}

/**
 * Format elapsed time
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

/**
 * Format uptime (human readable)
 */
export function formatUptime(ms: number): string {
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

/**
 * Create a progress bar
 */
export function progressBar(current: number, total: number, width = 20): string {
  const percent = Math.min(current / total, 1);
  const filled = Math.floor(width * percent);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percentText = `${Math.floor(percent * 100)}%`;
  return `[${bar}] ${current}/${total} (${percentText})`;
}

/**
 * Print an error message box
 */
export function errorBox(title: string, message: string, suggestions: string[] = []): string {
  let content = `${pc.red(pc.bold(title))}\n\n${message}`;

  if (suggestions.length > 0) {
    content += `\n\n${pc.blue(pc.bold('💡 Suggestions:'))}`;
    suggestions.forEach((suggestion) => {
      content += `\n  ${pc.dim('•')} ${suggestion}`;
    });
  }

  return box(content, { padding: 2 });
}

/**
 * Print a success message box
 */
export function successBox(title: string, message: string): string {
  const content = `${pc.green(pc.bold(title))}\n\n${message}`;
  return box(content, { padding: 2 });
}

/**
 * Print an info message box
 */
export function infoBox(title: string, message: string): string {
  const content = `${pc.cyan(pc.bold(title))}\n\n${message}`;
  return box(content, { padding: 2 });
}

/**
 * Format a list of items
 */
export function list(items: string[], bullet = '•'): string {
  return items.map((item) => `  ${pc.dim(bullet)} ${item}`).join('\n');
}

/**
 * Table-like layout with columns
 */
export function columns(rows: string[][], widths: number[], separator = ' │ '): string {
  return rows
    .map((row) => {
      return row
        .map((cell, i) => {
          const width = widths[i] ?? 0;
          const stripped = cell.replace(
            // eslint-disable-next-line no-control-regex
            /\u001b\[[0-9;]*m/g,
            ''
          );
          const padding = Math.max(0, width - stripped.length);
          return cell + ' '.repeat(padding);
        })
        .join(separator);
    })
    .join('\n');
}
