import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import BigText from 'ink-big-text';
import type { ProjectDetectionResult } from './detector.js';

interface InitWizardProps {
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
 * Interactive init wizard component with enhanced visibility
 * Uses Ink for terminal UI with strong colors and clear hierarchy
 */
export function InitWizard({
  detection,
  onComplete,
  onCancel,
}: InitWizardProps): React.JSX.Element {
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

    if (key.return || input === 'y') {
      handleNext();
    }

    if (input === 'n') {
      handleNo();
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

  if (showAnalyzing) {
    return <AnalyzingStep />;
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold backgroundColor="cyan" color="black">
          {' '}
          🎵 CANTO INIT WIZARD{' '}
        </Text>
      </Box>

      {/* Main Content */}
      <Box borderStyle="bold" borderColor="cyan" paddingX={3} paddingY={1} flexDirection="column">
        {step === 'welcome' && <WelcomeStep detection={detection} />}
        {step === 'workspaces' && <WorkspacesStep workspaces={detection.workspaces} />}
        {step === 'docker' && <DockerStep docker={detection.docker} />}
        {step === 'prerequisites' && <PrerequisitesStep />}
        {step === 'ports' && <PortsStep />}
        {step === 'confirm' && (
          <ConfirmStep
            selectedWorkspaces={selectedWorkspaces}
            includeDocker={includeDocker}
            includePrerequisites={includePrerequisites}
            autoAllocatePorts={autoAllocatePorts}
            detection={detection}
          />
        )}
      </Box>

      {/* Footer with Instructions */}
      <Box marginTop={1} borderStyle="single" borderColor="gray" paddingX={2}>
        {step === 'confirm' ? (
          <Text>
            <Text backgroundColor="green" color="black" bold>
              {' '}
              Y{' '}
            </Text>
            <Text> Generate Config </Text>
            <Text backgroundColor="red" color="white" bold>
              {' '}
              N{' '}
            </Text>
            <Text> Cancel </Text>
            <Text backgroundColor="gray" color="white" bold>
              {' '}
              ESC{' '}
            </Text>
            <Text> Exit</Text>
          </Text>
        ) : (
          <Text>
            <Text backgroundColor="green" color="black" bold>
              {' '}
              ↵ ENTER{' '}
            </Text>
            <Text> Continue </Text>
            <Text backgroundColor="yellow" color="black" bold>
              {' '}
              N{' '}
            </Text>
            <Text> No </Text>
            <Text backgroundColor="gray" color="white" bold>
              {' '}
              ESC{' '}
            </Text>
            <Text> Cancel</Text>
          </Text>
        )}
      </Box>
    </Box>
  );
}

function AnalyzingStep(): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={3} alignItems="center">
      <Box marginBottom={2}>
        <BigText text="CANTO" font="block" colors={['cyan', 'blue']} />
      </Box>
      <Box>
        <Text bold color="cyan">
          <Spinner type="dots" /> Analyzing your project structure...
        </Text>
      </Box>
    </Box>
  );
}

function WelcomeStep({ detection }: { detection: ProjectDetectionResult }): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          ✨ WELCOME TO CANTO!
        </Text>
      </Box>

      <Box>
        <Text>Let's set up your development environment with smart defaults.</Text>
      </Box>

      {/* Project Info - High Contrast */}
      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="single"
        borderColor="blue"
        paddingX={2}
        paddingY={1}
      >
        <Box>
          <Text backgroundColor="blue" color="white" bold>
            {' '}
            PROJECT{' '}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text bold>Type: </Text>
          <Text backgroundColor="magenta" color="white" bold>
            {' '}
            {detection.projectType.toUpperCase()}{' '}
          </Text>
        </Box>
        <Box>
          <Text bold>Package Manager: </Text>
          <Text backgroundColor="yellow" color="black" bold>
            {' '}
            {detection.packageManager.toUpperCase()}{' '}
          </Text>
        </Box>
        <Box>
          <Text bold>Workspaces: </Text>
          <Text backgroundColor="green" color="black" bold>
            {' '}
            {detection.workspaces.length}{' '}
          </Text>
        </Box>
        {detection.docker.composeFiles.length > 0 && (
          <Box>
            <Text bold>Docker Compose: </Text>
            <Text backgroundColor="blue" color="white" bold>
              {' '}
              {detection.docker.composeFiles.length} file(s){' '}
            </Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text bold color="green">
          👉 Ready to configure? Let's go!
        </Text>
      </Box>
    </Box>
  );
}

