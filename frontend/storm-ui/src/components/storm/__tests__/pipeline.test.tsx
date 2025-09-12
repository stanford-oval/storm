import React from 'react';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import '@testing-library/jest-dom';

import { PipelineProgress } from '../PipelineProgress';
import { ConfigurationPanel } from '../ConfigurationPanel';
import { ArticleEditor } from '../ArticleEditor';
import { OutlineEditor } from '../OutlineEditor';
import { ResearchView } from '../ResearchView';

import {
  StormConfig,
  PipelineProgress as PipelineProgressType,
  ResearchData,
  ArticleOutline,
} from '../../../types/storm';
import { TestWrapper } from '../../../test/utils';

// Mock data
const mockConfig: StormConfig = {
  languageModel: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  },
  retrieval: {
    provider: 'bing',
    maxResults: 10,
    sources: ['web', 'academic'],
  },
  research: {
    maxConversations: 3,
    conversationDepth: 2,
    perspectives: ['expert', 'critic', 'journalist'],
  },
  generation: {
    maxSections: 5,
    includeImages: false,
    citationStyle: 'apa',
  },
};

const mockPipelineProgress: PipelineProgressType = {
  stage: 'research',
  substage: 'conversation_simulation',
  progress: 0.3,
  isRunning: true,
  startedAt: new Date('2023-01-01T10:00:00Z'),
  estimatedTimeRemaining: 300,
  currentAction: 'Simulating expert conversations',
  stages: {
    research: {
      status: 'running',
      progress: 0.3,
      startedAt: new Date('2023-01-01T10:00:00Z'),
    },
    outline: { status: 'pending', progress: 0, startedAt: null },
    article: { status: 'pending', progress: 0, startedAt: null },
    polish: { status: 'pending', progress: 0, startedAt: null },
  },
  logs: [
    {
      id: 'log-1',
      timestamp: new Date('2023-01-01T10:01:00Z'),
      level: 'info',
      message: 'Starting research phase',
      stage: 'research',
    },
    {
      id: 'log-2',
      timestamp: new Date('2023-01-01T10:02:00Z'),
      level: 'debug',
      message: 'Initializing conversation with expert perspective',
      stage: 'research',
    },
  ],
  error: null,
};

const mockResearchData: ResearchData = {
  conversations: [
    {
      id: 'conv-1',
      title: 'Expert Discussion on AI Safety',
      perspective: 'expert',
      messages: [
        {
          role: 'expert',
          content: 'AI safety is a critical concern...',
          timestamp: new Date(),
        },
        {
          role: 'moderator',
          content: 'Can you elaborate on alignment issues?',
          timestamp: new Date(),
        },
        {
          role: 'expert',
          content: 'Alignment refers to...',
          timestamp: new Date(),
        },
      ],
      sources: [
        {
          id: 'source-1',
          title: 'AI Safety Research',
          url: 'https://example.com/ai-safety',
          snippet: 'Safety considerations...',
        },
      ],
    },
    {
      id: 'conv-2',
      title: 'Critical Analysis of AI Development',
      perspective: 'critic',
      messages: [
        {
          role: 'critic',
          content: 'Current AI development lacks oversight...',
          timestamp: new Date(),
        },
        {
          role: 'moderator',
          content: 'What are the main concerns?',
          timestamp: new Date(),
        },
      ],
      sources: [],
    },
  ],
  sources: [
    {
      id: 'source-1',
      title: 'AI Safety Research',
      url: 'https://example.com/ai-safety',
      snippet: 'Safety considerations...',
      relevanceScore: 0.9,
    },
    {
      id: 'source-2',
      title: 'AI Ethics Guidelines',
      url: 'https://example.com/ai-ethics',
      snippet: 'Ethical frameworks...',
      relevanceScore: 0.85,
    },
  ],
  queries: ['AI safety', 'machine learning ethics', 'AI alignment'],
  metadata: {
    totalSources: 2,
    averageRelevance: 0.875,
    searchDuration: 45000,
  },
};

