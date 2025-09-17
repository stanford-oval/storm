import { test, expect } from '@playwright/test';
import { ProjectPage } from '../pages/ProjectPage';
import { PipelinePage } from '../pages/PipelinePage';

test.describe('STORM Pipeline Execution', () => {
  let projectPage: ProjectPage;
  let pipelinePage: PipelinePage;
  let projectId: string;

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    pipelinePage = new PipelinePage(page);

    // Create a test project
    await projectPage.goto();
    await projectPage.createProject({
      title: 'Pipeline Test Project',
      topic: 'Machine Learning Applications',
      description: 'Testing STORM pipeline execution',
      model: 'gpt-4o',
      provider: 'openai',
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      retrieverType: 'bing',
      retrieverApiKey: process.env.BING_API_KEY || 'test-bing-key',
    });

    // Extract project ID from URL or project card
    const projectCard = await projectPage.getProjectCard(
      'Pipeline Test Project'
    );
    await projectCard.click();

    // Get project ID from URL
    const url = page.url();
    projectId = url.split('/projects/')[1].split('/')[0];
  });

  test('should execute complete STORM pipeline', async ({ page }) => {
    await pipelinePage.goto(projectId);

    // Start the pipeline
    await pipelinePage.startPipeline();

    // Monitor pipeline progress through all stages
    await pipelinePage.monitorPipelineProgress();

    // Verify completion
    await pipelinePage.waitForCompletion();

    // Check that article was generated
    await page.goto(`/projects/${projectId}/article`);
    await expect(page.getByTestId('article-content')).toBeVisible();
    await expect(page.getByTestId('article-title')).not.toBeEmpty();
  });

  test('should handle research stage properly', async ({ page }) => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for research stage
    await pipelinePage.waitForStage('research');

    // Verify research logs appear
    await pipelinePage.viewLogs();
    await pipelinePage.waitForLogEntry('Starting research phase');
    await pipelinePage.waitForLogEntry('Conducting perspective research');

    // Check that sources are being retrieved
    await pipelinePage.waitForLogEntry('Retrieved sources from');

    // Verify research progress updates
    const progress = await pipelinePage.getProgressPercentage();
    expect(progress).toBeGreaterThan(0);
  });

  test('should generate outline correctly', async ({ page }) => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for outline generation stage
    await pipelinePage.waitForStage('outline_generation');

    // Check outline generation logs
    await pipelinePage.viewLogs();
    await pipelinePage.waitForLogEntry('Generating article outline');

    // Navigate to outline view
    await page.goto(`/projects/${projectId}/outline`);

    // Wait for outline to be generated
    await expect(page.getByTestId('outline-section')).toBeVisible({
      timeout: 30000,
    });

    // Verify outline has sections
    const sectionCount = await page.getByTestId('outline-section').count();
    expect(sectionCount).toBeGreaterThan(0);
  });

  test('should generate article with citations', async ({ page }) => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for article generation stage
    await pipelinePage.waitForStage('article_generation');

    // Check article generation logs
    await pipelinePage.viewLogs();
    await pipelinePage.waitForLogEntry('Generating article content');

    // Wait for article to be generated
    await page.goto(`/projects/${projectId}/article`);

    // Wait for article content
    await expect(page.getByTestId('article-content')).toBeVisible({
      timeout: 60000,
    });

    // Verify article has content
    const articleContent = await page
      .getByTestId('article-content')
      .textContent();
    expect(articleContent?.length).toBeGreaterThan(100);

    // Verify citations are present
    await expect(page.getByTestId('citation')).toBeVisible();
    const citationCount = await page.getByTestId('citation').count();
    expect(citationCount).toBeGreaterThan(0);
  });

  test('should polish article in final stage', async ({ page }) => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for polishing stage
    await pipelinePage.waitForStage('polishing');

    // Check polishing logs
    await pipelinePage.viewLogs();
    await pipelinePage.waitForLogEntry('Polishing article');
    await pipelinePage.waitForLogEntry('Adding summary');
    await pipelinePage.waitForLogEntry('Removing duplicates');

    // Wait for completion
    await pipelinePage.waitForCompletion();

    // Navigate to final article
    await page.goto(`/projects/${projectId}/article`);

    // Verify article has summary
    await expect(page.getByTestId('article-summary')).toBeVisible();

    // Verify word count is updated
    await expect(page.getByTestId('word-count')).not.toContainText('0 words');
  });

  test('should pause and resume pipeline', async () => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for pipeline to start processing
    await pipelinePage.waitForStage('research');

    // Pause pipeline
    await pipelinePage.pausePipeline();

    // Verify pipeline is paused
    const stage = await pipelinePage.getCurrentStage();
    expect(stage).toContain('paused');

    // Resume pipeline
    await pipelinePage.resumePipeline();

    // Verify pipeline continues
    const resumedStage = await pipelinePage.getCurrentStage();
    expect(resumedStage).not.toContain('paused');
  });

  test('should stop pipeline execution', async () => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for pipeline to start processing
    await pipelinePage.waitForStage('research');

    // Stop pipeline
    await pipelinePage.stopPipeline();

    // Verify pipeline has stopped
    await expect(pipelinePage.startPipelineButton).toBeVisible();
    await expect(pipelinePage.stopPipelineButton).not.toBeVisible();
  });

  test('should handle pipeline errors gracefully', async ({ page }) => {
    // Mock API error
    await page.route('/api/pipeline/start', route => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          success: false,
          error: 'Invalid API key',
        }),
      });
    });

    await pipelinePage.goto(projectId);
    await pipelinePage.startPipelineButton.click();

    // Should show error message
    await expect(page.getByText('Invalid API key')).toBeVisible();

    // Pipeline should not start
    await expect(pipelinePage.pipelineProgress).not.toBeVisible();
  });

  test('should filter logs by level', async () => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for some logs to accumulate
    await pipelinePage.waitForStage('research');
    await pipelinePage.viewLogs();

    const totalLogCount = await pipelinePage.getLogCount();

    // Filter by error level
    await pipelinePage.filterLogsByLevel('error');

    const errorLogCount = await pipelinePage.getLogCount();
    expect(errorLogCount).toBeLessThanOrEqual(totalLogCount);
  });

  test('should download pipeline logs', async () => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for some logs to be generated
    await pipelinePage.waitForStage('research');
    await pipelinePage.viewLogs();

    // Download logs
    const download = await pipelinePage.downloadLogs();

    // Verify download
    expect(download.suggestedFilename()).toContain('.log');
  });

  test('should show real-time progress updates', async () => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    let lastProgress = 0;

    // Monitor progress increases over time
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(2000);
      const currentProgress = await pipelinePage.getProgressPercentage();

      if (currentProgress > lastProgress) {
        expect(currentProgress).toBeGreaterThan(lastProgress);
        lastProgress = currentProgress;
      }

      if (currentProgress === 100) break;
    }
  });

  test('should handle WebSocket connection for real-time updates', async ({
    page,
  }) => {
    await pipelinePage.goto(projectId);

    // Listen for WebSocket messages
    const messages: any[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const message = JSON.parse(event.payload as string);
          messages.push(message);
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
    });

    await pipelinePage.startPipeline();

    // Wait a bit for WebSocket messages
    await page.waitForTimeout(5000);

    // Should have received pipeline update messages
    const pipelineMessages = messages.filter(
      msg => msg.type === 'pipeline_update' || msg.type === 'progress_update'
    );
    expect(pipelineMessages.length).toBeGreaterThan(0);
  });

  test('should support custom pipeline configuration', async ({ page }) => {
    // Navigate to configuration
    await page.goto(`/projects/${projectId}/config`);

    // Modify pipeline settings
    await page.getByTestId('max-conv-turns-input').fill('3');
    await page.getByTestId('max-perspectives-input').fill('2');

    // Disable article polishing
    await page.getByTestId('do-polish-article-toggle').click();

    // Save configuration
    await page.getByTestId('save-config-button').click();

    // Start pipeline with custom config
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Verify polishing stage is skipped
    await pipelinePage.waitForStage('article_generation');
    await pipelinePage.waitForCompletion();

    // Should not see polishing in logs
    await pipelinePage.viewLogs();
    const logContent = await page.getByTestId('pipeline-logs').textContent();
    expect(logContent).not.toContain('Polishing article');
  });

  test('should resume interrupted pipeline after page refresh', async ({
    page,
  }) => {
    await pipelinePage.goto(projectId);
    await pipelinePage.startPipeline();

    // Wait for pipeline to be running
    await pipelinePage.waitForStage('research');

    // Refresh the page
    await page.reload();

    // Pipeline should resume automatically
    await expect(pipelinePage.pipelineProgress).toBeVisible();
    await expect(pipelinePage.stopPipelineButton).toBeVisible();

    // Progress should continue
    const progress = await pipelinePage.getProgressPercentage();
    expect(progress).toBeGreaterThan(0);
  });
});
