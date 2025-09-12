import { screen, fireEvent } from '@testing-library/react';
import { ProjectCard } from '../ProjectCard';
import { render, createMockStormProject } from '@/test/utils';

const mockProject = createMockStormProject();

describe('ProjectCard', () => {
  const defaultProps = {
    project: mockProject,
    onSelect: jest.fn(),
    onDelete: jest.fn(),
    onDuplicate: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders project information correctly', () => {
    render(<ProjectCard {...defaultProps} />);

    expect(screen.getByText(mockProject.title)).toBeInTheDocument();
    expect(screen.getByText(mockProject.topic)).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('calls onSelect when card is clicked', () => {
    render(<ProjectCard {...defaultProps} />);

    fireEvent.click(
      screen.getByRole('article') || screen.getByText(mockProject.title)
    );
    expect(defaultProps.onSelect).toHaveBeenCalledWith(mockProject);
  });

  it('shows progress bar for running projects', () => {
    const runningProject = createMockStormProject({
      status: 'researching',
      progress: {
        stage: 'research',
        stageProgress: 50,
        overallProgress: 25,
        startTime: new Date(),
        currentTask: 'Researching topic...',
      },
    });

    render(<ProjectCard {...defaultProps} project={runningProject} />);

    expect(screen.getByText('25%')).toBeInTheDocument();
    expect(screen.getByText('Researching topic...')).toBeInTheDocument();
  });

  it('displays model and retriever information', () => {
    render(<ProjectCard {...defaultProps} />);

    expect(screen.getByText('Model: gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('Retriever: bing')).toBeInTheDocument();
  });

  it('shows word count when article exists', () => {
    const projectWithArticle = createMockStormProject({
      article: {
        title: 'Test Article',
        content: 'Content',
        wordCount: 1500,
        sections: [],
        citations: [],
        lastModified: new Date(),
      },
    });

    render(<ProjectCard {...defaultProps} project={projectWithArticle} />);

    expect(screen.getByText('1,500 words')).toBeInTheDocument();
  });

  it('opens dropdown menu and handles actions', async () => {
    render(<ProjectCard {...defaultProps} />);

    // Find and click the dropdown trigger
    const dropdownTrigger = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(dropdownTrigger);

    // Check if menu items are present
    expect(screen.getByText('Open Project')).toBeInTheDocument();
    expect(screen.getByText('Duplicate')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    // Test duplicate action
    fireEvent.click(screen.getByText('Duplicate', { status: 200 });
    expect(defaultProps.onDuplicate).toHaveBeenCalledWith(mockProject);

    // Re-open menu for delete test
    fireEvent.click(dropdownTrigger);
    fireEvent.click(screen.getByText('Delete', { status: 200 });
    expect(defaultProps.onDelete).toHaveBeenCalledWith(mockProject.id);
  });

  it('shows running indicator for active projects', () => {
    const runningProject = createMockStormProject({
      status: 'writing_article',
    });

    const { container } = render(
      <ProjectCard {...defaultProps} project={runningProject} />
    );

    // Check for the animated dot indicator
    const indicator = container.querySelector('.animate-pulse');
    expect(indicator).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ProjectCard {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('does not trigger onSelect when clicking on dropdown', () => {
    render(<ProjectCard {...defaultProps} />);

    const dropdownTrigger = screen.getByRole('button', { name: /open menu/i });
    fireEvent.click(dropdownTrigger);

    expect(defaultProps.onSelect).not.toHaveBeenCalled();
  });

}
)))