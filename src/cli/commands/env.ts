import { icons, colors } from '../utils/display.js';
import { errorBox, successBox } from '../utils/format.js';
import {
  detectEnvFiles,
  detectPorts,
  compareEnvFiles,
  groupEnvFilesByDirectory,
  extractModuleFromPath,
  findEnvExample,
  type EnvFile,
} from '../../utils/env.js';

interface EnvCommandOptions {
  check?: boolean; // Check for missing variables
  list?: boolean; // List all env files
  ports?: boolean; // Show port assignments
  diff?: string; // Compare .env with .env.example
}

/**
 * Env command handler
 * Manages environment variables across the project
 */
export async function envCommand(options: EnvCommandOptions): Promise<void> {
  try {
    const cwd = process.cwd();

    // Detect all .env files
    console.log(`${colors.cyan(`${icons.sparkles} Scanning for .env files...`)}\n`);
    const envFiles = detectEnvFiles(cwd);

    if (envFiles.length === 0) {
      console.log(
        errorBox(
          `${icons.error} No .env files found`,
          'No environment files were detected in your project.',
          [
            'Create a .env file in your project root',
            'Check if .env files are gitignored and exist locally',
          ]
        )
      );
      process.exit(1);
    }

    // Default: show summary
    if (!options.check && !options.list && !options.ports && !options.diff) {
      showEnvSummary(envFiles);
      return;
    }

    // List all env files
    if (options.list) {
      listEnvFiles(envFiles);
      return;
    }

    // Show port assignments
    if (options.ports) {
      showPorts(envFiles);
      return;
    }

    // Check for missing variables
    if (options.check) {
      checkMissingVariables(envFiles);
      return;
    }

    // Compare env files
    if (options.diff) {
      compareEnv(envFiles, options.diff);
      return;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.log(errorBox(`${icons.error} Error`, error.message));
    } else {
      console.log(errorBox(`${icons.error} Unknown error`, String(error)));
    }
    process.exit(1);
  }
}

/**
 * Show environment summary
 */
function showEnvSummary(envFiles: EnvFile[]): void {
  console.log(`${colors.cyan(colors.bold(`${icons.rocket} Environment Variables Summary`))}\n`);

  const actualEnvFiles = envFiles.filter((f) => !f.isExample);
  const exampleFiles = envFiles.filter((f) => f.isExample);

  console.log(colors.bold('📁 Environment Files\n'));
  console.log(`  ${colors.success(`${actualEnvFiles.length} active files`)}`);
  console.log(`  ${colors.dim(`${exampleFiles.length} example files`)}\n`);

  console.log(colors.bold('📊 Statistics\n'));
  const totalVars = actualEnvFiles.reduce((sum, f) => sum + f.variables.length, 0);
  console.log(`  ${colors.cyan(`${totalVars} total variables`)}`);

  const ports = detectPorts(actualEnvFiles);
  console.log(`  ${colors.cyan(`${ports.length} port configurations`)}\n`);

  console.log(colors.bold('🔍 Quick Actions\n'));
  console.log(`  ${colors.dim('•')} ${colors.cyan('canto env --list')}     List all env files`);
  console.log(`  ${colors.dim('•')} ${colors.cyan('canto env --ports')}    Show port assignments`);
  console.log(
    `  ${colors.dim('•')} ${colors.cyan('canto env --check')}    Check for missing variables`
  );
  console.log(
    `  ${colors.dim('•')} ${colors.cyan('canto env --diff <file>')} Compare with example\n`
  );
}

/**
 * List all environment files
 */
function listEnvFiles(envFiles: EnvFile[]): void {
  console.log(`${colors.cyan(colors.bold(`${icons.rocket} Environment Files`))}\n`);

  const groups = groupEnvFilesByDirectory(envFiles);

  for (const [dir, files] of groups.entries()) {
    const displayDir = dir === '.' ? 'Root' : dir;
    console.log(colors.bold(`📁 ${displayDir}\n`));

    for (const file of files) {
      const icon = file.isExample ? colors.dim('📄') : '📄';
      const name = file.relativePath;
      const varCount = file.variables.length;
      const label = file.isExample
        ? colors.dim(`${varCount} variables (example)`)
        : colors.cyan(`${varCount} variables`);

      const module = extractModuleFromPath(file.relativePath);
      const moduleLabel = module ? colors.dim(` [${module}]`) : '';

      console.log(`  ${icon} ${name}${moduleLabel}`);
      console.log(`     ${label}\n`);
    }
  }
}

/**
 * Show port assignments
 */
function showPorts(envFiles: EnvFile[]): void {
  console.log(`${colors.cyan(colors.bold(`${icons.sparkles} Port Assignments`))}\n`);

  const actualEnvFiles = envFiles.filter((f) => !f.isExample);
  const ports = detectPorts(actualEnvFiles);

  if (ports.length === 0) {
    console.log(colors.dim('No port configurations found in environment files.\n'));
    return;
  }

  // Group by source file
  const byFile = new Map<string, typeof ports>();
  for (const port of ports) {
    const existing = byFile.get(port.source) || [];
    existing.push(port);
    byFile.set(port.source, existing);
  }

  for (const [source, portList] of byFile.entries()) {
    const module = extractModuleFromPath(source);
    const moduleLabel = module ? colors.bold(colors.cyan(` [${module}]`)) : '';

    console.log(colors.bold(`📄 ${source}${moduleLabel}\n`));

    for (const port of portList.sort((a, b) => a.value - b.value)) {
      console.log(
        `  ${colors.cyan(`${port.key.padEnd(25)}`)} ${colors.bold(`:${port.value}`)}`
      );
    }
    console.log();
  }

  // Show summary
  const uniquePorts = new Set(ports.map((p) => p.value));
  const conflicts = ports.length - uniquePorts.size;

  if (conflicts > 0) {
    console.log(
      `${colors.yellow(`⚠️  Warning: ${conflicts} duplicate port assignment(s) detected`)}\n`
    );
  } else {
    console.log(`${colors.success(`✅ All ports are unique (${uniquePorts.size} ports)`)}\n`);
  }
}

