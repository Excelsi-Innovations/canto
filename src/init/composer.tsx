import React, { useState, useMemo } from 'react';
import { useInput } from 'ink';
import { useTheme } from '../cli/lib/themes.js';
import { ComposerLayout } from './components/ComposerLayout.js';
import type { ProjectDetectionResult } from './detector.js';
import { initState, type ComposerState } from './composer-state.js';
import { generateConfig, configToYaml } from './templates.js';

// Import Steps
import { WelcomeStep } from './steps/WelcomeStep.js';
import { ModuleSelector } from './steps/ModuleSelector.js';
import { PrerequisitesStep } from './steps/PrerequisitesStep.js';
import { ReviewStep } from './steps/ReviewStep.js';

interface CantoComposerProps {
  detection: ProjectDetectionResult;
  onComplete: (state: ComposerState) => void;
  onCancel?: () => void;
}

type Step = 'welcome' | 'modules' | 'prerequisites' | 'review';
const STEPS: Step[] = ['welcome', 'modules', 'prerequisites', 'review'];

export function CantoComposer({
  detection,
  onComplete,
  onCancel,
}: CantoComposerProps): React.JSX.Element {
  const theme = useTheme();
  const [stepIndex, setStepIndex] = useState(0);
  const [state, setState] = useState<ComposerState>(() => initState(detection));

  const currentStep = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;

  // Global Input Handling
  useInput((_, key) => {
    if (key.escape && onCancel) {
      onCancel();
    }
  });

  // Actions
  const handleNext = () => {
    if (isLastStep) {
      onComplete(state);
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  // State Updates
  const toggleModule = (name: string) => {
    setState((prev) => {
      const modules = prev.modules.map((m) => {
        if (m.name === name) {
          return { ...m, enabled: !m.enabled };
        }
        return m;
      });
      return { ...prev, modules };
    });
  };

  const toggleScript = (name: string) => {
    setState((prev) => ({
      ...prev,
      customScripts: {
        ...prev.customScripts,
        [name]: !prev.customScripts[name],
      },
    }));
  };

  const updateNodeVersion = (version: string) => {
    setState((prev) => ({ ...prev, nodeVersion: version }));
  };

  const toggleDocker = () => {
    setState((prev) => ({ ...prev, requireDocker: !prev.requireDocker }));
  };

  const toggleCompose = () => {
    setState((prev) => ({ ...prev, requireDockerCompose: !prev.requireDockerCompose }));
  };

  // derived YAML for review step
  const previewYaml = useMemo(() => {
    if (currentStep === 'review') {
      const config = generateConfig(state);
      return configToYaml(config);
    }
    return '';
  }, [state, currentStep]);

  return (
    <ComposerLayout
      stepTitle={
        currentStep === 'welcome'
          ? 'Analyzer'
          : currentStep === 'modules'
            ? 'Modules'
            : currentStep === 'prerequisites'
              ? 'Prerequisites'
              : 'Review'
      }
      currentStep={stepIndex + 1}
      totalSteps={STEPS.length}
      theme={theme}
    >
      {currentStep === 'welcome' && (
        <WelcomeStep detection={detection} theme={theme} onNext={handleNext} />
      )}

      {currentStep === 'modules' && (
        <ModuleSelector
          state={state}
          theme={theme}
          onToggleModule={toggleModule}
          onToggleScript={toggleScript}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {currentStep === 'prerequisites' && (
        <PrerequisitesStep
          state={state}
          theme={theme}
          onChangeNodeVersion={updateNodeVersion}
          onToggleDocker={toggleDocker}
          onToggleCompose={toggleCompose}
          onNext={handleNext}
          onBack={handleBack}
        />
      )}

      {currentStep === 'review' && (
        <ReviewStep yaml={previewYaml} theme={theme} onConfirm={handleNext} onBack={handleBack} />
      )}
    </ComposerLayout>
  );
}
