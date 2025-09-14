import React from 'react';
import { render, screen, fireEvent, waitFor } from '@/test/utils';
import { ArticleEditor } from '../ArticleEditor';
import { GeneratedArticle } from '@/types/storm';
import userEvent from '@testing-library/user-event';
import { runA11yTests } from '@/test/utils';

// Mock TipTap editor
jest.mock('@tiptap/react', () => ({
  useEditor: jest.fn(() => ({
    getHTML: jest.fn(() => '<p>Mock content</p>'),
    setContent: jest.fn(),
    commands: {
      setContent: jest.fn(),
      focus: jest.fn(),
    },
    isActive: jest.fn(() => false),
    can: jest.fn(() => ({ setContent: jest.fn(() => true) })),
    on: jest.fn(),
    off: jest.fn(),
    destroy: jest.fn(),
  })),
  EditorContent: ({ editor, ...props }: any) => (
    <div data-testid="editor-content" {...props}>
      <div contentEditable suppressContentEditableWarning>
        Mock editor content
      </div>
    </div>
  ),
}));

const mockArticle: GeneratedArticle = {
  title: 'Test Article',
  content: '<h1>Test Article</h1><p>This is test content.</p>',
  sections: [
    {
      id: 'section-1',
      title: 'Introduction',
      content: '<p>Introduction content</p>',
      level: 1,
      order: 1,
      citations: ['citation-1'],
    },
    {
      id: 'section-2',
      title: 'Main Content',
      content: '<p>Main content here</p>',
      level: 1,
      order: 2,
      citations: ['citation-2'],
    },
  ],
  citations: [
    {
      id: 'citation-1',
      sourceId: 'source-1',
      text: 'Test citation 1',
      url: 'https://example.com/source1',
    },
    {
      id: 'citation-2',
      sourceId: 'source-2',
      text: 'Test citation 2',
      url: 'https://example.com/source2',
    },
  ],
  wordCount: 100,
  lastModified: new Date('2024-01-01'),
};

describe('ArticleEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnSave = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders article editor with all components', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId('article-editor')).toBeInTheDocument();
      expect(screen.getByTestId('editor-content')).toBeInTheDocument();
      expect(screen.getByText('Test Article')).toBeInTheDocument();
    });

    it('renders title editor when editable', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
          readOnly={false}
        />
      );

      const titleInput = screen.getByDisplayValue('Test Article');
      expect(titleInput).toBeInTheDocument();
      expect(titleInput).not.toBeDisabled();
    });

    it('renders read-only mode correctly', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
          readOnly={true}
        />
      );

      const titleElement = screen.getByText('Test Article');
      expect(titleElement).toBeInTheDocument();
      expect(
        screen.queryByRole('textbox', { name: /title/i })
      ).not.toBeInTheDocument();
    });

    it('shows outline when showOutline prop is true', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
          showOutline={true}
        />
      );

      expect(screen.getByTestId('article-outline')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
    });

    it('renders citations list', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Citations')).toBeInTheDocument();
      expect(screen.getByText('Test citation 1')).toBeInTheDocument();
      expect(screen.getByText('Test citation 2')).toBeInTheDocument();
    });

  describe('User Interactions', () => {
    it('handles title changes', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const titleInput = screen.getByDisplayValue('Test Article');
      await user.clear(titleInput);
      await user.type(titleInput, 'Updated Article Title');

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith({
          ...mockArticle,
          title: 'Updated Article Title',
        });

    it('handles save button click', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('opens citation links in new tab', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const citationLink = screen.getByText('Test citation 1').closest('a');
      expect(citationLink).toHaveAttribute(
        'href',
        'https://example.com/source1'
      );
      expect(citationLink).toHaveAttribute('target', '_blank');
      expect(citationLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('navigates to section from outline', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
          showOutline={true}
        />
      );

      const introductionLink = screen.getByText('Introduction');
      await user.click(introductionLink);

      // Verify scroll behavior was triggered
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

  describe('Editor Integration', () => {
    it('initializes editor with article content', () => {
      const { useEditor } = require('@tiptap/react');

      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(useEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: mockArticle.content,
          editable: true,
        });

    it('disables editor in read-only mode', () => {
      const { useEditor } = require('@tiptap/react');

      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
          readOnly={true}
        />
      );

      expect(useEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          editable: false,
        });

  describe('Keyboard Shortcuts', () => {
    it('saves article with Ctrl+S', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      await user.keyboard('{Control>}s{/Control}');

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('saves article with Cmd+S on Mac', async () => {
      // Mock Mac platform
      Object.defineProperty(navigator, 'platform', {
        value: 'MacIntel',
        configurable: true,
      });

      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      await user.keyboard('{Meta>}s{/Meta}');

      expect(mockOnSave).toHaveBeenCalled();
    });

  describe('Error Handling', () => {
    it('handles save errors gracefully', async () => {
      const mockOnSaveWithError = jest.fn(() => {
        throw new Error('Save failed');
      });

      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSaveWithError}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSaveWithError).toHaveBeenCalled();
      expect(screen.getByText(/error saving article/i)).toBeInTheDocument();
    });

    it('displays validation errors for empty title', async () => {
      render(
        <ArticleEditor
          article={{ ...mockArticle, title: '' }}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

  describe('Performance', () => {
    it('renders large articles efficiently', () => {
      const largeArticle = {
        ...mockArticle,
        sections: Array.from({ length: 100 }, (_, i) => ({
          id: `section-${i}`,
          title: `Section ${i}`,
          content: `<p>Content for section ${i}</p>`.repeat(10),
          level: 1,
          order: i,
          citations: [`citation-${i}`],
        })),
      };

      const startTime = performance.now();
      render(
        <ArticleEditor
          article={largeArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );
      const endTime = performance.now();

      // Should render within reasonable time (less than 500ms)
      expect(endTime - startTime).toBeLessThan(500);
    });

  describe('Accessibility', () => {
    it('meets accessibility standards', async () => {
      const component = (
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      await runA11yTests(component);
    });

    it('has proper ARIA labels', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByLabelText(/article title/i)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /save article/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole('region', { name: /article content/i })
      ).toBeInTheDocument();
    });

    it('supports keyboard navigation', async () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
          showOutline={true}
        />
      );

      // Tab through elements
      await user.tab();
      expect(screen.getByDisplayValue('Test Article')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Introduction')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Main Content')).toHaveFocus();
    });

  describe('Visual States', () => {
    it('shows loading state during save', async () => {
      const mockOnSaveAsync = jest.fn(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSaveAsync}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
      expect(saveButton).toBeDisabled();

      await waitFor(() => {
        expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
        expect(saveButton).not.toBeDisabled();
      });

    it('shows word count', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/100 words/i)).toBeInTheDocument();
    });

    it('shows last modified date', () => {
      render(
        <ArticleEditor
          article={mockArticle}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText(/last modified/i)).toBeInTheDocument();
      expect(screen.getByText(/jan 1, 2024/i)).toBeInTheDocument();
    });
});
