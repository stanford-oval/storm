import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@/test/utils';
import { ResearchView } from '../ResearchView';
import { ResearchData } from '@/types/storm';
import userEvent from '@testing-library/user-event';
import { runA11yTests } from '@/test/utils';

const mockResearchData: ResearchData = {
  conversations: [
    {
      id: 'conv-1',
      perspective: 'Academic Researcher',
      turns: [
        {
          id: 'turn-1',
          speaker: 'user',
          content: 'What are the key aspects of artificial intelligence?',
          timestamp: new Date('2024-01-01T10:00:00'),
          sources: ['source-1', 'source-2'],
          queries: ['AI fundamentals', 'machine learning basics'],
        },
        {
          id: 'turn-2',
          speaker: 'assistant',
          content:
            'Artificial intelligence encompasses machine learning, natural language processing, computer vision, and robotics.',
          timestamp: new Date('2024-01-01T10:01:00'),
        },
        {
          id: 'turn-3',
          speaker: 'user',
          content: 'Can you elaborate on machine learning techniques?',
          timestamp: new Date('2024-01-01T10:02:00'),
          sources: ['source-3'],
        },
      ],
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:05:00'),
      status: 'completed',
    },
    {
      id: 'conv-2',
      perspective: 'Industry Expert',
      turns: [
        {
          id: 'turn-4',
          speaker: 'user',
          content: 'What are the practical applications of AI in business?',
          timestamp: new Date('2024-01-01T10:10:00'),
          sources: ['source-4'],
        },
        {
          id: 'turn-5',
          speaker: 'assistant',
          content:
            'AI is widely used in automation, customer service, predictive analytics, and decision support systems.',
          timestamp: new Date('2024-01-01T10:11:00'),
        },
      ],
      startTime: new Date('2024-01-01T10:10:00'),
      endTime: new Date('2024-01-01T10:15:00'),
      status: 'completed',
    },
    {
      id: 'conv-3',
      perspective: 'Technology Critic',
      turns: [
        {
          id: 'turn-6',
          speaker: 'user',
          content: 'What are the potential risks and limitations of AI?',
          timestamp: new Date('2024-01-01T10:20:00'),
        },
      ],
      startTime: new Date('2024-01-01T10:20:00'),
      status: 'active',
    },
  ],
  sources: [
    {
      id: 'source-1',
      title: 'Introduction to Machine Learning',
      url: 'https://example.com/ml-intro',
      snippet:
        'Machine learning is a subset of artificial intelligence that enables computers to learn and make decisions from data.',
      retrievedAt: new Date('2024-01-01T09:30:00'),
      relevanceScore: 0.95,
      usedInSections: ['section-1'],
    },
    {
      id: 'source-2',
      title: 'AI Ethics and Society',
      url: 'https://example.com/ai-ethics',
      snippet:
        'The ethical implications of AI development include privacy, bias, and job displacement concerns.',
      retrievedAt: new Date('2024-01-01T09:32:00'),
      relevanceScore: 0.87,
    },
    {
      id: 'source-3',
      title: 'Deep Learning Techniques',
      url: 'https://example.com/deep-learning',
      snippet:
        'Neural networks and deep learning have revolutionized pattern recognition and data analysis.',
      retrievedAt: new Date('2024-01-01T09:35:00'),
      relevanceScore: 0.92,
      usedInSections: ['section-2'],
    },
    {
      id: 'source-4',
      title: 'AI in Business Applications',
      url: 'https://example.com/ai-business',
      snippet:
        'Companies are leveraging AI for automation, customer insights, and operational efficiency.',
      retrievedAt: new Date('2024-01-01T09:40:00'),
      relevanceScore: 0.89,
    },
  ],
  perspectives: ['Academic Researcher', 'Industry Expert', 'Technology Critic'],
  totalQueries: 15,
  lastUpdated: new Date('2024-01-01T10:25:00'),
};

