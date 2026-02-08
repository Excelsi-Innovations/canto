import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { LOGO_LINES, getLoadingMessage, getPulseColor } from '../../lib/branding.js';
import type { Theme } from '../../../utils/preferences.js';

interface SplashScreenProps {
  theme: Theme;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ theme }) => {
  const [loadingMessage] = useState(() => getLoadingMessage());
  const [borderColor, setBorderColor] = useState(() => getPulseColor('loading'));
  const [dots, setDots] = useState('');

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setBorderColor(getPulseColor('loading'));
    }, 600);
    return () => clearInterval(pulseInterval);
  }, []);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(dotInterval);
  }, []);

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" padding={2}>
      <Box
        flexDirection="column"
        borderStyle="double"
        borderColor={borderColor}
        padding={1}
        alignItems="center"
      >
        {LOGO_LINES.map((line, i) => (
          <Text
            key={i}
            color={i <= 1 || i >= LOGO_LINES.length - 2 ? borderColor : theme.colors.primary}
          >
            {line}
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text color={theme.colors.info} italic>
          {loadingMessage}
          {dots}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor color={theme.colors.muted}>
          A Sinfonia dos Heteronyms
        </Text>
      </Box>
    </Box>
  );
};
