import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { ScreenProps } from '../../types.js';
import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join } from 'path';
import { diffEnvFiles } from '../../../utils/env-diff.js';

interface EnvFile {
  name: string;
  path: string;
  size: number;
  isValid: boolean;
  missingKeys: string[];
}

export const EnvScreen: React.FC<ScreenProps> = React.memo(({ onBack, onQuit }) => {
  const [envFiles, setEnvFiles] = useState<EnvFile[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewedFileContent, setViewedFileContent] = useState<string | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const MAX_LINES = 15; // Limit viewport

  // Load .env files on mount
  useEffect(() => {
    try {
      const cwd = process.cwd();
      const files = readdirSync(cwd)
        .filter((f) => f.startsWith('.env') && statSync(join(cwd, f)).isFile())
        .map((f) => {
          const path = join(cwd, f);
          const examplePath = join(cwd, '.env.example');
          let isValid = true;
          let missingKeys: string[] = [];

          if (existsSync(examplePath)) {
            const diff = diffEnvFiles(path, examplePath);
            ({ missingKeys } = diff);
            isValid = missingKeys.length === 0;
          }

          return {
            name: f,
            path,
            size: statSync(path).size,
            isValid,
            missingKeys,
          };
        });
      setEnvFiles(files);
    } catch {
      // Silently handle env scan errors
    }
  }, []);

  useInput((input, key) => {
    if (viewedFileContent !== null) {
      // In view mode
      if (input === 'b' || input === 'B' || key.escape || key.backspace) {
        setViewedFileContent(null);
        setScrollOffset(0);
      } else if (key.upArrow) {
        setScrollOffset((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow) {
        // Simple approximate scroll limit
        const lines = viewedFileContent.split('\n').length;
        setScrollOffset((prev) => (prev + MAX_LINES < lines ? prev + 1 : prev));
      }
      return;
    }

    if (input === 'q' || input === 'Q') {
      onQuit();
    } else if (input === 'b' || input === 'B' || key.escape) {
      onBack();
    } else if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(envFiles.length - 1, prev + 1));
    } else if (key.return) {
      if (envFiles[selectedIndex]) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const content = readFileSync(envFiles[selectedIndex]!.path, 'utf-8');
          setViewedFileContent(content);
          setScrollOffset(0);
        } catch (err) {
          setViewedFileContent(`Error reading file: ${err}`);
        }
      }
    }
  });

  if (viewedFileContent !== null) {
    const allLines = viewedFileContent.split(/\r?\n/);
    const visibleLines = allLines.slice(scrollOffset, scrollOffset + MAX_LINES);
    const totalLines = allLines.length;

    return (
      <Box flexDirection="column" padding={1} flexGrow={1} height="100%">
        <Box borderStyle="double" borderColor="magenta" paddingX={1} marginBottom={1}>
          <Text bold color="magenta">
            📄 VIEWING: {envFiles[selectedIndex]?.name} ({totalLines} lines)
          </Text>
        </Box>
        <Box
          borderStyle="round"
          borderColor="gray"
          paddingX={1}
          flexDirection="column"
          flexGrow={1}
          height={MAX_LINES + 2} // Approximate height constraint
        >
          {visibleLines.length === 0 ? (
            <Text dimColor>File is empty</Text>
          ) : (
            visibleLines.map((line, i) => {
              // Better parsing: find first equals sign
              const eqIndex = line.indexOf('=');
              if (eqIndex > 0 && !line.trim().startsWith('#')) {
                const key = line.substring(0, eqIndex);
                const val = line.substring(eqIndex + 1);
                return (
                  <Text key={i + scrollOffset} wrap="truncate-end">
                    <Text color="cyan">{key}</Text>
                    <Text>=</Text>
                    <Text color="green">{val}</Text>
                  </Text>
                );
              }
              // Comments or empty lines
              return (
                <Text key={i + scrollOffset} dimColor wrap="truncate-end">
                  {line || ' '}
                </Text>
              );
            })
          )}
        </Box>
        <Box marginTop={0} justifyContent="space-between">
          <Text dimColor>Scroll: ↑↓ • Back: 'b'</Text>
          <Text dimColor>
            {' '}
            {Math.min(scrollOffset + MAX_LINES, totalLines)}/{totalLines}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1} padding={1} overflow="hidden" minWidth={0}>
      <Box
        borderStyle="double"
        borderColor="cyan"
        padding={1}
        marginBottom={1}
        overflow="hidden"
        minWidth={0}
      >
        <Text bold color="magenta">
          🔧 ENVIRONMENT VARIABLES
        </Text>
      </Box>

      <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column" flexGrow={1}>
        <Text color="yellow" bold>
          Detected Environment Files:
        </Text>
        <Box marginTop={1} flexDirection="column">
          {envFiles.length === 0 ? (
            <Text dimColor>No .env files found in current directory.</Text>
          ) : (
            envFiles.map((file, index) => (
              <Box key={file.name} flexDirection="row">
                <Text color={index === selectedIndex ? 'magenta' : 'white'}>
                  {index === selectedIndex ? '> ' : '  '}
                </Text>

                <Box marginRight={1}>
                  {file.isValid ? <Text color="green">✓</Text> : <Text color="yellow">⚠</Text>}
                </Box>

                <Text color={index === selectedIndex ? 'magenta' : 'white'}>{file.name}</Text>

                {!file.isValid && (
                  <Box marginLeft={1}>
                    <Text dimColor color="yellow">
                      ({file.missingKeys.length} missing)
                    </Text>
                  </Box>
                )}

                <Box flexGrow={1} />
                <Text dimColor>{file.size} bytes</Text>
              </Box>
            ))
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>Use ↑↓ to navigate • Enter to view content • 'b' to back • 'q' to quit</Text>
      </Box>
    </Box>
  );
});

EnvScreen.displayName = 'EnvScreen';
