import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { within } from '@storybook/test';
import { PipelineProgress } from './PipelineProgress';
import { PipelineProgress as PipelineProgressType } from '@/types/storm';

const meta: Meta<typeof PipelineProgress> = {
  title: 'Components/Storm/PipelineProgress',
  component: PipelineProgress,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onCancel: { action: 'cancelled' },
    showDetails: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const baseProgress: PipelineProgressType = {
  stage: 'research',
  stageProgress: 45,
  overallProgress: 25,
  startTime: new Date('2024-01-16T10:00:00Z'),
  currentTask:
    'Conducting perspective research on machine learning applications...',
  errors: [],
};

export const Default: Story = {
  args: {
    progress: baseProgress,
    onCancel: action('onCancel'),
  },
};

export const Initializing: Story = {
  args: {
    progress: {
      stage: 'initializing',
      stageProgress: 10,
      overallProgress: 2,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Setting up pipeline configuration...',
      errors: [],
    },
    onCancel: action('onCancel'),
  },
};

export const ResearchPhase: Story = {
  args: {
    progress: {
      stage: 'research',
      stageProgress: 65,
      overallProgress: 30,
      startTime: new Date('2024-01-16T10:00:00Z'),
      estimatedEndTime: new Date('2024-01-16T11:30:00Z'),
      currentTask: 'Analyzing sources from academic databases...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const OutlineGeneration: Story = {
  args: {
    progress: {
      stage: 'outline_generation',
      stageProgress: 80,
      overallProgress: 55,
      startTime: new Date('2024-01-16T10:00:00Z'),
      estimatedEndTime: new Date('2024-01-16T11:15:00Z'),
      currentTask: 'Structuring main sections and subsections...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const ArticleGeneration: Story = {
  args: {
    progress: {
      stage: 'article_generation',
      stageProgress: 40,
      overallProgress: 70,
      startTime: new Date('2024-01-16T10:00:00Z'),
      estimatedEndTime: new Date('2024-01-16T11:45:00Z'),
      currentTask: 'Writing section: "Deep Learning Architectures"...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const PolishingPhase: Story = {
  args: {
    progress: {
      stage: 'polishing',
      stageProgress: 90,
      overallProgress: 95,
      startTime: new Date('2024-01-16T10:00:00Z'),
      estimatedEndTime: new Date('2024-01-16T11:00:00Z'),
      currentTask: 'Finalizing citations and cross-references...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const Completed: Story = {
  args: {
    progress: {
      stage: 'completed',
      stageProgress: 100,
      overallProgress: 100,
      startTime: new Date('2024-01-16T10:00:00Z'),
      estimatedEndTime: new Date('2024-01-16T11:30:00Z'),
      currentTask: 'Article generation completed successfully!',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const WithWarnings: Story = {
  args: {
    progress: {
      stage: 'research',
      stageProgress: 50,
      overallProgress: 20,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Retrieving sources from web databases...',
      errors: [
        {
          stage: 'research',
          message: 'Some sources may be outdated or unavailable',
          timestamp: new Date('2024-01-16T10:10:00Z'),
          severity: 'warning',
        },
        {
          stage: 'research',
          message: 'Rate limit approaching for search API',
          timestamp: new Date('2024-01-16T10:15:00Z'),
          severity: 'warning',
        },
      ],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const WithErrors: Story = {
  args: {
    progress: {
      stage: 'research',
      stageProgress: 25,
      overallProgress: 10,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Attempting to reconnect to research database...',
      errors: [
        {
          stage: 'research',
          message: 'API key invalid or expired',
          timestamp: new Date('2024-01-16T10:05:00Z'),
          severity: 'error',
        },
        {
          stage: 'research',
          message: 'Connection timeout to external service',
          timestamp: new Date('2024-01-16T10:12:00Z'),
          severity: 'error',
        },
      ],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const CriticalError: Story = {
  args: {
    progress: {
      stage: 'research',
      stageProgress: 15,
      overallProgress: 5,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Pipeline stopped due to critical error',
      errors: [
        {
          stage: 'research',
          message: 'Insufficient API credits remaining',
          timestamp: new Date('2024-01-16T10:08:00Z'),
          severity: 'critical',
        },
      ],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const LongRunning: Story = {
  args: {
    progress: {
      stage: 'article_generation',
      stageProgress: 30,
      overallProgress: 65,
      startTime: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
      estimatedEndTime: new Date(Date.now() + 25 * 60 * 1000), // 25 minutes from now
      currentTask:
        'Generating comprehensive analysis of quantum computing applications in cryptography and security systems...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const NoEstimatedTime: Story = {
  args: {
    progress: {
      stage: 'research',
      stageProgress: 35,
      overallProgress: 15,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Analyzing complex research patterns...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};

export const Compact: Story = {
  args: {
    progress: baseProgress,
    showDetails: false,
    onCancel: action('onCancel'),
  },
};

export const WithoutCancel: Story = {
  args: {
    progress: baseProgress,
    showDetails: true,
  },
};

// Animation demonstration
export const AnimatedProgress: Story = {
  args: {
    progress: baseProgress,
    showDetails: true,
    onCancel: action('onCancel'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Progress bar with smooth animations and transitions.',
      },
    },
  },
};

// Different screen sizes
export const MobileView: Story = {
  args: {
    progress: {
      stage: 'article_generation',
      stageProgress: 60,
      overallProgress: 75,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Writing detailed analysis...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

export const TabletView: Story = {
  args: {
    progress: {
      stage: 'outline_generation',
      stageProgress: 75,
      overallProgress: 50,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Organizing content structure...',
      errors: [],
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

// Dark theme
export const DarkTheme: Story = {
  args: {
    progress: baseProgress,
    showDetails: true,
    onCancel: action('onCancel'),
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
  decorators: [
    Story => (
      <div className="dark bg-gray-900 p-8">
        <Story />
      </div>
    ),
  ],
};

// All stages comparison
export const AllStages: Story = {
  render: () => (
    <div className="space-y-6 p-4">
      {[
        {
          stage: 'initializing' as const,
          stageProgress: 50,
          overallProgress: 5,
          currentTask: 'Initializing pipeline...',
        },
        {
          stage: 'research' as const,
          stageProgress: 75,
          overallProgress: 25,
          currentTask: 'Conducting research...',
        },
        {
          stage: 'outline_generation' as const,
          stageProgress: 60,
          overallProgress: 45,
          currentTask: 'Generating outline...',
        },
        {
          stage: 'article_generation' as const,
          stageProgress: 40,
          overallProgress: 70,
          currentTask: 'Writing article...',
        },
        {
          stage: 'polishing' as const,
          stageProgress: 80,
          overallProgress: 90,
          currentTask: 'Polishing content...',
        },
        {
          stage: 'completed' as const,
          stageProgress: 100,
          overallProgress: 100,
          currentTask: 'Completed successfully!',
        },
      ].map((progress, index) => (
        <PipelineProgress
          key={index}
          progress={{
            ...progress,
            startTime: new Date('2024-01-16T10:00:00Z'),
            errors: [],
          }}
          showDetails={true}
          onCancel={action('onCancel')}
        />
      ))}
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Performance test with many error messages
export const ManyErrors: Story = {
  args: {
    progress: {
      stage: 'research',
      stageProgress: 20,
      overallProgress: 8,
      startTime: new Date('2024-01-16T10:00:00Z'),
      currentTask: 'Handling multiple service issues...',
      errors: Array.from({ length: 10 }, (_, i) => ({
        stage: 'research' as const,
        message: `Error ${i + 1}: Service unavailable for source ${i + 1}`,
        timestamp: new Date(`2024-01-16T10:0${i}:00Z`),
        severity: (i % 3 === 0
          ? 'critical'
          : i % 2 === 0
            ? 'error'
            : 'warning') as 'critical' | 'error' | 'warning',
      })),
    },
    showDetails: true,
    onCancel: action('onCancel'),
  },
};
