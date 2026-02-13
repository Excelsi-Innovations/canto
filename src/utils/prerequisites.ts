import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if a command exists in the system PATH
 *
 * @param command - Command name to check
 * @returns True if command exists, false otherwise
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    const cmd = process.platform === 'win32' ? `where ${command}` : `which ${command}`;
    await execAsync(cmd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get command version
 *
 * @param command - Command name
 * @param versionFlag - Flag to get version (default: --version)
 * @returns Version string or null if not available
 */
export async function getCommandVersion(
  command: string,
  versionFlag = '--version'
): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`${command} ${versionFlag}`);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Check if Docker is installed and running
 *
 * @returns Object with installed and running status
 */
export async function checkDocker(): Promise<{
  installed: boolean;
  running: boolean;
  version: string | null;
}> {
  const installed = await commandExists('docker');

  if (!installed) {
    return { installed: false, running: false, version: null };
  }

  const version = await getCommandVersion('docker', '--version');

  try {
    await execAsync('docker ps');
    return { installed: true, running: true, version };
  } catch {
    return { installed: true, running: false, version };
  }
}

/**
 * Check if Docker Compose is installed
 *
 * @returns Object with installed status and which variant
 */
export async function checkDockerCompose(): Promise<{
  installed: boolean;
  variant: 'v2' | 'v1' | null;
  version: string | null;
}> {
  try {
    await execAsync('docker compose version');
    const version = await getCommandVersion('docker', 'compose version');
    return { installed: true, variant: 'v2', version };
  } catch {
    try {
      await execAsync('docker-compose --version');
      const version = await getCommandVersion('docker-compose', '--version');
      return { installed: true, variant: 'v1', version };
    } catch {
      return { installed: false, variant: null, version: null };
    }
  }
}

/**
 * Check Node.js version
 *
 * @param minVersion - Minimum required version (e.g., "18.0.0")
 * @returns Object with version and meets requirement status
 */
export function checkNodeVersion(minVersion?: string): {
  version: string;
  meetsRequirement: boolean;
} {
  const version = process.version.replace('v', '');

  if (!minVersion) {
    return { version, meetsRequirement: true };
  }

  const current = version.split('.').map(Number);
  const required = minVersion.split('.').map(Number);

  let meetsRequirement = true;
  for (let i = 0; i < 3; i++) {
    if ((current[i] ?? 0) > (required[i] ?? 0)) break;
    if ((current[i] ?? 0) < (required[i] ?? 0)) {
      meetsRequirement = false;
      break;
    }
  }

  return { version, meetsRequirement };
}

/**
 * Check all prerequisites based on config
 *
 * @param requirements - Requirements object from config
 * @returns Object with all prerequisite check results
 */
export async function checkPrerequisites(requirements?: {
  docker?: boolean;
  dockerCompose?: boolean;
  node?: string;
}): Promise<{
  docker?: Awaited<ReturnType<typeof checkDocker>>;
  dockerCompose?: Awaited<ReturnType<typeof checkDockerCompose>>;
  node?: ReturnType<typeof checkNodeVersion>;
  allMet: boolean;
}> {
  const results: Awaited<ReturnType<typeof checkPrerequisites>> = {
    allMet: true,
  };

  const promises: Promise<void>[] = [];

  if (requirements?.docker) {
    promises.push(
      checkDocker().then((res) => {
        results.docker = res;
        if (!res.installed || !res.running) {
          results.allMet = false;
        }
      })
    );
  }

  if (requirements?.dockerCompose) {
    promises.push(
      checkDockerCompose().then((res) => {
        results.dockerCompose = res;
        if (!res.installed) {
          results.allMet = false;
        }
      })
    );
  }

  if (requirements?.node) {
    // Node check is sync
    results.node = checkNodeVersion(requirements.node);
    if (!results.node.meetsRequirement) {
      results.allMet = false;
    }
  }

  await Promise.all(promises);

  return results;
}

/**
 * Print prerequisites check results
 *
 * @param results - Results from checkPrerequisites
 */
export function printPrerequisitesReport(
  results: Awaited<ReturnType<typeof checkPrerequisites>>
): void {
  console.log('\n📋 Prerequisites Check\n');

  if (results.docker) {
    const status = results.docker.installed && results.docker.running ? '✅' : '❌';
    console.log(
      `${status} Docker: ${results.docker.installed ? (results.docker.running ? 'Running' : 'Installed but not running') : 'Not installed'}`
    );
    if (results.docker.version) {
      console.log(`   Version: ${results.docker.version}`);
    }
  }

  if (results.dockerCompose) {
    const status = results.dockerCompose.installed ? '✅' : '❌';
    console.log(
      `${status} Docker Compose: ${results.dockerCompose.installed ? `Installed (${results.dockerCompose.variant})` : 'Not installed'}`
    );
    if (results.dockerCompose.version) {
      console.log(`   Version: ${results.dockerCompose.version}`);
    }
  }

  if (results.node) {
    const status = results.node.meetsRequirement ? '✅' : '❌';
    console.log(`${status} Node.js: ${results.node.version}`);
  }

  console.log();

  if (!results.allMet) {
    console.log('⚠️  Some prerequisites are not met. Please install missing dependencies.\n');
  }
}
