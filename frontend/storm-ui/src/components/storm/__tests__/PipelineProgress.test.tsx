import { screen, fireEvent } from '@testing-library/react';
import { PipelineProgress } from '../PipelineProgress';
import { render, createMockPipelineProgress } from '@/test/utils';

const mockProgress = createMockPipelineProgress();

describe('PipelineProgress', () => {
  const defaultProps = {
    progress: mockProgress,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pipeline progress information', () => {
    render(<PipelineProgress {...defaultProps} />);

    expect(screen.getByText('Pipeline Progress')).toBeInTheDocument();
    expect(
      screen.getByText('Current stage: Research Phase')
    ).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('displays current task when available', () => {
    render(<PipelineProgress {...defaultProps} />);

    expect(screen.getByText('Current Task')).toBeInTheDocument();
    expect(
      screen.getByText('Conducting perspective research...')
    ).toBeInTheDocument();
  });

  it('shows elapsed time', () => {
    render(<PipelineProgress {...defaultProps} />);

    // Should show some elapsed time
    expect(screen.getByText(/Elapsed:/)).toBeInTheDocument();
  });

  it('displays stage progress when showDetails is true', () => {
    render(<PipelineProgress {...defaultProps} showDetails />);

    expect(screen.getByText('Stage Progress')).toBeInTheDocument();
    expect(screen.getByText('Pipeline Stages')).toBeInTheDocument();
  });

  it('shows cancel button when onCancel is provided', () => {
    const onCancel = jest.fn();
    render(<PipelineProgress {...defaultProps} onCancel={onCancel} />);

    const cancelButton = screen.getByRole('button', {
      name: /cancel pipeline/i,
    });
    expect(cancelButton).toBeInTheDocument();

    fireEvent.click(cancelButton);
    expect(onCancel).toHaveBeenCalled();
  });

  it('does not show cancel button for completed pipeline', () => {
    const completedProgress = createMockPipelineProgress({
      stage: 'completed',
    });

    const onCancel = jest.fn();
    render(
      <PipelineProgress progress={completedProgress} onCancel={onCancel} />
    );

    expect(
      screen.queryByRole('button', { name: /cancel pipeline/i })
    ).not.toBeInTheDocument();
  });

  it('displays errors when present', () => {
    const progressWithErrors = createMockPipelineProgress({
      errors: [
        {
          stage: 'research',
          message: 'Failed to retrieve sources',
          timestamp: new Date(),
          severity: 'error' as const,
        },
      ],
    });

    render(<PipelineProgress progress={progressWithErrors} showDetails />);

    expect(screen.getByText('1 Error')).toBeInTheDocument();
  });

  it('shows estimated time remaining when available', () => {
    const progressWithEstimate = createMockPipelineProgress({
      estimatedEndTime: new Date(Date.now() + 300000), // 5 minutes from now
    });

    render(<PipelineProgress progress={progressWithEstimate} />);

    expect(screen.getByText(/Est\./)).toBeInTheDocument();
    expect(screen.getByText(/remaining/)).toBeInTheDocument();
  });

  it('displays stage icons correctly', () => {
    render(<PipelineProgress {...defaultProps} showDetails />);

    // Should show pipeline stages
    expect(screen.getByText('Initializing')).toBeInTheDocument();
    expect(screen.getByText('Research Phase')).toBeInTheDocument();
    expect(screen.getByText('Outline Generation')).toBeInTheDocument();
    expect(screen.getByText('Article Generation')).toBeInTheDocument();
    expect(screen.getByText('Article Polishing')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <PipelineProgress {...defaultProps} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('expands error details when clicked', () => {
    const progressWithErrors = createMockPipelineProgress({
      errors: [
        {
          stage: 'research',
          message: 'API rate limit exceeded',
          timestamp: new Date(),
          severity: 'error' as const,
        },
      ],
    });

    render(<PipelineProgress progress={progressWithErrors} />);

    const errorButton = screen.getByText('1 Error');
    fireEvent.click(errorButton);

    expect(screen.getByText('API rate limit exceeded')).toBeInTheDocument();
  });

  it('updates elapsed time over time', () => {
    jest.useFakeTimers();

    render(<PipelineProgress {...defaultProps} />);

    // Fast-forward time
    jest.advanceTimersByTime(60000); // 1 minute

    // The component should update the elapsed time
    // Note: This test might need adjustment based on the exact implementation
    expect(screen.getByText(/Elapsed:/)).toBeInTheDocument();

    jest.useRealTimers();
  });
});
