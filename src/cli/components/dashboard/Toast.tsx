import React from 'react';
import { Box, Text } from 'ink';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastProps {
  toast: ToastData;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  const config = {
    success: { color: 'green', icon: '✓', border: 'green' },
    error: { color: 'red', icon: '✗', border: 'red' },
    warning: { color: 'yellow', icon: '⚠', border: 'yellow' },
    info: { color: 'cyan', icon: 'ℹ', border: 'cyan' },
  };

  const { color, icon, border } = config[toast.type];

  return (
    <Box borderStyle="round" borderColor={border} paddingX={1}>
      <Text color={color} bold>
        {icon}
      </Text>
      <Text> {toast.message}</Text>
    </Box>
  );
};
