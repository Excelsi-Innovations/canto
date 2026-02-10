import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import BigText from 'ink-big-text';
import type { ProjectDetectionResult } from './detector.js';
import { getTheme } from '../utils/preferences.js';
import { ComposerLayout } from './components/ComposerLayout.js';

interface CantoComposerProps {
  detection: ProjectDetectionResult;
  onComplete: (options: {
    includePrerequisites: boolean;
    autoAllocatePorts: boolean;
    selectedWorkspaces: string[];
    includeDocker: boolean;
  }) => void;
  onCancel: () => void;
}

type Step =
  | 'welcome'
  | 'analyzing'
  | 'workspaces'
  | 'docker'
  | 'prerequisites'
  | 'ports'
  | 'confirm';

/**
 * Canto Composer - Interactive project configuration tool
 * Stack-agnostic setup wizard 
 */
export function CantoComposer({
  detection,
  onComplete,
  onCancel,
}: CantoComposerProps): React.JSX.Element {
  const theme = getTheme();
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [showAnalyzing, setShowAnalyzing] = useState(false);
  const [selectedWorkspaces] = useState<string[]>(detection.workspaces.map((w) => w.name));
  const [includeDocker, setIncludeDocker] = useState(detection.docker.composeFiles.length > 0);
  const [includePrerequisites, setIncludePrerequisites] = useState(true);
  const [autoAllocatePorts, setAutoAllocatePorts] = useState(true);

  // Show analyzing animation after welcome
  useEffect(() => {
    if (step === 'welcome') {
      const timer = setTimeout(() => {
        setShowAnalyzing(true);
        setTimeout(() => {
          setShowAnalyzing(false);
          setStep(detection.workspaces.length > 0 ? 'workspaces' : 'docker');
        }, 1500);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step, detection.workspaces.length]);

  useInput((input: string, key: { escape?: boolean; return?: boolean }) => {
    if (key.escape || (input === 'q' && step === 'welcome')) {
      onCancel();
      exit();
      return;
    }

    if (step === 'analyzing') return; // Ignore input during animation

    if (key.return || input === 'y' || input === 'Y') {
      handleNext();
    }

    if (input === 'n' || input === 'N') {
      handleNo();
    }

    if (input === 'b' || input === 'B') {
      handleBack();
    }
  });

  const handleNext = (): void => {
    switch (step) {
      case 'welcome':
        setStep('analyzing');
        break;
      case 'workspaces':
        setStep('docker');
        break;
      case 'docker':
        setStep('prerequisites');
        break;
      case 'prerequisites':
        setStep('ports');
        break;
      case 'ports':
        setStep('confirm');
        break;
      case 'confirm':
        onComplete({
          includePrerequisites,
          autoAllocatePorts,
          selectedWorkspaces,
          includeDocker,
        });
        exit();
        break;
    }
  };

  const handleNo = (): void => {
    switch (step) {
      case 'docker':
        setIncludeDocker(false);
        setStep('prerequisites');
        break;
      case 'prerequisites':
        setIncludePrerequisites(false);
        setStep('ports');
        break;
      case 'ports':
        setAutoAllocatePorts(false);
        setStep('confirm');
        break;
      case 'confirm':
        onCancel();
        exit();
        break;
    }
  };

  const handleBack = (): void => {
    switch (step) {
      case 'workspaces':
        setStep('welcome');
        break;
      case 'docker':
        setStep('workspaces');
        break;
      case 'prerequisites':
        setStep('docker');
        break;
      case 'ports':
        setStep('prerequisites');
        break;
      case 'confirm':
        setStep('ports');
        break;
      // welcome and analyzing steps don't allow going back
    }
  };

  if (showAnalyzing) {
    return <AnalyzingStep theme={theme} />;
  }

  const stepTitles: Record<Step, string> = {
    welcome: '✨ Welcome',
    analyzing: '🔍 Analyzing',
    workspaces: '📦 Workspaces',
    docker: '🐳 Docker',
    prerequisites: '✅ Prerequisites',
    ports: '🔌 Ports',
    confirm: '📋 Confirm',
  };

  const stepNumbers: Record<Step, number> = {
    welcome: 1,
    analyzing: 1,
    workspaces: 2,
    docker: 3,
    prerequisites: 4,
    ports: 5,
    confirm: 6,
  };

  return (
    <ComposerLayout
      theme={theme}
      stepTitle={stepTitles[step]}
      currentStep={stepNumbers[step]}
      totalSteps={6}
      footerMode={step === 'confirm' ? 'confirm' : 'continue'}
    >
      {step === 'welcome' && <WelcomeStep detection={detection} theme={theme} />}
      {step === 'workspaces' && <WorkspacesStep workspaces={detection.workspaces} theme={theme} />}
      {step === 'docker' && <DockerStep docker={detection.docker} theme={theme} />}
      {step === 'prerequisites' && <PrerequisitesStep theme={theme} />}
      {step === 'ports' && <PortsStep theme={theme} />}
      {step === 'confirm' && (
        <ConfirmStep
          selectedWorkspaces={selectedWorkspaces}
          includeDocker={includeDocker}
          includePrerequisites={includePrerequisites}
          autoAllocatePorts={autoAllocatePorts}
          detection={detection}
          theme={theme}
        />
      )}
    </ComposerLayout>
  );
}

function AnalyzingStep({ theme }: { theme: import('../utils/preferences.js').Theme }): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={3} alignItems="center">
      <Box marginBottom={2}>
        <BigText text="CANTO" font="block" colors={[theme.colors.primary, theme.colors.info]} />
      </Box>
      <Box>
        <Text bold color={theme.colors.primary}>
          <Spinner type="dots" /> Analyzing your project structure...
        </Text>
      </Box>
    </Box>
  );
}

function WelcomeStep({ detection, theme }: { detection: ProjectDetectionResult; theme: import('../utils/preferences.js').Theme }): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          ✨ WELCOME TO CANTO COMPOSER!
        </Text>
      </Box>

      <Box>
        <Text>Let's set up your development environment with smart defaults.</Text>
      </Box>

      {/* Project Info */}
      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="round"
        borderColor={theme.colors.info}
        paddingX={2}
        paddingY={1}
      >
        <Box>
          <Text bold color={theme.colors.info}>
            PROJECT OVERVIEW
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text bold>Type: </Text>
          <Text color={theme.colors.primary} bold>
            {detection.projectType.toUpperCase()}
          </Text>
        </Box>
        <Box>
          <Text bold>Package Manager: </Text>
          <Text color={theme.colors.warning} bold>
            {detection.packageManager.toUpperCase()}
          </Text>
        </Box>
        <Box>
          <Text bold>Workspaces: </Text>
          <Text color={theme.colors.success} bold>
            {detection.workspaces.length}
          </Text>
        </Box>
        {detection.docker.composeFiles.length > 0 && (
          <Box>
            <Text bold>Docker Compose: </Text>
            <Text color={theme.colors.info} bold>
              {detection.docker.composeFiles.length} file(s)
            </Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text bold color={theme.colors.success}>
          👉 Ready to configure? Let's go!
        </Text>
      </Box>
    </Box>
  );
}

function WorkspacesStep({
  workspaces,
  theme,
}: {
  workspaces: ProjectDetectionResult['workspaces'];
  theme: import('../utils/preferences.js').Theme;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.success}>
          📦 DETECTED WORKSPACES
        </Text>
      </Box>

      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="round"
        borderColor={theme.colors.success}
        paddingX={2}
        paddingY={1}
      >
        {workspaces.slice(0, 8).map((workspace, idx) => (
          <Box key={workspace.name}>
            <Text color={theme.colors.success} bold>
              {idx + 1}.
            </Text>
            <Text> </Text>
            <Text bold color={theme.colors.primary}>
              {workspace.name}
            </Text>
            <Text dimColor> ({workspace.path.split(/[\/\\]/).slice(-2).join('/')})</Text>
          </Box>
        ))}
        {workspaces.length > 8 && (
          <Box marginTop={1}>
            <Text color={theme.colors.info} bold>
              +{workspaces.length - 8} more
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text bold color={theme.colors.warning}>
          💡 All workspaces will be included
        </Text>
      </Box>
    </Box>
  );
}

function DockerStep({ docker, theme }: { docker: ProjectDetectionResult['docker']; theme: import('../utils/preferences.js').Theme }): React.JSX.Element {
  if (docker.composeFiles.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box marginBottom={1}>
          <Text bold color={theme.colors.muted}>
            🐳 DOCKER CONFIGURATION
          </Text>
        </Box>
        <Box borderStyle="round" borderColor={theme.colors.warning} paddingX={2} paddingY={1}>
          <Text color={theme.colors.warning}>⚠️ No Docker Compose files detected. Skipping...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.info}>
          🐳 DOCKER CONFIGURATION
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.info} paddingX={2} paddingY={1}>
        <Text bold>Found Docker Compose files:</Text>
        {docker.composeFiles.map((file, idx) => (
          <Box key={file} marginTop={1}>
            <Text color={theme.colors.info} bold>
              {idx + 1}.
            </Text>
            <Text> </Text>
            <Text bold color={theme.colors.primary}>
              {file}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text bold>Include Docker infrastructure? </Text>
        <Text color={theme.colors.success} bold>
          (Recommended)
        </Text>
      </Box>
    </Box>
  );
}

function PrerequisitesStep({ theme }: { theme: import('../utils/preferences.js').Theme }): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          ✅ PREREQUISITES VALIDATION
        </Text>
      </Box>

      <Box>
        <Text>Add automatic prerequisite checks before starting modules?</Text>
      </Box>

      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="round"
        borderColor={theme.colors.primary}
        paddingX={2}
        paddingY={1}
      >
        <Text bold>This will validate:</Text>
        <Box marginTop={1}>
          <Text color={theme.colors.success}>✓</Text>
          <Text> Docker installation & daemon status</Text>
        </Box>
        <Box>
          <Text color={theme.colors.success}>✓</Text>
          <Text> Docker Compose availability</Text>
        </Box>
        <Box>
          <Text color={theme.colors.success}>✓</Text>
          <Text> Node.js version (≥18.0.0)</Text>
        </Box>
      </Box>

      <Box>
        <Text bold color={theme.colors.warning}>
          💡 Prevents runtime errors - Highly recommended!
        </Text>
      </Box>
    </Box>
  );
}

function PortsStep({ theme }: { theme: import('../utils/preferences.js').Theme }): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          🔌 PORT ALLOCATION
        </Text>
      </Box>

      <Box>
        <Text bold>Enable automatic port allocation?</Text>
      </Box>

      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="round"
        borderColor={theme.colors.primary}
        paddingX={2}
        paddingY={1}
      >
        <Text bold>Smart port management:</Text>
        <Box marginTop={1}>
          <Text color={theme.colors.info}>→</Text>
          <Text> Automatically detects port conflicts</Text>
        </Box>
        <Box>
          <Text color={theme.colors.info}>→</Text>
          <Text> Finds and assigns free ports</Text>
        </Box>
        <Box>
          <Text color={theme.colors.info}>→</Text>
          <Text> Prevents "address already in use" errors</Text>
        </Box>
      </Box>

      <Box>
        <Text bold color={theme.colors.warning}>
          💡 Saves time debugging port conflicts!
        </Text>
      </Box>
    </Box>
  );
}