function WorkspacesStep({
  workspaces,
}: {
  workspaces: ProjectDetectionResult['workspaces'];
}): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text backgroundColor="green" color="black" bold>
          {' '}
          📦 DETECTED WORKSPACES{' '}
        </Text>
      </Box>

      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="single"
        borderColor="green"
        paddingX={2}
        paddingY={1}
      >
        {workspaces.slice(0, 8).map((workspace, idx) => (
          <Box key={workspace.name}>
            <Text backgroundColor="green" color="white" bold>
              {' '}
              {idx + 1}{' '}
            </Text>
            <Text> </Text>
            <Text bold color="white">
              {workspace.name}
            </Text>
            <Text dimColor> ({workspace.path.split(/[/\\]/).slice(-2).join('/')})</Text>
          </Box>
        ))}
        {workspaces.length > 8 && (
          <Box marginTop={1}>
            <Text backgroundColor="blue" color="white" bold>
              {' '}
              +{workspaces.length - 8} more{' '}
            </Text>
          </Box>
        )}
      </Box>

      <Box>
        <Text bold color="yellow">
          💡 All workspaces will be included
        </Text>
      </Box>
    </Box>
  );
}

function DockerStep({ docker }: { docker: ProjectDetectionResult['docker'] }): React.JSX.Element {
  if (docker.composeFiles.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box marginBottom={1}>
          <Text backgroundColor="gray" color="white" bold>
            {' '}
            🐳 DOCKER CONFIGURATION{' '}
          </Text>
        </Box>
        <Box borderStyle="single" borderColor="yellow" paddingX={2} paddingY={1}>
          <Text color="yellow">⚠️ No Docker Compose files detected. Skipping...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text backgroundColor="blue" color="white" bold>
          {' '}
          🐳 DOCKER CONFIGURATION{' '}
        </Text>
      </Box>

      <Box flexDirection="column" borderStyle="single" borderColor="blue" paddingX={2} paddingY={1}>
        <Text bold>Found Docker Compose files:</Text>
        {docker.composeFiles.map((file, idx) => (
          <Box key={file} marginTop={1}>
            <Text backgroundColor="blue" color="white" bold>
              {' '}
              {idx + 1}{' '}
            </Text>
            <Text> </Text>
            <Text bold color="cyan">
              {file}
            </Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text bold>Include Docker infrastructure? </Text>
        <Text color="green" bold>
          (Recommended)
        </Text>
      </Box>
    </Box>
  );
}

function PrerequisitesStep(): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text backgroundColor="cyan" color="black" bold>
          {' '}
          ✅ PREREQUISITES VALIDATION{' '}
        </Text>
      </Box>

      <Box>
        <Text>Add automatic prerequisite checks before starting modules?</Text>
      </Box>

      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="single"
        borderColor="cyan"
        paddingX={2}
        paddingY={1}
      >
        <Text bold color="white">
          This will validate:
        </Text>
        <Box marginTop={1}>
          <Text color="green">✓</Text>
          <Text> Docker installation & daemon status</Text>
        </Box>
        <Box>
          <Text color="green">✓</Text>
          <Text> Docker Compose availability</Text>
        </Box>
        <Box>
          <Text color="green">✓</Text>
          <Text> Node.js version (≥18.0.0)</Text>
        </Box>
      </Box>

      <Box>
        <Text bold color="yellow">
          💡 Prevents runtime errors - Highly recommended!
        </Text>
      </Box>
    </Box>
  );
}

function PortsStep(): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text backgroundColor="magenta" color="white" bold>
          {' '}
          🔌 PORT ALLOCATION{' '}
        </Text>
      </Box>

      <Box>
        <Text bold>Enable automatic port allocation?</Text>
      </Box>

      <Box
        flexDirection="column"
        marginY={1}
        borderStyle="single"
        borderColor="magenta"
        paddingX={2}
        paddingY={1}
      >
        <Text bold color="white">
          Smart port management:
        </Text>
        <Box marginTop={1}>
          <Text color="cyan">→</Text>
          <Text> Automatically detects port conflicts</Text>
        </Box>
        <Box>
          <Text color="cyan">→</Text>
          <Text> Finds and assigns free ports</Text>
        </Box>
        <Box>
          <Text color="cyan">→</Text>
          <Text> Prevents "address already in use" errors</Text>
        </Box>
      </Box>

      <Box>
        <Text bold color="yellow">
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
}: {
  selectedWorkspaces: string[];
  includeDocker: boolean;
  includePrerequisites: boolean;
  autoAllocatePorts: boolean;
  detection: ProjectDetectionResult;
}): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box marginBottom={1}>
        <Text backgroundColor="cyan" color="black" bold>
          {' '}
          📋 CONFIGURATION SUMMARY{' '}
        </Text>
      </Box>

      {/* Summary Table */}
      <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1}>
        <Box>
          <Text bold dimColor>
            Project Type:
          </Text>
          <Text> </Text>
          <Text backgroundColor="magenta" color="white" bold>
            {' '}
            {detection.projectType.toUpperCase()}{' '}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text bold dimColor>
            Package Manager:
          </Text>
          <Text> </Text>
          <Text backgroundColor="yellow" color="black" bold>
            {' '}
            {detection.packageManager.toUpperCase()}{' '}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text bold dimColor>
            Workspaces:
          </Text>
          <Text> </Text>
          <Text backgroundColor="green" color="black" bold>
            {' '}
            {selectedWorkspaces.length} modules{' '}
          </Text>
        </Box>
        {detection.docker.composeFiles.length > 0 && (
          <Box marginTop={1}>
            <Text bold dimColor>
              Docker:
            </Text>
            <Text> </Text>
            {includeDocker ? (
              <Text backgroundColor="blue" color="white" bold>
                {' '}
                ✓ ENABLED ({detection.docker.composeFiles.length} file
                {detection.docker.composeFiles.length > 1 ? 's' : ''}){' '}
              </Text>
            ) : (
              <Text backgroundColor="red" color="white" bold>
                {' '}
                ✗ DISABLED{' '}
              </Text>
            )}
          </Box>
        )}
        <Box marginTop={1}>
          <Text bold dimColor>
            Prerequisites:
          </Text>
          <Text> </Text>
          {includePrerequisites ? (
            <Text backgroundColor="green" color="black" bold>
              {' '}
              ✓ ENABLED{' '}
            </Text>
          ) : (
            <Text backgroundColor="yellow" color="black" bold>
              {' '}
              ✗ DISABLED{' '}
            </Text>
          )}
        </Box>
        <Box marginTop={1}>
          <Text bold dimColor>
            Auto Ports:
          </Text>
          <Text> </Text>
          {autoAllocatePorts ? (
            <Text backgroundColor="green" color="black" bold>
              {' '}
              ✓ ENABLED{' '}
            </Text>
          ) : (
            <Text backgroundColor="yellow" color="black" bold>
              {' '}
              ✗ DISABLED{' '}
            </Text>
          )}
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text bold color="cyan">
          Generate{' '}
        </Text>
        <Text backgroundColor="cyan" color="black" bold>
          {' '}
          dev.config.yaml{' '}
        </Text>
        <Text bold color="cyan">
          ?
        </Text>
      </Box>
    </Box>
  );
}
