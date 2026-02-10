import React from 'react';
import { Box, Text } from 'ink';
import { type Theme } from '../../utils/preferences.js';
import { ComposerHeader } from './ComposerHeader.js';

interface ComposerLayoutProps {
  children: React.ReactNode;
  theme: Theme;
  stepTitle: string;
  currentStep?: number;
  totalSteps?: number;
  showFooter?: boolean;
  footerMode?: 'continue' | 'confirm' | 'simple';
}

export const ComposerLayout: React.FC<ComposerLayoutProps> = ({
  children,
  theme,
  stepTitle,
  currentStep,
  totalSteps,
  showFooter = true,
  footerMode = 'continue',
}) => {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <ComposerHeader 
        theme={theme} 
        step={stepTitle} 
        currentStep={currentStep} 
        totalSteps={totalSteps} 
      />

      {/* Main Content Area */}
      <Box 
        borderStyle="round" 
        borderColor={theme.colors.primary} 
        paddingX={3} 
        paddingY={1} 
        flexDirection="column"
        minHeight={15}
      >
        {children}
      </Box>

      {/* Footer Instructions */}
      {showFooter && (
        <Box marginTop={1} borderStyle="single" borderColor={theme.colors.muted} paddingX={2}>
          {footerMode === 'confirm' ? (
             <Text>
             <Text backgroundColor={theme.colors.success} color="black" bold> Y </Text>
             <Text> Confirm </Text>
             <Text backgroundColor={theme.colors.error} color="white" bold> N </Text>
             <Text> Cancel </Text>
             <Text backgroundColor={theme.colors.muted} color="white" bold> ESC </Text>
             <Text> Exit</Text>
           </Text>
          ) : footerMode === 'continue' ? (
            <Text>
              <Text backgroundColor={theme.colors.success} color="black" bold> ↵ ENTER </Text>
              <Text> Continue </Text>
              <Text backgroundColor={theme.colors.warning} color="black" bold> N </Text>
              <Text> No </Text>
              <Text backgroundColor={theme.colors.muted} color="white" bold> ESC </Text>
              <Text> Cancel</Text>
            </Text>
          ) : (
             <Text>
                <Text backgroundColor={theme.colors.muted} color="white" bold> ESC </Text>
                <Text> Cancel</Text>
             </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