function ConfirmStep({
  selectedWorkspaces,
  includeDocker,
  includePrerequisites,
  autoAllocatePorts,
  detection,
  theme,
}: {
  selectedWorkspaces: string[];
  includeDocker: boolean;
  includePrerequisites: boolean;
  autoAllocatePorts: boolean;
  detection: ProjectDetectionResult;
  theme: import('../utils/preferences.js').Theme;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color={theme.colors.primary}>
          📋 CONFIGURATION SUMMARY
        </Text>
      </Box>

      {/* Summary Table */}
      <Box flexDirection="column" borderStyle="round" borderColor={theme.colors.primary} paddingX={2} paddingY={1}>
        <Box>
          <Text bold dimColor>Project Type:</Text>
          <Text> </Text>
          <Text color={theme.colors.primary} bold>
            {detection.projectType.toUpperCase()}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text bold dimColor>Package Manager:</Text>
          <Text> </Text>
          <Text color={theme.colors.warning} bold>
            {detection.packageManager.toUpperCase()}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text bold dimColor>Workspaces:</Text>
          <Text> </Text>
          <Text color={theme.colors.success} bold>
            {selectedWorkspaces.length} modules
          </Text>
        </Box>
        {detection.docker.composeFiles.length > 0 && (
          <Box marginTop={1}>
            <Text bold dimColor>Docker:</Text>
            <Text> </Text>
            {includeDocker ? (
              <Text color={theme.colors.success} bold>
                ✓ ENABLED ({detection.docker.composeFiles.length} file{detection.docker.composeFiles.length > 1 ? 's' : ''})
              </Text>
            ) : (
              <Text color={theme.colors.error} bold>
                ✗ DISABLED
              </Text>
            )}
          </Box>
        )}
        <Box marginTop={1}>
          <Text bold dimColor>Prerequisites:</Text>
          <Text> </Text>
          {includePrerequisites ? (
            <Text color={theme.colors.success} bold>
              ✓ ENABLED
            </Text>
          ) : (
            <Text color={theme.colors.warning} bold>
              ✗ DISABLED
            </Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text bold dimColor>Auto Ports:</Text>
          <Text> </Text>
          {autoAllocatePorts ? (
            <Text color={theme.colors.success} bold>
              ✓ ENABLED
            </Text>
          ) : (
            <Text color={theme.colors.warning} bold>
              ✗ DISABLED
            </Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text bold color={theme.colors.primary}>
          Generate{' '}
        </Text>
        <Text color={theme.colors.primary} bold>
          dev.config.yaml
        </Text>
        <Text bold color={theme.colors.primary}>
          ?
        </Text>
      </Box>
    </Box>
  );
}
