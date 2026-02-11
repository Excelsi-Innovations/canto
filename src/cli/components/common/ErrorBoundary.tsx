import React, { Component, type ReactNode } from 'react';
import { Box, Text } from 'ink';

interface Props {
  children: ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  theme?: any; // Optional theme for styling consistency
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo) {
    // You can generic logging logic here if needed,
    // but for CLI we mostly want to prevent the process from crashing
    // and showing a garbled stack trace in standard output.
  }

  override render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1} borderStyle="double" borderColor="red">
          <Text color="red" bold>
            ⚠ Critical Error in Dashboard Render
          </Text>
          <Box marginTop={1} paddingLeft={1}>
            <Text color="yellow">{this.state.error?.message ?? 'Unknown error'}</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              The application state has been preserved safe-guarded. Press Ctrl+C to exit or try
              restarting the dashboard.
            </Text>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
