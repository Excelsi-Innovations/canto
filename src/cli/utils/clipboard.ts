import { exec } from 'node:child_process';
import { platform } from 'node:os';

/**
 * Copies text to the system clipboard
 */
export function copyToClipboard(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const os = platform();
    let command = '';

    if (os === 'win32') {
      command = 'clip';
    } else if (os === 'darwin') {
      command = 'pbcopy';
    } else if (os === 'linux') {
      // Try xclip first, then xsel
      command = 'xclip -selection clipboard || xsel --clipboard --input';
    } else {
      return reject(new Error(`Clipboard not supported on ${os}`));
    }

    const child = exec(command, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });

    if (child.stdin) {
      child.stdin.write(text);
      child.stdin.end();
    } else {
      reject(new Error('Could not write to stdin'));
    }
  });
}
