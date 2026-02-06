import React, { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
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

type Step = 'welcome' | 'workspaces' | 'docker' | 'prerequisites' | 'ports' | 'confirm';

/**
 * Interactive init wizard component
 * Uses Ink for terminal UI
 */
export function InitWizard({
  detection,
  onComplete,
  onCancel,
}: InitWizardProps): React.JSX.Element {
  const { exit } = useApp();
  const [step, setStep] = useState<Step>('welcome');
  const [selectedWorkspaces] = useState<string[]>(detection.workspaces.map((w) => w.name));
  const [includeDocker, setIncludeDocker] = useState(detection.docker.composeFiles.length > 0);
  const [includePrerequisites, setIncludePrerequisites] = useState(true);
  const [autoAllocatePorts, setAutoAllocatePorts] = useState(true);

  useInput((input: string, key: { escape?: boolean; return?: boolean }) => {
    if (key.escape || (input === 'q' && step === 'welcome')) {
      onCancel();
      exit();
      return;
    }

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
        setStep(detection.workspaces.length > 0 ? 'workspaces' : 'docker');
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

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🚀 Canto Init Wizard
        </Text>
      </Box>

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
        />
      )}

      <Box marginTop={1}>
        <Text dimColor>Press Enter to continue, Esc to cancel</Text>
      </Box>
    </Box>
  );
}

function WelcomeStep({ detection }: { detection: ProjectDetectionResult }): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text>
        Detected <Text color="green">{detection.projectType}</Text> project using{' '}
        <Text color="yellow">{detection.packageManager}</Text>
      </Text>
      <Box marginTop={1}>
        <Text>
          Found <Text bold>{detection.workspaces.length}</Text> workspace(s)
        </Text>
      </Box>
      {detection.docker.composeFiles.length > 0 && (
        <Box marginTop={1}>
          <Text>
            Found <Text bold>{detection.docker.composeFiles.length}</Text> Docker Compose file(s)
          </Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="cyan">Let's configure your project!</Text>
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
    <Box flexDirection="column">
      <Text bold>Found workspaces:</Text>
      <Box flexDirection="column" marginTop={1}>
        {workspaces.map((workspace) => (
          <Box key={workspace.name}>
            <Text color="green">✓</Text>
            <Text>
              {' '}
              {workspace.name} <Text dimColor>({workspace.path})</Text>
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text>All workspaces will be included in the configuration.</Text>
      </Box>
    </Box>
  );
}

function DockerStep({ docker }: { docker: ProjectDetectionResult['docker'] }): React.JSX.Element {
  if (docker.composeFiles.length === 0) {
    return (
      <Box flexDirection="column">
        <Text>No Docker Compose files detected.</Text>
        <Text dimColor>Skipping Docker configuration...</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      <Text>
        Found Docker Compose: <Text color="cyan">{docker.composeFiles[0]}</Text>
      </Text>
      <Box marginTop={1}>
        <Text>Include Docker infrastructure in configuration? (Y/n)</Text>
      </Box>
    </Box>
  );
}

function PrerequisitesStep(): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text>Add prerequisites validation?</Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>This will check for:</Text>
        <Text dimColor> • Docker installation and status</Text>
        <Text dimColor> • Docker Compose availability</Text>
        <Text dimColor> • Node.js version (&gt;=18.0.0)</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Include prerequisites? (Y/n)</Text>
      </Box>
    </Box>
  );
}

function PortsStep(): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text>Enable automatic port allocation?</Text>
      <Box marginTop={1}>
        <Text dimColor>Canto will automatically find and assign free ports to modules.</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Enable auto port allocation? (Y/n)</Text>
      </Box>
    </Box>
  );
}

function ConfirmStep({
  selectedWorkspaces,
  includeDocker,
  includePrerequisites,
  autoAllocatePorts,
}: {
  selectedWorkspaces: string[];
  includeDocker: boolean;
  includePrerequisites: boolean;
  autoAllocatePorts: boolean;
}): React.JSX.Element {
  return (
    <Box flexDirection="column">
      <Text bold>Configuration Summary:</Text>
      <Box marginTop={1} flexDirection="column">
        <Text>
          Workspaces: <Text color="green">{selectedWorkspaces.length}</Text>
        </Text>
        <Text>
          Docker:{' '}
          <Text color={includeDocker ? 'green' : 'red'}>{includeDocker ? 'Yes' : 'No'}</Text>
        </Text>
        <Text>
          Prerequisites:{' '}
          <Text color={includePrerequisites ? 'green' : 'red'}>
            {includePrerequisites ? 'Yes' : 'No'}
          </Text>
        </Text>
        <Text>
          Auto Ports:{' '}
          <Text color={autoAllocatePorts ? 'green' : 'red'}>
            {autoAllocatePorts ? 'Yes' : 'No'}
          </Text>
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>Generate dev.config.yaml? (Y/n)</Text>
      </Box>
    </Box>
  );
}
