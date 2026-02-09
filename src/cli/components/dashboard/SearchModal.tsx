import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import type { Theme } from '../../../utils/preferences.js';

interface SearchModalProps {
  theme: Theme;
  onSearch: (query: string) => void;
  onClose: () => void;
  initialQuery?: string;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  theme,
  onSearch,
  onClose,
  initialQuery = '',
}) => {
  const [query, setQuery] = useState(initialQuery);

  // Debounce search to prevent flickering on every keystroke in the main dashboard
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(query);
    }, 50); // Short debounce for responsiveness but enough to batch updates
    return () => clearTimeout(timer);
  }, [query, onSearch]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.return) {
      onClose();
      return;
    }

    if (key.backspace || key.delete) {
      setQuery((prev) => prev.slice(0, -1));
    } else if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setQuery((prev) => prev + input);
    }
  });

  return (
    <Box
      position="absolute"
      marginTop={2}
      marginLeft={4}
      width={60}
      height={3}
      borderStyle="double"
      borderColor={theme.colors.highlight}
      flexDirection="column"
    >
      <Box>
        <Text color={theme.colors.primary} bold>
          {' 🔍 Search: '}
        </Text>
        <Text color={theme.colors.info}>{query}</Text>
        <Text color={theme.colors.muted} dimColor>
          _
        </Text>
      </Box>
    </Box>
  );
};
