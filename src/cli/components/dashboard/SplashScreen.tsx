import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LOGO_LINES, getLoadingMessage } from '../../lib/branding.js';
import type { Theme } from '../../../utils/preferences.js';

interface SplashScreenProps {
  theme: Theme;
}

const WAVE_CHARS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

export const SplashScreen: React.FC<SplashScreenProps> = ({ theme }) => {
  const [loadingMessage] = useState(() => getLoadingMessage());
  const [wave, setWave] = useState([0, 1, 2, 3, 4, 3, 2, 1]);

  useEffect(() => {
    const interval = setInterval(() => {
      setWave((prev) => {
        const next = [...prev];
        const first = next.shift() || 0;
        next.push(first);
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" height={30}>
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.colors.border}
        padding={1}
        alignItems="center"
      >
        {LOGO_LINES.map((line, i) => (
          <Text key={i} color={theme.colors.primary}>
            {line}
          </Text>
        ))}
      </Box>

      <Box marginTop={2} marginBottom={1}>
        <Text color={theme.colors.highlight}>
          {wave.map((h, i) => (
            <Text key={i} color={theme.colors.primary}>
              {WAVE_CHARS[h]}
            </Text>
          ))}
        </Text>
      </Box>

      <Box>
        <Text color={theme.colors.info} italic>
          {loadingMessage}
        </Text>
      </Box>
    </Box>
  );
};

