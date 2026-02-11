import { existsSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { diffEnvFiles } from '../../utils/env-diff.js';
import { icons, colors } from '../utils/display.js';
import { render } from 'ink';
import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { loadConfig } from '../../config/parser.js';

export interface EnvCommandOptions {
  check?: boolean;
  fix?: boolean;
}

// Simple interactive prompt component
const EnvPrompt = ({
  missingKeys,
  onComplete,
}: {
  missingKeys: string[];
  onComplete: (values: Record<string, string>) => void;
}) => {
  const [index, setIndex] = React.useState(0);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [currentValue, setCurrentValue] = React.useState('');

  const currentKey = missingKeys[index] ?? '';

  const handleSubmit = (value: string) => {
    if (!currentKey) return;
    const newValues = { ...values, [currentKey]: value };
    setValues(newValues);
    setCurrentValue('');

    if (index < missingKeys.length - 1) {
      setIndex(index + 1);
    } else {
      onComplete(newValues);
    }
  };

  return (
    <Box flexDirection="column">
      <Text>Enter value for {colors.cyan(currentKey)}:</Text>
      <Box borderStyle="round" borderColor="blue">
        <TextInput value={currentValue} onChange={setCurrentValue} onSubmit={handleSubmit} />
      </Box>
      <Text dimColor>
        ({index + 1}/{missingKeys.length}) Press Enter to confirm
      </Text>
    </Box>
  );
};

export async function envCommand(options: EnvCommandOptions): Promise<void> {
  const cwd = process.cwd();
  const envPath = join(cwd, '.env');
  const examplePath = join(cwd, '.env.example');

  // Smart Setup: Env Check
  if (options.check || options.fix) {
    if (!existsSync(examplePath)) {
      console.log(`${icons.warning} No .env.example found. Cannot check for missing variables.`);
      return;
    }

    const diff = diffEnvFiles(envPath, examplePath);

    if (diff.missingKeys.length === 0) {
      console.log(`${colors.success(icons.success)} Environment variables match .env.example`);
      return;
    }

    console.log(
      `${icons.warning} ${colors.yellow(`Missing ${diff.missingKeys.length} environment variables:`)}`
    );
    diff.missingKeys.forEach((key) => {
      console.log(`  ${colors.error(icons.bullet)} ${key}`);
    });

    if (options.fix) {
      console.log('');

      const onComplete = (values: Record<string, string>) => {
        let content = '\n# Added by Canto\n';
        Object.entries(values).forEach(([key, val]) => {
          content += `${key}=${val}\n`;
        });

        appendFileSync(envPath, content);
        console.log(
          `\n${colors.success(icons.success)} Added ${Object.keys(values).length} variables to .env`
        );
      };

      const { waitUntilExit } = render(
        <EnvPrompt missingKeys={diff.missingKeys} onComplete={onComplete} />
      );
      await waitUntilExit();
    } else {
      console.log(`\nRun ${colors.cyan('canto env --fix')} to interactively add them.`);
      process.exit(1);
    }
  } else {
    // Default behavior: List environment variables from config
    const config = await loadConfig();
    console.log(`${icons.info} ${colors.bold('Environment Variables')}\n`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.modules.forEach((mod: any) => {
      if (mod.env && Object.keys(mod.env).length > 0) {
        console.log(`${colors.cyan(icons.bullet)} ${colors.bold(mod.name)}`);
        Object.entries(mod.env).forEach(([k, v]) => {
          console.log(`  ${k}=${v}`);
        });
        console.log('');
      }
    });

    // Also run a passive check
    if (existsSync(examplePath)) {
      const diff = diffEnvFiles(envPath, examplePath);
      if (diff.missingKeys.length > 0) {
        console.log(
          `${icons.warning} ${colors.yellow(`Note: You have ${diff.missingKeys.length} missing variables defined in .env.example`)}`
        );
        console.log(`Run ${colors.cyan('canto env --fix')} to fix them.\n`);
      }
    }
  }
}
