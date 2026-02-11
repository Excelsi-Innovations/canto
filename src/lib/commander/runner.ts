import type { ProcessManager } from '../../processes/manager.js';
import type { Task } from './scanner.js';

export class TaskRunner {
  private processManager: ProcessManager;

  constructor(processManager: ProcessManager) {
    this.processManager = processManager;
  }

  async run(
    task: Task,
    options: { cwd?: string; onData?: (data: string) => void } = {}
  ): Promise<void> {
    const cwd = options.cwd ?? process.cwd();

    // Commands often need a shell to run (especially npm scripts or makefiles)
    // We can wrap them in a shell execution or letting ProcessManager handle it.
    // Looking at ProcessManager usage, it likely supports spawn with shell option or breaking args.
    // For simplicity and compatibility with npm/make, running through a shell is safer.

    // We'll use the ID as the process ID to track it.
    // But IDs like 'npm:build' might need sanitization or just direct usage if map supports it.

    // console.log(`Starting task: ${task.name} (${task.command})`);

    // TODO: Hook into dashboard output?
    // For now, we spawn it. The Dashboard needs to know about "Task Processes" vs "Module Processes".
    // Maybe we treat them as ephemeral modules?

    // Ideally, we start it and return. The dashboard monitors it via processManager.

    await this.processManager.spawn({
      id: task.id,
      command: task.command,
      cwd,
      onData: options.onData,
      shell: true, // Ensure shell execution for composite commands
    });
  }

  async stop(taskId: string): Promise<void> {
    await this.processManager.stop(taskId);
  }

  getStatus(taskId: string) {
    return this.processManager.getStatus(taskId);
  }
}