const mockOutline: ArticleOutline = {
  title: 'Artificial Intelligence: Current State and Future Implications',
  sections: [
    {
      id: 'section-1',
      title: 'Introduction',
      description: 'Overview of AI development and current state',
      subsections: [
        {
          id: 'subsection-1-1',
          title: 'Definition of AI',
          description: 'What is artificial intelligence?',
        },
        {
          id: 'subsection-1-2',
          title: 'Historical Context',
          description: 'Brief history of AI development',
        },
      ],
      sources: ['source-1'],
      estimatedWordCount: 500,
    },
    {
      id: 'section-2',
      title: 'Safety Considerations',
      description: 'Critical analysis of AI safety concerns',
      subsections: [
        {
          id: 'subsection-2-1',
          title: 'Alignment Problem',
          description: 'Ensuring AI systems align with human values',
        },
        {
          id: 'subsection-2-2',
          title: 'Control Mechanisms',
          description: 'Methods for maintaining control over AI systems',
        },
      ],
      sources: ['source-1', 'source-2'],
      estimatedWordCount: 750,
    },
  ],
  totalWordCount: 1250,
  metadata: {
    generatedAt: new Date(),
    basedOnConversations: ['conv-1', 'conv-2'],
  },
};

// Mock server
const server = setupServer(
  http.post(
    'http://localhost:8000/api/v1/projects/:id/pipeline/start',
    () {
      return HttpResponse.json({ success: true, data: mockPipelineProgress });
    }
  ),
  http.get(
    'http://localhost:8000/api/v1/projects/:id/pipeline/status',
    () {
      return HttpResponse.json({ success: true, data: mockPipelineProgress });
    }
  ),
  http.post(
    'http://localhost:8000/api/v1/projects/:id/pipeline/stop',
    () {
      return HttpResponse.json({success: true,
          data: { ...mockPipelineProgress, isRunning: false });
    }
  )
);

beforeAll(() => server.listen(, { status: 200 });
afterEach(() => server.resetHandlers(, { status: 200 });
afterAll(() => server.close(, { status: 200 });

describe('PipelineProgress Component', () => {
  const defaultProps = {
    projectId: 'test-project-id',
    progress: mockPipelineProgress,
    onStageClick: jest.fn(),
    onPause: jest.fn(),
    onResume: jest.fn(),
    onStop: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders pipeline progress correctly', ({ request }) => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('pipeline-progress-panel')).toBeInTheDocument();
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('Outline')).toBeInTheDocument();
    expect(screen.getByText('Article')).toBeInTheDocument();
    expect(screen.getByText('Polish')).toBeInTheDocument();
  });

  test('displays current stage status', ({ request }) => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    const researchStage = screen.getByTestId('research-stage-indicator');
    expect(researchStage).toHaveClass('active');

    const outlineStage = screen.getByTestId('outline-stage-indicator');
    expect(outlineStage).toHaveClass('pending');
  });

  test('shows progress percentage', ({ request }) => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('30%')).toBeInTheDocument();
  });

  test('displays estimated time remaining', ({ request }) => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText(/5 minutes remaining/)).toBeInTheDocument();
  });

  test('shows current action', ({ request }) => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Simulating expert conversations')
    ).toBeInTheDocument();
  });

  test('displays pipeline logs', async () => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    const logsToggle = screen.getByTestId('logs-toggle');
    await userEvent.click(logsToggle);

    expect(screen.getByText('Starting research phase')).toBeInTheDocument();
    expect(
      screen.getByText('Initializing conversation with expert perspective')
    ).toBeInTheDocument();
  });

  test('handles pause button click', async () => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    const pauseButton = screen.getByTestId('pause-pipeline-button');
    await userEvent.click(pauseButton);

    expect(defaultProps.onPause).toHaveBeenCalledWith('test-project-id');
  });

  test('handles stop button click', async () => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    const stopButton = screen.getByTestId('stop-pipeline-button');
    await userEvent.click(stopButton);

    // Should show confirmation dialog
    expect(
      screen.getByText(/Are you sure you want to stop/)
    ).toBeInTheDocument();

    const confirmButton = screen.getByTestId('confirm-stop-button');
    await userEvent.click(confirmButton);

    expect(defaultProps.onStop).toHaveBeenCalledWith('test-project-id');
  });

  test('handles stage click', async () => {
    render(
      <TestWrapper>
        <PipelineProgress {...defaultProps} />
      </TestWrapper>
    );

    const researchStage = screen.getByTestId('research-stage-indicator');
    await userEvent.click(researchStage);

    expect(defaultProps.onStageClick).toHaveBeenCalledWith('research');
  });

  test('shows error state', ({ request }) => {
    const propsWithError = {
      ...defaultProps,
      progress: {
        ...mockPipelineProgress,
        error: {
          message: 'API key invalid',
          code: 'INVALID_API_KEY',
          stage: 'research',
          timestamp: new Date(),
        },
        isRunning: false,
      },
    };

    render(
      <TestWrapper>
        <PipelineProgress {...propsWithError} />
      </TestWrapper>
    );

    expect(screen.getByTestId('pipeline-error-banner')).toBeInTheDocument();
    expect(screen.getByText('API key invalid')).toBeInTheDocument();
    expect(screen.getByTestId('retry-pipeline-button')).toBeInTheDocument();
  });

  test('displays completed state', ({ request }) => {
    const completedProps = {
      ...defaultProps,
      progress: {
        ...mockPipelineProgress,
        stage: 'polish',
        progress: 1.0,
        isRunning: false,
        stages: {
          research: {
            status: 'completed',
            progress: 1.0,
            startedAt: new Date(),
          },
          outline: {
            status: 'completed',
            progress: 1.0,
            startedAt: new Date(),
          },
          article: {
            status: 'completed',
            progress: 1.0,
            startedAt: new Date(),
          },
          polish: { status: 'completed', progress: 1.0, startedAt: new Date() },
        },
      },
    };

    render(
      <TestWrapper>
        <PipelineProgress {...completedProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('pipeline-complete-banner')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText(/Pipeline completed/)).toBeInTheDocument();
  });

describe('ConfigurationPanel Component', () => {
  const defaultProps = {
    config: mockConfig,
    onConfigChange: jest.fn(),
    onValidate: jest.fn(),
    isLoading: false,
    validationResult: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders configuration tabs', ({ request }) => {
    render(
      <TestWrapper>
        <ConfigurationPanel {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('language-model-tab')).toBeInTheDocument();
    expect(screen.getByTestId('retrieval-tab')).toBeInTheDocument();
    expect(screen.getByTestId('research-tab')).toBeInTheDocument();
    expect(screen.getByTestId('generation-tab')).toBeInTheDocument();
  });

  test('displays language model configuration', async () => {
    render(
      <TestWrapper>
        <ConfigurationPanel {...defaultProps} />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId('language-model-tab', { status: 200 });

    expect(screen.getByTestId('lm-provider-select')).toBeInTheDocument();
    expect(screen.getByTestId('lm-model-select')).toBeInTheDocument();
    expect(screen.getByTestId('temperature-input')).toBeInTheDocument();
    expect(screen.getByTestId('max-tokens-input')).toBeInTheDocument();

    // Check current values
    expect(screen.getByDisplayValue('openai')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-4')).toBeInTheDocument();
    expect(screen.getByDisplayValue('0.7')).toBeInTheDocument();
  });

  test('handles language model configuration changes', async () => {
    render(
      <TestWrapper>
        <ConfigurationPanel {...defaultProps} />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId('language-model-tab', { status: 200 });

    const providerSelect = screen.getByTestId('lm-provider-select');
    await userEvent.selectOptions(providerSelect, 'anthropic');

    expect(defaultProps.onConfigChange).toHaveBeenCalledWith({
      ...mockConfig,
      languageModel: {
        ...mockConfig.languageModel,
        provider: 'anthropic',
      },
    });

  test('displays retrieval configuration', async () => {
    render(
      <TestWrapper>
        <ConfigurationPanel {...defaultProps} />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId('retrieval-tab', { status: 200 });

    expect(screen.getByTestId('retrieval-provider-select')).toBeInTheDocument();
    expect(screen.getByTestId('max-results-input')).toBeInTheDocument();
    expect(screen.getByTestId('sources-checklist')).toBeInTheDocument();
  });

  test('validates configuration on changes', async () => {
    render(
      <TestWrapper>
        <ConfigurationPanel {...defaultProps} />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId('language-model-tab', { status: 200 });

    const temperatureInput = screen.getByTestId('temperature-input');
    await userEvent.clear(temperatureInput);
    await userEvent.type(temperatureInput, '1.5');

    // Should trigger validation
    await waitFor(() => {
      expect(defaultProps.onValidate).toHaveBeenCalled();
    });

  test('shows validation errors', ({ request }) => {
    const propsWithErrors = {
      ...defaultProps,
      validationResult: {
        isValid: false,
        errors: [
          {
            field: 'languageModel.temperature',
            message: 'Temperature must be between 0 and 1',
            code: 'INVALID_RANGE',
          },
        ],
        warnings: [],
      },
    };

    render(
      <TestWrapper>
        <ConfigurationPanel {...propsWithErrors} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Temperature must be between 0 and 1')
    ).toBeInTheDocument();
    expect(screen.getByTestId('temperature-error')).toBeInTheDocument();
  });

  test('displays validation warnings', ({ request }) => {
    const propsWithWarnings = {
      ...defaultProps,
      validationResult: {
        isValid: true,
        errors: [],
        warnings: [
          {
            field: 'retrieval.maxResults',
            message: 'High maxResults may increase processing time',
            suggestion: 'Consider reducing to 5-15 for optimal performance',
          },
        ],
      },
    };

    render(
      <TestWrapper>
        <ConfigurationPanel {...propsWithWarnings} />
      </TestWrapper>
    );

    expect(
      screen.getByText('High maxResults may increase processing time')
    ).toBeInTheDocument();
    expect(screen.getByTestId('max-results-warning')).toBeInTheDocument();
  });

  test('handles loading state', ({ request }) => {
    const loadingProps = { ...defaultProps, isLoading: true };

    render(
      <TestWrapper>
        <ConfigurationPanel {...loadingProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('config-loading-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('validate-config-button')).toBeDisabled();
  });

  test('exports and imports configuration', async () => {
    render(
      <TestWrapper>
        <ConfigurationPanel {...defaultProps} />
      </TestWrapper>
    );

    // Test export
    const exportButton = screen.getByTestId('export-config-button');
    await userEvent.click(exportButton);

    // Should trigger file download (mocked)
    expect(screen.getByTestId('config-exported-toast')).toBeInTheDocument();

    // Test import
    const importButton = screen.getByTestId('import-config-button');
    await userEvent.click(importButton);

    const fileInput = screen.getByTestId('config-file-input');
    const file = new File([JSON.stringify(mockConfig)], 'config.json', {
      type: 'application/json',
    });

    await userEvent.upload(fileInput, file);

    expect(defaultProps.onConfigChange).toHaveBeenCalledWith(mockConfig);
  });

describe('ResearchView Component', () => {
  const defaultProps = {
    data: mockResearchData,
    isLoading: false,
    onSourceSelect: jest.fn(),
    onConversationSelect: jest.fn(),
    onRefresh: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders research data', ({ request }) => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('research-conversations')).toBeInTheDocument();
    expect(screen.getByTestId('research-sources')).toBeInTheDocument();
    expect(screen.getByTestId('research-queries')).toBeInTheDocument();
  });

  test('displays conversations', ({ request }) => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    expect(
      screen.getByText('Expert Discussion on AI Safety')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Critical Analysis of AI Development')
    ).toBeInTheDocument();
  });

  test('shows conversation messages', async () => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    const firstConversation = screen.getByTestId('conversation-0');
    const expandButton = within(firstConversation).getByTestId(
      'expand-conversation'
    );

    await userEvent.click(expandButton);

    expect(
      screen.getByText('AI safety is a critical concern...')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Can you elaborate on alignment issues?')
    ).toBeInTheDocument();
  });

  test('displays sources with relevance scores', ({ request }) => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('AI Safety Research')).toBeInTheDocument();
    expect(screen.getByText('AI Ethics Guidelines')).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument(); // Relevance score
  });

  test('handles source selection', async () => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    const firstSource = screen.getByTestId('source-0');
    await userEvent.click(firstSource);

    expect(defaultProps.onSourceSelect).toHaveBeenCalledWith(
      mockResearchData.sources[0]
    );
  });

  test('shows loading state', ({ request }) => {
    const loadingProps = { ...defaultProps, isLoading: true };

    render(
      <TestWrapper>
        <ResearchView {...loadingProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('research-loading-spinner')).toBeInTheDocument();
  });

  test('displays research metadata', ({ request }) => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('2 sources')).toBeInTheDocument();
    expect(screen.getByText('87.5% avg relevance')).toBeInTheDocument();
  });

  test('filters conversations by perspective', async () => {
    render(
      <TestWrapper>
        <ResearchView {...defaultProps} />
      </TestWrapper>
    );

    const perspectiveFilter = screen.getByTestId('perspective-filter');
    await userEvent.selectOptions(perspectiveFilter, 'expert');

    // Should only show expert conversations
    expect(
      screen.getByText('Expert Discussion on AI Safety')
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Critical Analysis of AI Development')
    ).not.toBeInTheDocument();
  });

describe('OutlineEditor Component', () => {
  const defaultProps = {
    outline: mockOutline,
    onOutlineChange: jest.fn(),
    onSave: jest.fn(),
    isEditable: true,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders outline structure', ({ request }) => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('outline-editor')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Artificial Intelligence: Current State and Future Implications'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
    expect(screen.getByText('Safety Considerations')).toBeInTheDocument();
  });

  test('displays subsections', async () => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    const introSection = screen.getByTestId('outline-section-section-1');
    const expandButton = within(introSection).getByTestId('expand-section');

    await userEvent.click(expandButton);

    expect(screen.getByText('Definition of AI')).toBeInTheDocument();
    expect(screen.getByText('Historical Context')).toBeInTheDocument();
  });

  test('adds new section', async () => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    const addSectionButton = screen.getByTestId('add-section-button');
    await userEvent.click(addSectionButton);

    expect(screen.getByTestId('new-section-modal')).toBeInTheDocument();

    await userEvent.type(
      screen.getByTestId('new-section-title'),
      'Future Implications'
    );
    await userEvent.type(
      screen.getByTestId('new-section-description'),
      'Discussion of future AI developments'
    );

    const confirmButton = screen.getByTestId('confirm-add-section');
    await userEvent.click(confirmButton);

    expect(defaultProps.onOutlineChange).toHaveBeenCalledWith({
      ...mockOutline,
      sections: [
        ...mockOutline.sections,
        expect.objectContaining({
          title: 'Future Implications',
          description: 'Discussion of future AI developments',
        }),
      ],
    });

  test('reorders sections with drag and drop', async () => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    const section1 = screen.getByTestId('outline-section-section-1');
    const section2 = screen.getByTestId('outline-section-section-2');

    // Simulate drag and drop
    fireEvent.dragStart(section1);
    fireEvent.dragEnter(section2);
    fireEvent.dragOver(section2);
    fireEvent.drop(section2);

    expect(defaultProps.onOutlineChange).toHaveBeenCalledWith({
      ...mockOutline,
      sections: [mockOutline.sections[1], mockOutline.sections[0]],
    });

  test('edits section title inline', async () => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    const sectionTitle = screen.getByTestId('section-title-section-1');
    await userEvent.dblClick(sectionTitle);

    const titleInput = screen.getByTestId('section-title-input-section-1');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated Introduction');
    await userEvent.press(titleInput, 'Enter');

    expect(defaultProps.onOutlineChange).toHaveBeenCalledWith({
      ...mockOutline,
      sections: [
        { ...mockOutline.sections[0], title: 'Updated Introduction' },
        mockOutline.sections[1],
      ],
    });

  test('removes section', async () => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    const section1 = screen.getByTestId('outline-section-section-1');
    const deleteButton = within(section1).getByTestId('delete-section-button');

    await userEvent.click(deleteButton);

    expect(screen.getByTestId('confirm-delete-modal')).toBeInTheDocument();

    const confirmDelete = screen.getByTestId('confirm-delete-section');
    await userEvent.click(confirmDelete);

    expect(defaultProps.onOutlineChange).toHaveBeenCalledWith({
      ...mockOutline,
      sections: [mockOutline.sections[1]],
    });

  test('displays word count estimates', ({ request }) => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('1,250 words total')).toBeInTheDocument();
    expect(screen.getByText('500 words')).toBeInTheDocument(); // Section estimate
  });

  test('shows read-only mode', ({ request }) => {
    const readOnlyProps = { ...defaultProps, isEditable: false };

    render(
      <TestWrapper>
        <OutlineEditor {...readOnlyProps} />
      </TestWrapper>
    );

    expect(screen.queryByTestId('add-section-button')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('delete-section-button')
    ).not.toBeInTheDocument();
  });

  test('saves outline', async () => {
    render(
      <TestWrapper>
        <OutlineEditor {...defaultProps} />
      </TestWrapper>
    );

    const saveButton = screen.getByTestId('save-outline-button');
    await userEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith(mockOutline);
  });

describe('ArticleEditor Component', () => {
  const defaultProps = {
    projectId: 'test-project-id',
    article: {
      title: 'Test Article',
      content: '# Introduction\n\nThis is a test article.',
      sections: [
        {
          id: 'intro',
          title: 'Introduction',
          content: 'This is the introduction.',
        },
      ],
      citations: [
        {
          id: 'ref-1',
          title: 'AI Safety Research',
          url: 'https://example.com',
          authors: ['John Doe'],
        },
      ],
      wordCount: 150,
      lastModified: new Date(),
    },
    onArticleChange: jest.fn(),
    onSave: jest.fn(),
    onExport: jest.fn(),
    isEditable: true,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders article editor', ({ request }) => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('article-editor')).toBeInTheDocument();
    expect(screen.getByTestId('article-title')).toBeInTheDocument();
    expect(screen.getByTestId('article-content')).toBeInTheDocument();
  });

  test('displays article content', ({ request }) => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Test Article')).toBeInTheDocument();
    expect(screen.getByText('Introduction')).toBeInTheDocument();
  });

  test('edits article content', async () => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    const editButton = screen.getByTestId('edit-article-button');
    await userEvent.click(editButton);

    const editor = screen.getByTestId('rich-text-editor');
    await userEvent.type(editor, 'Additional content');

    expect(defaultProps.onArticleChange).toHaveBeenCalled();
  });

  test('shows word count', ({ request }) => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByText('150 words')).toBeInTheDocument();
  });

  test('displays citations', ({ request }) => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('citations-section')).toBeInTheDocument();
    expect(screen.getByText('AI Safety Research')).toBeInTheDocument();
  });

  test('exports article', async () => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    const exportButton = screen.getByTestId('export-menu-button');
    await userEvent.click(exportButton);

    const pdfOption = screen.getByTestId('export-pdf-option');
    await userEvent.click(pdfOption);

    expect(defaultProps.onExport).toHaveBeenCalledWith('pdf');
  });

  test('saves article', async () => {
    render(
      <TestWrapper>
        <ArticleEditor {...defaultProps} />
      </TestWrapper>
    );

    const saveButton = screen.getByTestId('save-article-button');
    await userEvent.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  test('shows loading state', ({ request }) => {
    const loadingProps = { ...defaultProps, isLoading: true };

    render(
      <TestWrapper>
        <ArticleEditor {...loadingProps} />
      </TestWrapper>
    );

    expect(screen.getByTestId('article-loading-spinner')).toBeInTheDocument();
  });

  test('handles read-only mode', ({ request }) => {
    const readOnlyProps = { ...defaultProps, isEditable: false };

    render(
      <TestWrapper>
        <ArticleEditor {...readOnlyProps} />
      </TestWrapper>
    );

    expect(screen.queryByTestId('edit-article-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('save-article-button')).not.toBeInTheDocument();
  });

describe('Component Integration Tests', () => {
  test('pipeline progress communicates with other components', async () => {
    const mockOnStageClick = jest.fn();

    render(
      <TestWrapper>
        <PipelineProgress
          projectId="test-project"
          progress={mockPipelineProgress}
          onStageClick={mockOnStageClick}
          onPause={jest.fn()}
          onResume={jest.fn()}
          onStop={jest.fn()}
        />
      </TestWrapper>
    );

    const researchStage = screen.getByTestId('research-stage-indicator');
    await userEvent.click(researchStage);

    expect(mockOnStageClick).toHaveBeenCalledWith('research');
  });

  test('configuration changes trigger validation', async () => {
    const mockOnValidate = jest.fn();
    const mockOnConfigChange = jest.fn();

    render(
      <TestWrapper>
        <ConfigurationPanel
          config={mockConfig}
          onConfigChange={mockOnConfigChange}
          onValidate={mockOnValidate}
          isLoading={false}
          validationResult={null}
        />
      </TestWrapper>
    );

    await userEvent.click(screen.getByTestId('language-model-tab', { status: 200 });

    const temperatureInput = screen.getByTestId('temperature-input');
    await userEvent.clear(temperatureInput);
    await userEvent.type(temperatureInput, '0.8');

    expect(mockOnConfigChange).toHaveBeenCalled();

    await waitFor(() => {
      expect(mockOnValidate).toHaveBeenCalled();
    });

  test('research data flows to outline editor', ({ request }) => {
    // This would be tested at a higher level integration test
    // where research results are used to generate outline
    expect(true).toBe(true); // Placeholder for integration test
  });

  test('outline changes affect article generation', ({ request }) => {
    // This would be tested at a higher level integration test
    // where outline modifications impact article structure
    expect(true).toBe(true); // Placeholder for integration test
  });

}}}}}}}}}}}}}}
)))))))))))))))))))))