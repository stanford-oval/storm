'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  ChevronLeft,
  X,
  CheckCircle,
  Circle,
  Play,
  BookOpen,
  Sparkles,
  ArrowRight,
  SkipForward,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Progress } from '../ui/progress';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target?: string; // CSS selector for the element to highlight
  placement?: 'top' | 'bottom' | 'left' | 'right';
  action?: 'hover' | 'click' | 'scroll' | 'none';
  skippable?: boolean;
  image?: string;
  video?: string;
}

interface TourGuideProps {
  isOpen?: boolean;
  onClose?: () => void;
  onComplete?: () => void;
  steps?: TourStep[];
  title?: string;
  className?: string;
  autoStart?: boolean;
}

const defaultSteps: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to STORM UI',
    content:
      "Let's take a quick tour to get you familiar with the interface and key features.",
    placement: 'bottom',
  },
  {
    id: 'dashboard',
    title: 'Dashboard Overview',
    content:
      'This is your main dashboard where you can see all your projects, recent activity, and quick actions.',
    target: '[data-tour="dashboard"]',
    placement: 'bottom',
  },
  {
    id: 'new-project',
    title: 'Create New Project',
    content:
      'Click here to start a new STORM project. You can choose from different templates or start from scratch.',
    target: '[data-tour="new-project"]',
    placement: 'left',
    action: 'hover',
  },
  {
    id: 'pipeline',
    title: 'Pipeline Management',
    content:
      'This section shows your active pipelines and their current status. You can monitor progress in real-time.',
    target: '[data-tour="pipeline"]',
    placement: 'right',
  },
  {
    id: 'command-palette',
    title: 'Command Palette',
    content:
      'Press Cmd+K (or Ctrl+K) anytime to open the command palette for quick access to any feature.',
    placement: 'top',
  },
  {
    id: 'analytics',
    title: 'Analytics Dashboard',
    content:
      'View detailed analytics about your projects, token usage, and performance metrics.',
    target: '[data-tour="analytics"]',
    placement: 'top',
  },
  {
    id: 'settings',
    title: 'Settings & Configuration',
    content:
      'Configure your API keys, preferences, and application settings from here.',
    target: '[data-tour="settings"]',
    placement: 'left',
  },
];

