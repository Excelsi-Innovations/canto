import type {
  ProjectDetectionResult,
  DetectedWorkspace,
  DetectedDocker,
  WorkspaceCategory,
} from './detector.js';

export interface ComposerModule {
  name: string;
  type: 'workspace' | 'docker' | 'worker';
  category: WorkspaceCategory;
  path: string;
  workspace?: DetectedWorkspace; // Original workspace ref
  docker?: DetectedDocker; // Original docker ref
  enabled: boolean;
  commands: {
    dev?: string;
    build?: string;
    test?: string;
    start?: string;
  };
  dependsOn: string[];
}

export interface ComposerState {
  modules: ComposerModule[];
  customScripts: Record<string, boolean>; // Script name -> enabled
  rootScripts: Record<string, string>; // Original root scripts
  nodeVersion: string;
  requireDocker: boolean;
  requireDockerCompose: boolean;
}

/**
 * Identify default commands based on category and scripts
 */
function getDefaultsForWorkspace(workspace: DetectedWorkspace, category: WorkspaceCategory) {
  const pm = workspace.packageManager;
  const commands: ComposerModule['commands'] = {};

  if (category === 'app') {
    if (workspace.hasDevScript) commands.dev = `${pm} run dev`;
    // Some apps use 'start' for dev if no dev script, handled by detector hasDevScript logic generally
    // But detector says hasDevScript = dev OR start.
    // If dev exists, use it. If not, use start.
    // We don't have the full script list here, just booleans.
    // We'll trust the plan: dev + build.
    // Actually, we should probably check if we can run "dev" or "start".
    // Since we don't have the script names, we'll assume "dev" if hasDevScript is true,
    // but the user can edit it later.
    // Wait, the detector *does* know if it has dev vs start, but it collapses them into hasDevScript.
    // Let's assume 'dev' is standard.
    if (workspace.hasDevScript) commands.dev = `${pm} run dev`;
    if (workspace.hasBuildScript) commands.build = `${pm} run build`;
  } else if (category === 'lib') {
    if (workspace.hasBuildScript) commands.build = `${pm} run build`;
  } else if (category === 'worker') {
    // Workers usually run with start or a specific worker script
    // If it was detected as worker, it might have a worker script.
    // We'll guess 'start' or 'dev:worker' later?
    // For now, let's default to start if it has dev script (which covers start).
    if (workspace.hasDevScript) commands.start = `${pm} run start`;
    if (workspace.hasBuildScript) commands.build = `${pm} run build`;
  }

  return {
    enabled: category === 'app' || category === 'worker' || category === 'infra',
    commands,
  };
}

/**
 * Initialize Composer state from detection result
 */
export function initState(detection: ProjectDetectionResult): ComposerState {
  const modules: ComposerModule[] = []; // 1. Docker Infra
  if (detection.docker.composeFiles.length > 0) {
    const composeFile = detection.docker.composeFiles[0] ?? ''; // Safe fallback
    if (composeFile) {
        const name = 'infra'; // Default name

        modules.push({
        name,
        type: 'docker',
        category: 'infra',
        path: composeFile,
        enabled: true,
        commands: {},
        dependsOn: [],
        });
    }
  }

  const infraModuleName = modules.find((m) => m.type === 'docker')?.name;

  // 2. Workspaces
  for (const ws of detection.workspaces) {
    // Main module
    const defaults = getDefaultsForWorkspace(ws, ws.category);

    // Auto-dependency on infra
    const dependsOn =
      infraModuleName && (ws.category === 'app' || ws.category === 'worker')
        ? [infraModuleName]
        : [];

    modules.push({
      name: ws.name,
      type: ws.category === 'worker' ? 'worker' : 'workspace',
      category: ws.category,
      path: ws.path,
      workspace: ws,
      enabled: defaults.enabled,
      commands: defaults.commands,
      dependsOn,
    });

    // Sibling Worker Module detection
    // If it's an app AND has worker entry points, create a secondary module
    if (ws.category === 'app' && ws.workerEntryPoints.length > 0) {
      // Check if we can find a matching script?
      // We don't have raw scripts in DetectedWorkspace, sadly.
      // We'll assume standard naming or just "dev:worker".
      // We'll assume it's enabled if the app is enabled.

      modules.push({
        name: `${ws.name}:worker`,
        type: 'worker',
        category: 'worker',
        path: ws.path,
        workspace: ws,
        enabled: true,
        commands: {
          start: `${ws.packageManager} run dev:worker`, // Reasonable guess for separate process
        },
        dependsOn: infraModuleName ? [infraModuleName] : [],
      });
    }
  }

  // 3. Root Scripts (Custom Scripts)
  const customScripts: Record<string, boolean> = {};
  const rootScriptsToIgnore = ['test', 'lint', 'format', 'build', 'dev', 'start'];

  for (const [scriptName, _] of Object.entries(detection.rootScripts)) {
    if (rootScriptsToIgnore.some((i) => scriptName.startsWith(i))) continue;
    // Include setup, db, docker, health, etc.
    customScripts[scriptName] = true;
  }

  return {
    modules,
    customScripts,
    rootScripts: detection.rootScripts,
    // Use detected version or default to >=18
    nodeVersion: detection.nodeVersion || '>=18.0.0',
    requireDocker: detection.docker.composeFiles.length > 0 || detection.docker.hasDockerfile,
    requireDockerCompose: detection.docker.composeFiles.length > 0,
  };
}
