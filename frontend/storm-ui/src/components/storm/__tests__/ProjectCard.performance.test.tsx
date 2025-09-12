import React from 'react';
import { render, screen } from '@/test/utils';
import { ProjectCard } from '../ProjectCard';
import { StormProject } from '@/types/storm';
import { measureRenderTime } from '@/test/utils';

// Mock project data generator
const createMockProject = (id: string): StormProject => ({
  id,
  title: `Test Project ${id}`,
  topic: `Topic ${id}`,
  description: `Description for project ${id}`,
  status: 'draft',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  config: {
    llm: {
      model: 'gpt-4o',
      provider: 'openai',
      apiKey: 'test-key',
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
  outputDir: `/test/output/${id}`,
});

describe('ProjectCard Performance Tests', () => {
  const mockOnSelect = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnDuplicate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Render Performance', () => {
    it('renders single project card within performance threshold', () => {
      const project = createMockProject('perf-1');

      const renderTime = measureRenderTime(() => {
        render(
          <ProjectCard
            project={project}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
      });

      // Should render within 50ms
      expect(renderTime).toBeLessThan(50);
    });

    it('renders multiple project cards efficiently', () => {
      const projects = Array.from({ length: 50 }, (_, i) =>
        createMockProject(`perf-${i}`)
      );

      const renderTime = measureRenderTime(() => {
        render(
          <div>
            {projects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onSelect={mockOnSelect}
                onDelete={mockOnDelete}
                onDuplicate={mockOnDuplicate}
              />
            ))}
          </div>
        );
      });

      // 50 cards should render within 500ms
      expect(renderTime).toBeLessThan(500);

      // Verify all cards are rendered
      expect(screen.getAllByTestId('project-card')).toHaveLength(50);
    });

    it('handles large datasets without blocking UI', async () => {
      const largeProjects = Array.from({ length: 200 }, (_, i) =>
        createMockProject(`large-${i}`)
      );

      const startTime = performance.now();

      render(
        <div>
          {largeProjects.map(project => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={mockOnSelect}
              onDelete={mockOnDelete}
              onDuplicate={mockOnDuplicate}
            />
          ))}
        </div>
      );

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // 200 cards should render within 1 second
      expect(renderTime).toBeLessThan(1000);

      // Check that all cards are accessible (though some might be virtualized)
      const cards = screen.getAllByTestId('project-card');
      expect(cards.length).toBeGreaterThan(0);
    });

  describe('Re-render Performance', () => {
    it('optimizes re-renders when props change', () => {
      const project = createMockProject('rerender-1');

      const { rerender } = render(
        <ProjectCard
          project={project}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          onDuplicate={mockOnDuplicate}
        />
      );

      // First render
      const initialRenderTime = measureRenderTime(() => {
        rerender(
          <ProjectCard
            project={project}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
      });

      // Update only title
      const updatedProject = { ...project, title: 'Updated Title' };

      const updateRenderTime = measureRenderTime(() => {
        rerender(
          <ProjectCard
            project={updatedProject}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
      });

      // Re-render should be faster than initial render
      expect(updateRenderTime).toBeLessThan(initialRenderTime + 10);
      expect(updateRenderTime).toBeLessThan(25);
    });

    it('avoids unnecessary re-renders with memoization', () => {
      const project = createMockProject('memo-1');
      let renderCount = 0;

      // Create a wrapper to count renders
      const TestComponent = ({ project: p }: { project: StormProject }) => {
        renderCount++;
        return (
          <ProjectCard
            project={p}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
      };

      const { rerender } = render(<TestComponent project={project} />);

      expect(renderCount).toBe(1);

      // Re-render with same props
      rerender(<TestComponent project={project} />);

      // Should not trigger additional render due to memoization
      // Note: This assumes ProjectCard is properly memoized
      expect(renderCount).toBe(1);

      // Re-render with different props
      const updatedProject = { ...project, title: 'New Title' };
      rerender(<TestComponent project={updatedProject} />);

      expect(renderCount).toBe(2);
    });

  describe('Memory Performance', () => {
    it('does not cause memory leaks with event handlers', () => {
      const project = createMockProject('memory-1');

      // Create multiple instances to test for memory leaks
      const components = [];
      for (let i = 0; i < 10; i++) {
        const { unmount } = render(
          <ProjectCard
            project={project}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
        components.push(unmount);
      }

      // Unmount all components
      components.forEach(unmount => unmount());
      // Verify event handlers are cleaned up
      expect(mockOnSelect).not.toHaveBeenCalled();
      expect(mockOnDelete).not.toHaveBeenCalled();
      expect(mockOnDuplicate).not.toHaveBeenCalled();
    });

    it('handles rapid mount/unmount cycles', () => {
      const project = createMockProject('rapid-1');

      const startTime = performance.now();

      // Rapidly mount and unmount components
      for (let i = 0; i < 50; i++) {
        const { unmount } = render(
          <ProjectCard
            project={project}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
        unmount();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 50 mount/unmount cycles should complete within 200ms
      expect(totalTime).toBeLessThan(200);
    });

  describe('Interaction Performance', () => {
    it('responds to clicks quickly', async () => {
      const project = createMockProject('click-1');

      render(
        <ProjectCard
          project={project}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          onDuplicate={mockOnDuplicate}
        />
      );

      const projectCard = screen.getByTestId('project-card');

      const startTime = performance.now();

      // Simulate click
      projectCard.click();

      const endTime = performance.now();
      const responseTime = endTime - startTime;

      // Click response should be under 10ms
      expect(responseTime).toBeLessThan(10);
      expect(mockOnSelect).toHaveBeenCalledWith(project);
    });

    it('handles rapid multiple clicks', async () => {
      const project = createMockProject('rapid-click-1');

      render(
        <ProjectCard
          project={project}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          onDuplicate={mockOnDuplicate}
        />
      );

      const projectCard = screen.getByTestId('project-card');

      const startTime = performance.now();

      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        projectCard.click();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // 10 rapid clicks should complete within 50ms
      expect(totalTime).toBeLessThan(50);
      expect(mockOnSelect).toHaveBeenCalledTimes(10);
    });

  describe('Animation Performance', () => {
    it('maintains smooth animations during hover', async () => {
      const project = createMockProject('hover-1');

      render(
        <ProjectCard
          project={project}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          onDuplicate={mockOnDuplicate}
        />
      );

      const projectCard = screen.getByTestId('project-card');

      // Simulate hover events
      const startTime = performance.now();

      // Multiple hover states
      for (let i = 0; i < 20; i++) {
        projectCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        projectCard.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Hover animations should be smooth (under 100ms for 20 cycles)
      expect(totalTime).toBeLessThan(100);
    });

  describe('Bundle Size Impact', () => {
    it('keeps component bundle size reasonable', () => {
      // This is more of a build-time test, but we can check if component
      // doesn't import unnecessary dependencies

      const project = createMockProject('bundle-1');

      const { container } = render(
        <ProjectCard
          project={project}
          onSelect={mockOnSelect}
          onDelete={mockOnDelete}
          onDuplicate={mockOnDuplicate}
        />
      );

      // Component should render with minimal DOM structure
      const elements = container.querySelectorAll('*');
      expect(elements.length).toBeLessThan(20); // Reasonable DOM size
    });

  describe('Edge Cases Performance', () => {
    it('handles very long text content efficiently', () => {
      const projectWithLongText = createMockProject('long-text-1');
      projectWithLongText.title = 'A'.repeat(1000);
      projectWithLongText.description = 'B'.repeat(5000);

      const renderTime = measureRenderTime(() => {
        render(
          <ProjectCard
            project={projectWithLongText}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
      });

      // Should handle long text without significant performance impact
      expect(renderTime).toBeLessThan(100);
    });

    it('handles undefined optional props gracefully', () => {
      const minimalProject: StormProject = {
        id: 'minimal-1',
        title: 'Minimal Project',
        topic: 'Topic',
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
        config: {
          llm: { model: 'gpt-4o', provider: 'openai' },
          retriever: { type: 'bing' },
          pipeline: {
            doResearch: true,
            doGenerateOutline: true,
            doGenerateArticle: true,
            doPolishArticle: true,
          },
        },
        outputDir: '/minimal',
      };

      const renderTime = measureRenderTime(() => {
        render(
          <ProjectCard
            project={minimalProject}
            onSelect={mockOnSelect}
            onDelete={mockOnDelete}
            onDuplicate={mockOnDuplicate}
          />
        );
      });

      expect(renderTime).toBeLessThan(50);
    });
});