export const TourGuide: React.FC<TourGuideProps> = ({
  isOpen = false,
  onClose = () => {},
  onComplete,
  steps = defaultSteps,
  title = 'Getting Started Tour',
  className = '',
  autoStart = false,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Calculate tooltip position based on target element
  const updateTooltipPosition = (
    target: string,
    placement: string = 'bottom'
  ) => {
    const element = document.querySelector(target);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    let x = 0;
    let y = 0;

    switch (placement) {
      case 'top':
        x = rect.left + scrollLeft + rect.width / 2;
        y = rect.top + scrollTop - 20;
        break;
      case 'bottom':
        x = rect.left + scrollLeft + rect.width / 2;
        y = rect.bottom + scrollTop + 20;
        break;
      case 'left':
        x = rect.left + scrollLeft - 20;
        y = rect.top + scrollTop + rect.height / 2;
        break;
      case 'right':
        x = rect.right + scrollLeft + 20;
        y = rect.top + scrollTop + rect.height / 2;
        break;
    }

    setTooltipPosition({ x, y });
  };

  // Update position when step changes
  useEffect(() => {
    const step = steps[currentStep];
    if (step?.target) {
      updateTooltipPosition(step.target, step.placement);
    }
  }, [currentStep, steps]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const step = steps[currentStep];
      if (step?.target) {
        updateTooltipPosition(step.target, step.placement);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentStep, steps]);

  // Auto-start tour
  useEffect(() => {
    if (isOpen && autoStart) {
      setIsVisible(true);
    }
  }, [isOpen, autoStart]);

  const handleComplete = useCallback(() => {
    setIsVisible(false);
    onComplete?.();
    onClose();
  }, [onComplete, onClose]);

  const handleNext = useCallback(() => {
    const step = steps[currentStep];
    setCompletedSteps(prev => new Set([...Array.from(prev), step.id]));

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps, handleComplete]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  }, [currentStep]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    onClose();
  }, [onClose]);

  const handleStart = useCallback(() => {
    setIsVisible(true);
    setCurrentStep(0);
  }, []);

  const handleSkip = useCallback(() => {
    const step = steps[currentStep];
    if (step.skippable !== false) {
      handleNext();
    }
  }, [currentStep, steps, handleNext]);

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex);
  };

  // Keyboard navigation - moved after handler definitions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep, handleNext, handlePrevious, handleClose]);

  const currentStepData = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  // Create spotlight overlay for targeted elements
  const createSpotlight = () => {
    if (!currentStepData?.target) return null;

    const element = document.querySelector(currentStepData.target);
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    return (
      <div
        className="pointer-events-none fixed inset-0 z-40"
        style={{
          background: `radial-gradient(circle at ${rect.left + scrollLeft + rect.width / 2}px ${
            rect.top + scrollTop + rect.height / 2
          }px, transparent 0px, transparent ${Math.max(rect.width, rect.height) / 2 + 20}px, rgba(0,0,0,0.7) ${
            Math.max(rect.width, rect.height) / 2 + 40
          }px)`,
        }}
      />
    );
  };

  // Early return after all hooks
  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-30 bg-black/30"
          />

          {/* Spotlight overlay */}
          {isVisible && createSpotlight()}

          {/* Welcome Screen */}
          {!isVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 transform"
            >
              <Card className="max-w-md p-8 text-center shadow-2xl">
                <div className="mb-6">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <BookOpen className="h-8 w-8 text-blue-600" />
                  </div>
                  <h2 className="mb-2 text-2xl font-bold text-gray-900">
                    {title}
                  </h2>
                  <p className="text-gray-600">
                    Take a guided tour to learn about the key features and how
                    to get started.
                  </p>
                </div>

                <div className="flex justify-center gap-3">
                  <Button variant="outline" onClick={handleClose}>
                    Skip Tour
                  </Button>
                  <Button
                    onClick={handleStart}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Start Tour
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Tour Tooltip */}
          {isVisible && (
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed z-50 max-w-sm"
              style={{
                left: currentStepData?.target ? tooltipPosition.x : '50%',
                top: currentStepData?.target ? tooltipPosition.y : '50%',
                transform: currentStepData?.target
                  ? `translate(-50%, ${currentStepData.placement === 'top' ? '100%' : currentStepData.placement === 'bottom' ? '-100%' : '-50%'})`
                  : 'translate(-50%, -50%)',
              }}
            >
              <Card className="border-2 border-blue-200 shadow-2xl">
                {/* Header */}
                <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-blue-500" />
                      <span className="text-sm font-medium text-blue-600">
                        Step {currentStep + 1} of {steps.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleClose}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="mb-2 text-lg font-semibold text-gray-900">
                    {currentStepData.title}
                  </h3>
                  <p className="mb-4 text-gray-600">
                    {currentStepData.content}
                  </p>

                  {/* Media */}
                  {currentStepData.image && (
                    <img
                      src={currentStepData.image}
                      alt={currentStepData.title}
                      className="mb-4 w-full rounded-lg"
                    />
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t bg-gray-50 p-4">
                  <div className="flex items-center gap-1">
                    {steps.map((_, index) => (
                      <button
                        key={index}
                        onClick={() => handleStepClick(index)}
                        className="rounded-full p-1 transition-colors hover:bg-gray-200"
                      >
                        {completedSteps.has(steps[index].id) ? (
                          <CheckCircle className="h-3 w-3 text-green-500" />
                        ) : index === currentStep ? (
                          <Circle className="h-3 w-3 fill-current text-blue-500" />
                        ) : (
                          <Circle className="h-3 w-3 text-gray-300" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentStep > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrevious}
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                    )}

                    {currentStepData.skippable !== false &&
                      currentStep < steps.length - 1 && (
                        <Button variant="ghost" size="sm" onClick={handleSkip}>
                          <SkipForward className="mr-2 h-4 w-4" />
                          Skip
                        </Button>
                      )}

                    <Button size="sm" onClick={handleNext}>
                      {currentStep === steps.length - 1 ? (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Complete
                        </>
                      ) : (
                        <>
                          Next
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </Card>

              {/* Arrow pointer */}
              {currentStepData?.target && (
                <div
                  className="absolute h-0 w-0 border-8"
                  style={{
                    left: '50%',
                    transform: 'translateX(-50%)',
                    ...(currentStepData.placement === 'top' && {
                      bottom: '100%',
                      borderLeftColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderTopColor: 'transparent',
                      borderBottomColor: 'white',
                    }),
                    ...(currentStepData.placement === 'bottom' && {
                      top: '100%',
                      borderLeftColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderBottomColor: 'transparent',
                      borderTopColor: 'white',
                    }),
                    ...(currentStepData.placement === 'left' && {
                      right: '100%',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      borderTopColor: 'transparent',
                      borderBottomColor: 'transparent',
                      borderLeftColor: 'transparent',
                      borderRightColor: 'white',
                    }),
                    ...(currentStepData.placement === 'right' && {
                      left: '100%',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      borderTopColor: 'transparent',
                      borderBottomColor: 'transparent',
                      borderRightColor: 'transparent',
                      borderLeftColor: 'white',
                    }),
                  }}
                />
              )}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
};