describe('ResearchView', () => {
  const mockOnSourceSelect = jest.fn();
  const mockOnConversationSelect = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders research view with all components', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(screen.getByTestId('research-view')).toBeInTheDocument();
      expect(screen.getByText('Research Overview')).toBeInTheDocument();
      expect(screen.getByText('Conversations')).toBeInTheDocument();
      expect(screen.getByText('Sources')).toBeInTheDocument();
    });

    it('displays research statistics', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(screen.getByText('3 Conversations')).toBeInTheDocument();
      expect(screen.getByText('4 Sources')).toBeInTheDocument();
      expect(screen.getByText('3 Perspectives')).toBeInTheDocument();
      expect(screen.getByText('15 Total Queries')).toBeInTheDocument();
    });

    it('shows filters when showFilters is true', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={true}
        />
      );

      expect(
        screen.getByLabelText(/filter by perspective/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/filter by status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/search sources/i)).toBeInTheDocument();
    });

    it('hides filters when showFilters is false', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={false}
        />
      );

      expect(
        screen.queryByLabelText(/filter by perspective/i)
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText(/filter by status/i)
      ).not.toBeInTheDocument();
    });

  describe('Conversations Section', () => {
    it('renders all conversations', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(screen.getByText('Academic Researcher')).toBeInTheDocument();
      expect(screen.getByText('Industry Expert')).toBeInTheDocument();
      expect(screen.getByText('Technology Critic')).toBeInTheDocument();
    });

    it('shows conversation status badges', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const completedBadges = screen.getAllByText('Completed');
      expect(completedBadges).toHaveLength(2);

      const activeBadge = screen.getByText('Active');
      expect(activeBadge).toBeInTheDocument();
    });

    it('displays conversation metadata', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      // Check for turn counts
      expect(screen.getByText('3 turns')).toBeInTheDocument();
      expect(screen.getByText('2 turns')).toBeInTheDocument();
      expect(screen.getByText('1 turn')).toBeInTheDocument();

      // Check for timestamps
      expect(screen.getByText(/10:00 AM/)).toBeInTheDocument();
    });

    it('expands conversation details', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const academicResearcherConv = screen
        .getByText('Academic Researcher')
        .closest('[data-testid="conversation-card"]');
      const expandButton = within(academicResearcherConv!).getByRole('button', {
        name: /expand/i,
      });

      await user.click(expandButton);

      expect(
        screen.getByText('What are the key aspects of artificial intelligence?')
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Artificial intelligence encompasses machine learning/)
      ).toBeInTheDocument();
    });

    it('calls onConversationSelect when conversation is clicked', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const conversationCard = screen
        .getByText('Academic Researcher')
        .closest('[data-testid="conversation-card"]');
      await user.click(conversationCard!);

      expect(mockOnConversationSelect).toHaveBeenCalledWith(
        mockResearchData.conversations[0]
      );
    });

  describe('Sources Section', () => {
    it('renders all sources', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(
        screen.getByText('Introduction to Machine Learning')
      ).toBeInTheDocument();
      expect(screen.getByText('AI Ethics and Society')).toBeInTheDocument();
      expect(screen.getByText('Deep Learning Techniques')).toBeInTheDocument();
      expect(
        screen.getByText('AI in Business Applications')
      ).toBeInTheDocument();
    });

    it('displays source metadata', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(screen.getByText('95%')).toBeInTheDocument(); // relevance score
      expect(screen.getByText('87%')).toBeInTheDocument();
      expect(screen.getByText('92%')).toBeInTheDocument();
      expect(screen.getByText('89%')).toBeInTheDocument();
    });

    it('shows source snippets', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(
        screen.getByText(
          /Machine learning is a subset of artificial intelligence/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(/The ethical implications of AI development/)
      ).toBeInTheDocument();
    });

    it('calls onSourceSelect when source is clicked', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const sourceCard = screen
        .getByText('Introduction to Machine Learning')
        .closest('[data-testid="source-card"]');
      await user.click(sourceCard!);

      expect(mockOnSourceSelect).toHaveBeenCalledWith(
        mockResearchData.sources[0]
      );
    });

    it('opens source URLs in new tab', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const sourceLink = screen
        .getByText('Introduction to Machine Learning')
        .closest('a');
      expect(sourceLink).toHaveAttribute(
        'href',
        'https://example.com/ml-intro'
      );
      expect(sourceLink).toHaveAttribute('target', '_blank');
      expect(sourceLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

  describe('Filtering and Search', () => {
    beforeEach(() => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={true}
        />
      );
    });

    it('filters conversations by perspective', async () => {
      const perspectiveFilter = screen.getByLabelText(/filter by perspective/i);
      await user.selectOptions(perspectiveFilter, 'Academic Researcher');

      // Should show only Academic Researcher conversation
      expect(screen.getByText('Academic Researcher')).toBeInTheDocument();
      expect(screen.queryByText('Industry Expert')).not.toBeInTheDocument();
      expect(screen.queryByText('Technology Critic')).not.toBeInTheDocument();
    });

    it('filters conversations by status', async () => {
      const statusFilter = screen.getByLabelText(/filter by status/i);
      await user.selectOptions(statusFilter, 'completed');

      // Should show only completed conversations
      expect(screen.getByText('Academic Researcher')).toBeInTheDocument();
      expect(screen.getByText('Industry Expert')).toBeInTheDocument();
      expect(screen.queryByText('Technology Critic')).not.toBeInTheDocument();
    });

    it('searches sources by title and content', async () => {
      const searchInput = screen.getByLabelText(/search sources/i);
      await user.type(searchInput, 'machine learning');

      // Should show only sources containing "machine learning"
      expect(
        screen.getByText('Introduction to Machine Learning')
      ).toBeInTheDocument();
      expect(
        screen.queryByText('AI Ethics and Society')
      ).not.toBeInTheDocument();
    });

    it('combines multiple filters', async () => {
      const perspectiveFilter = screen.getByLabelText(/filter by perspective/i);
      const statusFilter = screen.getByLabelText(/filter by status/i);

      await user.selectOptions(perspectiveFilter, 'Academic Researcher');
      await user.selectOptions(statusFilter, 'completed');

      // Should show only Academic Researcher completed conversation
      expect(screen.getByText('Academic Researcher')).toBeInTheDocument();
      expect(screen.queryByText('Industry Expert')).not.toBeInTheDocument();
      expect(screen.queryByText('Technology Critic')).not.toBeInTheDocument();
    });

    it('clears filters', async () => {
      const perspectiveFilter = screen.getByLabelText(/filter by perspective/i);
      await user.selectOptions(perspectiveFilter, 'Academic Researcher');

      const clearFiltersButton = screen.getByRole('button', {
        name: /clear filters/i,
      });
      await user.click(clearFiltersButton);

      // Should show all conversations again
      expect(screen.getByText('Academic Researcher')).toBeInTheDocument();
      expect(screen.getByText('Industry Expert')).toBeInTheDocument();
      expect(screen.getByText('Technology Critic')).toBeInTheDocument();
    });

  describe('Sorting', () => {
    it('sorts sources by relevance score', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={true}
        />
      );

      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'relevance');

      const sourceTitles = screen.getAllByTestId('source-title');
      expect(sourceTitles[0]).toHaveTextContent(
        'Introduction to Machine Learning'
      ); // 95%
      expect(sourceTitles[1]).toHaveTextContent('Deep Learning Techniques'); // 92%
      expect(sourceTitles[2]).toHaveTextContent('AI in Business Applications'); // 89%
      expect(sourceTitles[3]).toHaveTextContent('AI Ethics and Society'); // 87%
    });

    it('sorts sources by date', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={true}
        />
      );

      const sortSelect = screen.getByLabelText(/sort by/i);
      await user.selectOptions(sortSelect, 'date');

      const sourceTitles = screen.getAllByTestId('source-title');
      expect(sourceTitles[0]).toHaveTextContent('AI in Business Applications'); // Latest
    });

    it('sorts conversations by time', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={true}
        />
      );

      const sortSelect = screen.getByLabelText(/sort conversations/i);
      await user.selectOptions(sortSelect, 'time');

      const conversationTitles = screen.getAllByTestId(
        'conversation-perspective'
      );
      expect(conversationTitles[0]).toHaveTextContent('Technology Critic'); // Latest
      expect(conversationTitles[1]).toHaveTextContent('Industry Expert');
      expect(conversationTitles[2]).toHaveTextContent('Academic Researcher'); // Earliest
    });

  describe('Export Functionality', () => {
    it('exports research data to JSON', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:url');
      global.URL.revokeObjectURL = jest.fn();

      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const exportButton = screen.getByRole('button', {
        name: /export research/i,
      });
      await user.click(exportButton);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('exports sources as CSV', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const exportDropdown = screen.getByRole('button', {
        name: /export options/i,
      });
      await user.click(exportDropdown);

      const exportCsvButton = screen.getByRole('button', {
        name: /export sources as csv/i,
      });
      await user.click(exportCsvButton);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

  describe('View Modes', () => {
    it('switches to grid view', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const gridViewButton = screen.getByRole('button', { name: /grid view/i });
      await user.click(gridViewButton);

      expect(screen.getByTestId('research-grid')).toBeInTheDocument();
    });

    it('switches to timeline view', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const timelineViewButton = screen.getByRole('button', {
        name: /timeline view/i,
      });
      await user.click(timelineViewButton);

      expect(screen.getByTestId('research-timeline')).toBeInTheDocument();
    });

  describe('Performance', () => {
    it('virtualizes large lists of sources', () => {
      const largeResearchData = {
        ...mockResearchData,
        sources: Array.from({ length: 1000 }, (_, i) => ({
          id: `source-${i}`,
          title: `Source ${i}`,
          url: `https://example.com/source-${i}`,
          snippet: `This is snippet ${i}`,
          retrievedAt: new Date(),
          relevanceScore: Math.random(),
        })),
      };

      const startTime = performance.now();
      render(
        <ResearchView
          research={largeResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000);

      // Should not render all 1000 sources in DOM at once
      const sourceCards = screen.getAllByTestId('source-card');
      expect(sourceCards.length).toBeLessThan(50);
    });

  describe('Error Handling', () => {
    it('handles empty research data gracefully', () => {
      const emptyResearch = {
        conversations: [],
        sources: [],
        perspectives: [],
        totalQueries: 0,
        lastUpdated: new Date(),
      };

      render(
        <ResearchView
          research={emptyResearch}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(screen.getByText(/no conversations found/i)).toBeInTheDocument();
      expect(screen.getByText(/no sources found/i)).toBeInTheDocument();
    });

    it('handles malformed conversation data', () => {
      const malformedResearch = {
        ...mockResearchData,
        conversations: [
          {
            id: 'conv-broken',
            perspective: null,
            turns: null,
            startTime: new Date(),
            status: 'failed',
          },
        ],
      };

      render(
        <ResearchView
          research={malformedResearch as any}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(
        screen.getByText(/error loading conversation/i)
      ).toBeInTheDocument();
    });

  describe('Accessibility', () => {
    it('meets accessibility standards', async () => {
      const component = (
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      await runA11yTests(component);
    });

    it('has proper ARIA attributes', () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      expect(
        screen.getByRole('region', { name: /conversations/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /sources/i })
      ).toBeInTheDocument();
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('provides screen reader announcements', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
          showFilters={true}
        />
      );

      const searchInput = screen.getByLabelText(/search sources/i);
      await user.type(searchInput, 'machine learning');

      expect(screen.getByText(/1 source found/i)).toBeInTheDocument();
    });

  describe('Keyboard Navigation', () => {
    it('supports keyboard navigation through conversations', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const firstConversation = screen
        .getByText('Academic Researcher')
        .closest('[data-testid="conversation-card"]');
      firstConversation?.focus();

      await user.keyboard('{ArrowDown}');
      const secondConversation = screen
        .getByText('Industry Expert')
        .closest('[data-testid="conversation-card"]');
      expect(secondConversation).toHaveFocus();
    });

    it('activates conversation with Enter key', async () => {
      render(
        <ResearchView
          research={mockResearchData}
          onSourceSelect={mockOnSourceSelect}
          onConversationSelect={mockOnConversationSelect}
        />
      );

      const firstConversation = screen
        .getByText('Academic Researcher')
        .closest('[data-testid="conversation-card"]');
      firstConversation?.focus();

      await user.keyboard('{Enter}');
      expect(mockOnConversationSelect).toHaveBeenCalledWith(
        mockResearchData.conversations[0]
      );
    });

}}}}}}}}}}}}
))))))))))))