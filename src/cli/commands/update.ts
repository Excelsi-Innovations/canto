import pc from 'picocolors';
import { spawn } from 'child_process';
import { successBox, errorBox } from '../utils/format.js';

export async function updateCommand() {
  console.log(pc.cyan('✨ Checking for Canto updates...'));
  try {
    console.log(pc.yellow('Pulling latest changes from Git...'));
    await new Promise((resolve, reject) => {
      const child = spawn('git', ['pull'], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code === 0) resolve(0);
        else reject(new Error(`git pull exited with code ${code}`));
      });
    });
    console.log(pc.yellow('Installing dependencies...'));
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['install'], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code === 0) resolve(0);
        else reject(new Error(`npm install exited with code ${code}`));
      });
    });
    console.log(pc.yellow('Building Canto...'));
    await new Promise((resolve, reject) => {
      const child = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
      child.on('close', (code) => {
        if (code === 0) resolve(0);
        else reject(new Error(`npm run build exited with code ${code}`));
      });
    });
    console.log(successBox('Canto Updated', 'Canto has been updated to the latest version!'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(errorBox('Update Failed', message));
    process.exit(1);
  }
}

// Optionally, you can define a Command object if you want to add options
// export const update = new Command('update')
//   .description('Update Canto to the latest version')
//   .action(updateCommand);
