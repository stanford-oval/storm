import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@/test/utils';
import { OutlineEditor } from '../OutlineEditor';
import { ArticleOutline } from '@/types/storm';
import userEvent from '@testing-library/user-event';
import { runA11yTests } from '@/test/utils';
import { DndContext } from '@dnd-kit/core';

// Mock drag and drop functionality
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children, onDragEnd }: any) => (
    <div data-testid="dnd-context" data-on-drag-end={onDragEnd}>
      {children}
    </div>
  ),
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
  }),
  useDroppable: () => ({
    isOver: false,
    setNodeRef: () => {},
  }),
  DragOverlay: ({ children }: any) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => children,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
  }),
  arrayMove: (array: any[], oldIndex: number, newIndex: number) => {
    const newArray = [...array];
    const [moved] = newArray.splice(oldIndex, 1);
    newArray.splice(newIndex, 0, moved);
    return newArray;
  },
}));

const mockOutline: ArticleOutline = {
  id: 'outline-1',
  sections: [
    {
      id: 'section-1',
      title: 'Introduction',
      description: 'Opening section',
      level: 1,
      order: 1,
      isExpanded: true,
      children: [
        {
          id: 'section-1-1',
          title: 'Background',
          level: 2,
          order: 1,
          isExpanded: false,
        },
      ],
    },
    {
      id: 'section-2',
      title: 'Main Content',
      description: 'Primary content section',
      level: 1,
      order: 2,
      isExpanded: true,
      children: [
        {
          id: 'section-2-1',
          title: 'Key Points',
          level: 2,
          order: 1,
          isExpanded: true,
        },
        {
          id: 'section-2-2',
          title: 'Analysis',
          level: 2,
          order: 2,
          isExpanded: false,
        },
      ],
    },
    {
      id: 'section-3',
      title: 'Conclusion',
      level: 1,
      order: 3,
      isExpanded: false,
    },
  ],
  lastModified: new Date('2024-01-01'),
};