/**
 * Check for missing variables
 */
function checkMissingVariables(envFiles: EnvFile[]): void {
  console.log(`${colors.cyan(colors.bold(`${icons.check} Checking Environment Variables`))}\n`);

  const actualEnvFiles = envFiles.filter((f) => !f.isExample);
  let hasIssues = false;

  for (const envFile of actualEnvFiles) {
    const examplePath = findEnvExample(envFile.path);

    if (!examplePath) {
      console.log(
        colors.dim(`${icons.info} ${envFile.relativePath} - No example file found\n`)
      );
      continue;
    }

    const exampleFile = envFiles.find((f) => f.path === examplePath);
    if (!exampleFile) continue;

    const comparison = compareEnvFiles(envFile, exampleFile);

    if (comparison.missing.length > 0 || comparison.extra.length > 0) {
      hasIssues = true;

      const module = extractModuleFromPath(envFile.relativePath);
      const moduleLabel = module ? colors.cyan(` [${module}]`) : '';

      console.log(colors.bold(`📄 ${envFile.relativePath}${moduleLabel}\n`));

      if (comparison.missing.length > 0) {
        console.log(colors.error(`  ${icons.error} Missing variables:\n`));
        for (const key of comparison.missing) {
          console.log(`    ${colors.dim('•')} ${colors.error(key)}`);
        }
        console.log();
      }

      if (comparison.extra.length > 0) {
        console.log(colors.yellow(`  ${icons.warning} Extra variables (not in example):\n`));
        for (const key of comparison.extra) {
          console.log(`    ${colors.dim('•')} ${colors.yellow(key)}`);
        }
        console.log();
      }

      console.log(
        colors.success(`  ${icons.success} ${comparison.common.length} variables in sync\n`)
      );
    } else {
      console.log(
        colors.success(`${icons.success} ${envFile.relativePath} - All variables in sync\n`)
      );
    }
  }

  if (!hasIssues) {
    console.log(
      successBox(
        `${icons.success} All environment files are in sync!`,
        'All your .env files have the required variables from their example files.'
      )
    );
  } else {
    console.log(
      errorBox(
        `${icons.error} Environment issues detected`,
        'Some .env files are missing required variables or have extra ones.',
        [
          'Add missing variables to your .env files',
          'Check if extra variables are still needed',
          'Update .env.example if your project requirements changed',
        ]
      )
    );
    process.exit(1);
  }
}

/**
 * Compare specific env file with example
 */
function compareEnv(envFiles: EnvFile[], targetPath: string): void {
  const envFile = envFiles.find((f) => f.relativePath === targetPath || f.path === targetPath);

  if (!envFile) {
    console.log(
      errorBox(`${icons.error} File not found`, `Environment file "${targetPath}" not found.`, [
        'Check the file path',
        'Use: canto env --list',
      ])
    );
    process.exit(1);
  }

  const examplePath = findEnvExample(envFile.path);
  if (!examplePath) {
    console.log(
      errorBox(
        `${icons.error} No example file`,
        `No example file found for "${targetPath}".`,
        ['Create a .env.example file', 'Specify a different env file']
      )
    );
    process.exit(1);
  }

  const exampleFile = envFiles.find((f) => f.path === examplePath);
  if (!exampleFile) {
    console.log(errorBox(`${icons.error} Error`, 'Could not load example file.'));
    process.exit(1);
  }

  console.log(`${colors.cyan(colors.bold(`${icons.compare} Comparing Environment Files`))}\n`);
  console.log(`  ${colors.bold('Actual:')}  ${envFile.relativePath}`);
  console.log(`  ${colors.bold('Example:')} ${exampleFile.relativePath}\n`);

  const comparison = compareEnvFiles(envFile, exampleFile);

  if (comparison.missing.length > 0) {
    console.log(colors.error(colors.bold(`\n${icons.error} Missing (${comparison.missing.length})`)));
    console.log(colors.dim('These variables exist in example but not in your .env:\n'));
    for (const key of comparison.missing) {
      // Find the variable in example to show its comment
      const exampleVar = exampleFile.variables.find((v) => v.key === key);
      console.log(`  ${colors.error(key)}`);
      if (exampleVar?.comment) {
        console.log(`    ${colors.dim(exampleVar.comment)}`);
      }
    }
    console.log();
  }

  if (comparison.extra.length > 0) {
    console.log(colors.yellow(colors.bold(`\n${icons.warning} Extra (${comparison.extra.length})`)));
    console.log(colors.dim('These variables exist in your .env but not in example:\n'));
    for (const key of comparison.extra) {
      console.log(`  ${colors.yellow(key)}`);
    }
    console.log();
  }

  if (comparison.common.length > 0) {
    console.log(colors.success(colors.bold(`\n${icons.success} In Sync (${comparison.common.length})`)));
    console.log(colors.dim('These variables exist in both files:\n'));
    for (const key of comparison.common.slice(0, 10)) {
      console.log(`  ${colors.dim('•')} ${key}`);
    }
    if (comparison.common.length > 10) {
      console.log(`  ${colors.dim(`... and ${comparison.common.length - 10} more`)}`);
    }
    console.log();
  }
}
