import type { Meta, StoryObj } from '@storybook/react';
import { action } from '@storybook/addon-actions';
import { within, userEvent } from '@storybook/test';
import { ProjectCard } from './ProjectCard';
import { StormProject } from '@/types/storm';

const meta: Meta<typeof ProjectCard> = {
  title: 'Components/Storm/ProjectCard',
  component: ProjectCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onSelect: { action: 'selected' },
    onDelete: { action: 'deleted' },
    onDuplicate: { action: 'duplicated' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const baseProject: StormProject = {
  id: 'project-1',
  title: 'Artificial Intelligence Overview',
  topic: 'Machine Learning and AI Technologies',
  description:
    'A comprehensive guide to modern AI technologies and their applications in various industries.',
  status: 'draft',
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-16T14:30:00Z'),
  config: {
    llm: {
      model: 'gpt-4o',
      provider: 'openai',
      apiKey: 'sk-test-key',
      temperature: 0.7,
    },
    retriever: {
      type: 'bing',
      apiKey: 'test-bing-key',
      maxResults: 10,
    },
    pipeline: {
      doResearch: true,
      doGenerateOutline: true,
      doGenerateArticle: true,
      doPolishArticle: true,
    },
  },
  outputDir: '/output/project-1',
};

export const Default: Story = {
  args: {
    project: baseProject,
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const Completed: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'completed',
      title: 'Quantum Computing Fundamentals',
      topic: 'Quantum Physics and Computing',
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const InProgress: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'researching',
      title: 'Climate Change Impact Assessment',
      topic: 'Environmental Science',
      progress: {
        stage: 'research',
        stageProgress: 65,
        overallProgress: 25,
        startTime: new Date('2024-01-16T09:00:00Z'),
        currentTask: 'Gathering research from environmental databases...',
        errors: [],
      },
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const Failed: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'failed',
      title: 'Blockchain Technology Analysis',
      topic: 'Cryptocurrency and Distributed Systems',
      progress: {
        stage: 'research',
        stageProgress: 15,
        overallProgress: 8,
        startTime: new Date('2024-01-16T11:00:00Z'),
        currentTask: 'Failed to retrieve sources',
        errors: [
          {
            stage: 'research',
            message: 'API rate limit exceeded',
            timestamp: new Date('2024-01-16T11:05:00Z'),
            severity: 'error',
          },
        ],
      },
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const LongTitle: Story = {
  args: {
    project: {
      ...baseProject,
      title:
        'A Very Long Project Title That Might Wrap to Multiple Lines in the Card Layout',
      topic:
        'User Interface Design and Typography Considerations for Long Content',
      description:
        'This project has an exceptionally long title and topic to test how the component handles text overflow and wrapping in various layouts and screen sizes.',
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const NoDescription: Story = {
  args: {
    project: {
      ...baseProject,
      description: undefined,
      title: 'Minimalist Project',
      topic: 'Simple Design Patterns',
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const RecentlyCreated: Story = {
  args: {
    project: {
      ...baseProject,
      title: 'Fresh New Project',
      topic: 'Latest Research Topics',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const GeneratingOutline: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'generating_outline',
      title: 'Space Exploration Technologies',
      topic: 'Aerospace Engineering and Space Science',
      progress: {
        stage: 'outline_generation',
        stageProgress: 40,
        overallProgress: 55,
        startTime: new Date('2024-01-16T08:30:00Z'),
        currentTask: 'Organizing research into hierarchical structure...',
        errors: [],
      },
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const WritingArticle: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'writing_article',
      title: 'Renewable Energy Solutions',
      topic: 'Sustainable Technology and Green Energy',
      progress: {
        stage: 'article_generation',
        stageProgress: 75,
        overallProgress: 80,
        startTime: new Date('2024-01-16T07:15:00Z'),
        currentTask: 'Writing section: Solar Panel Efficiency...',
        errors: [],
      },
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const Polishing: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'polishing',
      title: 'Medical AI Applications',
      topic: 'Healthcare Technology and Machine Learning',
      progress: {
        stage: 'polishing',
        stageProgress: 90,
        overallProgress: 95,
        startTime: new Date('2024-01-16T06:00:00Z'),
        currentTask: 'Finalizing citations and references...',
        errors: [],
      },
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

export const WithWarnings: Story = {
  args: {
    project: {
      ...baseProject,
      status: 'researching',
      title: 'Cybersecurity Trends',
      topic: 'Information Security and Network Protection',
      progress: {
        stage: 'research',
        stageProgress: 50,
        overallProgress: 20,
        startTime: new Date('2024-01-16T12:00:00Z'),
        currentTask: 'Processing security research papers...',
        errors: [
          {
            stage: 'research',
            message: 'Some sources may be outdated',
            timestamp: new Date('2024-01-16T12:10:00Z'),
            severity: 'warning',
          },
        ],
      },
    },
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
};

// Interaction testing
export const InteractiveCard: Story = {
  args: {
    project: baseProject,
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Test keyboard navigation
    const card = canvas.getByRole('article');
    await userEvent.tab();
    await expect(card).toHaveFocus();
  },
};

// Visual regression tests for different states
export const AllStatusStates: Story = {
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      {[
        { ...baseProject, status: 'draft' as const, title: 'Draft Project' },
        {
          ...baseProject,
          status: 'researching' as const,
          title: 'Researching Project',
        },
        {
          ...baseProject,
          status: 'generating_outline' as const,
          title: 'Generating Outline',
        },
        {
          ...baseProject,
          status: 'writing_article' as const,
          title: 'Writing Article',
        },
        {
          ...baseProject,
          status: 'polishing' as const,
          title: 'Polishing Project',
        },
        {
          ...baseProject,
          status: 'completed' as const,
          title: 'Completed Project',
        },
        { ...baseProject, status: 'failed' as const, title: 'Failed Project' },
      ].map((project, index) => (
        <ProjectCard
          key={index}
          project={project}
          onSelect={action('onSelect')}
          onDelete={action('onDelete')}
          onDuplicate={action('onDuplicate')}
        />
      ))}
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
};

// Dark theme testing
export const DarkTheme: Story = {
  args: {
    project: baseProject,
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
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

// Mobile responsive testing
export const MobileView: Story = {
  args: {
    project: baseProject,
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

// Accessibility testing
export const AccessibilityTest: Story = {
  args: {
    project: baseProject,
    onSelect: action('onSelect'),
    onDelete: action('onDelete'),
    onDuplicate: action('onDuplicate'),
  },
  parameters: {
    a11y: {
      element: '#storybook-root',
      config: {
        rules: [
          {
            id: 'color-contrast',
            enabled: true,
          },
          {
            id: 'keyboard-navigation',
            enabled: true,
          },
        ],
      },
    },
  },
};