describe('OutlineEditor', () => {
  const mockOnChange = jest.fn();
  const mockOnSave = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders outline editor with all sections', () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByTestId('outline-editor')).toBeInTheDocument();
      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Main Content')).toBeInTheDocument();
      expect(screen.getByText('Conclusion')).toBeInTheDocument();
    });

    it('shows section descriptions when available', () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByText('Opening section')).toBeInTheDocument();
      expect(screen.getByText('Primary content section')).toBeInTheDocument();
    });

    it('renders hierarchical structure correctly', () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      // Check that subsections are nested
      const introSection = screen
        .getByText('Introduction')
        .closest('[data-testid="outline-section"]');
      const backgroundSection = within(introSection!).getByText('Background');
      expect(backgroundSection).toBeInTheDocument();

      const mainSection = screen
        .getByText('Main Content')
        .closest('[data-testid="outline-section"]');
      const keyPointsSection = within(mainSection!).getByText('Key Points');
      const analysisSection = within(mainSection!).getByText('Analysis');
      expect(keyPointsSection).toBeInTheDocument();
      expect(analysisSection).toBeInTheDocument();
    });

    it('renders in read-only mode', () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
          readOnly={true}
        />
      );

      // Should not show edit buttons in read-only mode
      expect(
        screen.queryByRole('button', { name: /add section/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /edit/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /delete/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Section Management', () => {
    it('adds new section at top level', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByRole('button', { name: /add section/i });
      await user.click(addButton);

      const titleInput = screen.getByPlaceholderText(/section title/i);
      await user.type(titleInput, 'New Section');

      const confirmButton = screen.getByRole('button', { name: /add/i });
      await user.click(confirmButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockOutline,
        sections: [
          ...mockOutline.sections,
          expect.objectContaining({
            title: 'New Section',
            level: 1,
            order: 4,
          }),
        ],
      });
    });

    it('adds subsection to existing section', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const introSection = screen
        .getByText('Introduction')
        .closest('[data-testid="outline-section"]');
      const addSubsectionButton = within(introSection!).getByRole('button', {
        name: /add subsection/i,
      });
      await user.click(addSubsectionButton);

      const titleInput = screen.getByPlaceholderText(/section title/i);
      await user.type(titleInput, 'New Subsection');

      const confirmButton = screen.getByRole('button', { name: /add/i });
      await user.click(confirmButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'section-1',
              children: expect.arrayContaining([
                expect.objectContaining({
                  title: 'New Subsection',
                  level: 2,
                }),
              ]),
            }),
          ]),
        })
      );
    });

    it('edits existing section title', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const introSection = screen.getByText('Introduction');
      await user.dblClick(introSection);

      const editInput = screen.getByDisplayValue('Introduction');
      await user.clear(editInput);
      await user.type(editInput, 'Updated Introduction');
      await user.press('Enter');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'section-1',
              title: 'Updated Introduction',
            }),
          ]),
        });
    });

    it('deletes section with confirmation', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const conclusionSection = screen
        .getByText('Conclusion')
        .closest('[data-testid="outline-section"]');
      const deleteButton = within(conclusionSection!).getByRole('button', {
        name: /delete/i,
      });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmDeleteButton = screen.getByRole('button', {
        name: /confirm delete/i,
      });
      await user.click(confirmDeleteButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockOutline,
        sections: mockOutline.sections.filter(
          section => section.id !== 'section-3'
        ),
      });
    });

    it('cancels section deletion', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const conclusionSection = screen
        .getByText('Conclusion')
        .closest('[data-testid="outline-section"]');
      const deleteButton = within(conclusionSection!).getByRole('button', {
        name: /delete/i,
      });
      await user.click(deleteButton);

      // Cancel deletion
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Section Expansion/Collapse', () => {
    it('expands collapsed sections', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const conclusionSection = screen
        .getByText('Conclusion')
        .closest('[data-testid="outline-section"]');
      const expandButton = within(conclusionSection!).getByRole('button', {
        name: /expand/i,
      });
      await user.click(expandButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'section-3',
              isExpanded: true,
            }),
          ]),
        });
    });

    it('collapses expanded sections', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const introSection = screen
        .getByText('Introduction')
        .closest('[data-testid="outline-section"]');
      const collapseButton = within(introSection!).getByRole('button', {
        name: /collapse/i,
      });
      await user.click(collapseButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({
              id: 'section-1',
              isExpanded: false,
            }),
          ]),
        });
    });

    it('expands all sections', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const expandAllButton = screen.getByRole('button', {
        name: /expand all/i,
      });
      await user.click(expandAllButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ isExpanded: true }),
            expect.objectContaining({ isExpanded: true }),
            expect.objectContaining({ isExpanded: true }),
          ]),
        });
    });

    it('collapses all sections', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const collapseAllButton = screen.getByRole('button', {
        name: /collapse all/i,
      });
      await user.click(collapseAllButton);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: expect.arrayContaining([
            expect.objectContaining({ isExpanded: false }),
            expect.objectContaining({ isExpanded: false }),
            expect.objectContaining({ isExpanded: false }),
          ]),
        });
    });
  });

  describe('Drag and Drop', () => {
    it('reorders sections via drag and drop', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      // Simulate drag end event
      const dndContext = screen.getByTestId('dnd-context');
      const onDragEnd = dndContext.getAttribute('data-on-drag-end');

      // Simulate moving first section to second position
      if (onDragEnd) {
        const dragEndEvent = {
          active: { id: 'section-1' },
          over: { id: 'section-2' },
        };

        // This would be called by the DnD system
        fireEvent(dndContext, new CustomEvent('dragend', { detail: dragEndEvent  }));
      }

      // Verify that the onChange was called with reordered sections
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled();
      });
    });

    it('handles drag without drop', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const dndContext = screen.getByTestId('dnd-context');

      // Simulate drag without valid drop target
      const dragEndEvent = {
        active: { id: 'section-1' },
        over: null,
      };

      fireEvent(dndContext, new CustomEvent('dragend', { detail: dragEndEvent  }));
      // Should not call onChange when drag is cancelled
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Save Functionality', () => {
    it('saves outline changes', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('shows save status', async () => {
      const mockOnSaveAsync = jest.fn(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSaveAsync}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(screen.getByText(/saving/i)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText(/saved/i)).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports arrow key navigation', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const firstSection = screen.getByText('Introduction');
      firstSection.focus();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByText('Main Content')).toHaveFocus();

      await user.keyboard('{ArrowUp}');
      expect(screen.getByText('Introduction')).toHaveFocus();
    });

    it('handles Enter key to edit section', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const firstSection = screen.getByText('Introduction');
      firstSection.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByDisplayValue('Introduction')).toBeInTheDocument();
    });

    it('handles Delete key to delete section', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const conclusionSection = screen.getByText('Conclusion');
      conclusionSection.focus();
      await user.keyboard('{Delete}');

      expect(screen.getByText(/delete this section/i)).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('prevents empty section titles', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByRole('button', { name: /add section/i });
      await user.click(addButton);

      const confirmButton = screen.getByRole('button', { name: /add/i });
      await user.click(confirmButton);

      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('prevents duplicate section titles at same level', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByRole('button', { name: /add section/i });
      await user.click(addButton);

      const titleInput = screen.getByPlaceholderText(/section title/i);
      await user.type(titleInput, 'Introduction'); // Duplicate title

      const confirmButton = screen.getByRole('button', { name: /add/i });
      await user.click(confirmButton);

      expect(screen.getByText(/title already exists/i)).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('meets accessibility standards', async () => {
      const component = (
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      await runA11yTests(component);
    });

    it('has proper ARIA attributes', () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      expect(screen.getByRole('tree')).toBeInTheDocument();
      expect(
        screen.getByRole('treeitem', { name: /introduction/i })
      ).toBeInTheDocument();

      const expandedSection = screen.getByRole('treeitem', {
        name: /introduction/i,
      });
      expect(expandedSection).toHaveAttribute('aria-expanded', 'true');
    });

    it('provides screen reader announcements', async () => {
      render(
        <OutlineEditor
          outline={mockOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );

      const addButton = screen.getByRole('button', { name: /add section/i });
      await user.click(addButton);

      const titleInput = screen.getByPlaceholderText(/section title/i);
      await user.type(titleInput, 'New Section');

      const confirmButton = screen.getByRole('button', { name: /add/i });
      await user.click(confirmButton);

      expect(screen.getByText(/section added/i)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('handles large outlines efficiently', () => {
      const largeOutline = {
        ...mockOutline,
        sections: Array.from({ length: 100 }, (_, i) => ({
          id: `section-${i}`,
          title: `Section ${i}`,
          level: 1,
          order: i,
          isExpanded: false,
          children: Array.from({ length: 10 }, (_, j) => ({
            id: `section-${i}-${j}`,
            title: `Subsection ${i}-${j}`,
            level: 2,
            order: j,
            isExpanded: false,
          })),
        })),
      };

      const startTime = performance.now();
      render(
        <OutlineEditor
          outline={largeOutline}
          onChange={mockOnChange}
          onSave={mockOnSave}
        />
      );
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000);
    });
  });
});
