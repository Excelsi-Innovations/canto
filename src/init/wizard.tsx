import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import Spinner from 'ink-spinner';
import Gradient from 'ink-gradient';
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

type Step = 'welcome' | 'analyzing' | 'workspaces' | 'docker' | 'prerequisites' | 'ports' | 'confirm';

/**
 * Interactive init wizard component with beautiful UI
 * Uses Ink for terminal UI with animations and colors
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
      <Box marginBottom={1}>
        <Gradient name="rainbow">
          <Text bold>🎵 Canto Init Wizard</Text>
        </Gradient>
      </Box>

      <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={1} flexDirection="column">
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

      <Box marginTop={1}>
        <Text dimColor>
          {step === 'confirm' ? (
            <>
              <Text color="green" bold>Y</Text>es to generate  <Text color="red" bold>N</Text>o to cancel  
              <Text color="gray" bold> ESC</Text> to exit
            </>
          ) : (
            <>
              <Text color="green" bold>↵ Enter</Text> to continue  
              <Text color="yellow" bold>N</Text> for No  
              <Text color="gray" bold>ESC</Text> to cancel
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
}

function AnalyzingStep(): React.JSX.Element {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={2}>
      <Box marginBottom={2}>
        <BigText text="Canto" font="tiny" colors={['cyan', 'magenta']} />
      </Box>
      <Box>
        <Text color="cyan">
          <Spinner type="dots" /> Analyzing your project...
        </Text>
      </Box>
    </Box>
  );
}

function WelcomeStep({ detection }: { detection: ProjectDetectionResult }): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>✨ Welcome to Canto! Let's set up your development environment.</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Box>
          <Text color="green">🔍 Project Type: </Text>
          <Text bold color="cyan">{detection.projectType}</Text>
        </Box>
        <Box>
          <Text color="green">📦 Package Manager: </Text>
          <Text bold color="yellow">{detection.packageManager}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          I've detected {detection.workspaces.length} workspace(s) 
          {detection.docker.composeFiles.length > 0 && ` and ${detection.docker.composeFiles.length} Docker Compose file(s)`}.
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="cyan">Ready to configure? Let's go! 🚀</Text>
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
      <Box>
        <Text bold color="cyan">📦 Detected Workspaces</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {workspaces.slice(0, 10).map((workspace) => (
          <Box key={workspace.name} paddingLeft={2}>
            <Text color="green">✓ </Text>
            <Text bold>{workspace.name}</Text>
            <Text dimColor> ({workspace.path.split(/[/\\]/).slice(-2).join('/')})</Text>
          </Box>
        ))}
        {workspaces.length > 10 && (
          <Box paddingLeft={2}>
            <Text dimColor>... and {workspaces.length - 10} more</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">💡 All workspaces will be included in your configuration.</Text>
      </Box>
    </Box>
  );
}

function DockerStep({ docker }: { docker: ProjectDetectionResult['docker'] }): React.JSX.Element {
  if (docker.composeFiles.length === 0) {
    return (
      <Box flexDirection="column" gap={1}>
        <Box>
          <Text bold color="yellow">🐳 Docker Configuration</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>No Docker Compose files detected. Skipping...</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold color="cyan">🐳 Docker Configuration</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        {docker.composeFiles.map((file) => (
          <Box key={file}>
            <Text color="blue">📄 </Text>
            <Text>{file}</Text>
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text>Include Docker infrastructure in configuration?</Text>
      </Box>
    </Box>
  );
}

function PrerequisitesStep(): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold color="cyan">✅ Prerequisites Validation</Text>
      </Box>

      <Box marginTop={1}>
        <Text>Add automatic prerequisite checks before starting modules?</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingLeft={2}>
        <Box>
          <Text dimColor>→ Docker installation & status</Text>
        </Box>
        <Box>
          <Text dimColor>→ Docker Compose availability</Text>
        </Box>
        <Box>
          <Text dimColor>→ Node.js version (≥18.0.0)</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">💡 Recommended for preventing runtime errors</Text>
      </Box>
    </Box>
  );
}

function PortsStep(): React.JSX.Element {
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text bold color="cyan">🔌 Port Allocation</Text>
      </Box>

      <Box marginTop={1}>
        <Text>Enable automatic port allocation?</Text>
      </Box>

      <Box marginTop={1} paddingLeft={2}>
        <Text dimColor>
          Canto will automatically find and assign free ports if conflicts are detected.
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">💡 Prevents "port already in use" errors</Text>
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
      <Box>
        <Text bold color="cyan">📋 Configuration Summary</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingLeft={2} gap={0}>
        <Box>
          <Text>Project Type: </Text>
          <Text bold color="magenta">{detection.projectType}</Text>
        </Box>
        <Box>
          <Text>Package Manager: </Text>
          <Text bold color="yellow">{detection.packageManager}</Text>
        </Box>
        <Box>
          <Text>Workspaces: </Text>
          <Text bold color={selectedWorkspaces.length > 0 ? 'green' : 'red'}>
            {selectedWorkspaces.length}
          </Text>
        </Box>
        {detection.docker.composeFiles.length > 0 && (
          <Box>
            <Text>Docker: </Text>
            <Text bold color={includeDocker ? 'green' : 'red'}>
              {includeDocker ? `Yes (${detection.docker.composeFiles.length} file${detection.docker.composeFiles.length > 1 ? 's' : ''})` : 'No'}
            </Text>
          </Box>
        )}
        <Box>
          <Text>Prerequisites: </Text>
          <Text bold color={includePrerequisites ? 'green' : 'yellow'}>
            {includePrerequisites ? 'Enabled' : 'Disabled'}
          </Text>
        </Box>
        <Box>
          <Text>Auto Ports: </Text>
          <Text bold color={autoAllocatePorts ? 'green' : 'yellow'}>
            {autoAllocatePorts ? 'Enabled' : 'Disabled'}
          </Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <Text>
          Generate <Text bold color="cyan">dev.config.yaml</Text>?
        </Text>
      </Box>
    </Box>
  );
}
