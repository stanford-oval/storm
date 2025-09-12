import { Page, Locator, expect } from '@playwright/test';

export class PipelinePage {
  readonly page: Page;
  readonly startPipelineButton: Locator;
  readonly stopPipelineButton: Locator;
  readonly pausePipelineButton: Locator;
  readonly resumePipelineButton: Locator;
  readonly pipelineProgress: Locator;
  readonly progressBar: Locator;
  readonly currentStage: Locator;
  readonly currentTask: Locator;
  readonly errorMessages: Locator;
  readonly pipelineLogs: Locator;
  readonly logLevelFilter: Locator;
  readonly refreshLogsButton: Locator;
  readonly downloadLogsButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.startPipelineButton = page.getByTestId('start-pipeline-button');
    this.stopPipelineButton = page.getByTestId('stop-pipeline-button');
    this.pausePipelineButton = page.getByTestId('pause-pipeline-button');
    this.resumePipelineButton = page.getByTestId('resume-pipeline-button');
    this.pipelineProgress = page.getByTestId('pipeline-progress');
    this.progressBar = page.getByTestId('progress-bar');
    this.currentStage = page.getByTestId('current-stage');
    this.currentTask = page.getByTestId('current-task');
    this.errorMessages = page.getByTestId('error-message');
    this.pipelineLogs = page.getByTestId('pipeline-logs');
    this.logLevelFilter = page.getByTestId('log-level-filter');
    this.refreshLogsButton = page.getByTestId('refresh-logs-button');
    this.downloadLogsButton = page.getByTestId('download-logs-button');
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/pipeline`);
    await expect(this.page).toHaveURL(`/projects/${projectId}/pipeline`);
  }

  async startPipeline() {
    await this.startPipelineButton.click();

    // Wait for pipeline to start
    await expect(this.pipelineProgress).toBeVisible();
    await expect(this.currentStage).toContainText('initializing');
  }

  async stopPipeline() {
    await this.stopPipelineButton.click();

    // Confirm stop
    await this.page.getByTestId('confirm-stop-button').click();

    // Wait for pipeline to stop
    await expect(this.page.getByText('Pipeline stopped')).toBeVisible();
  }

  async pausePipeline() {
    await this.pausePipelineButton.click();

    // Wait for pipeline to pause
    await expect(this.page.getByText('Pipeline paused')).toBeVisible();
    await expect(this.resumePipelineButton).toBeVisible();
  }

  async resumePipeline() {
    await this.resumePipelineButton.click();

    // Wait for pipeline to resume
    await expect(this.page.getByText('Pipeline resumed')).toBeVisible();
    await expect(this.pausePipelineButton).toBeVisible();
  }

  async waitForStage(stageName: string, timeout: number = 30000) {
    await expect(this.currentStage).toContainText(stageName, { timeout });
  }

  async waitForCompletion(timeout: number = 300000) {
    // Wait for pipeline to complete (5 minute timeout)
    await expect(this.currentStage).toContainText('completed', { timeout });
    await expect(this.progressBar).toHaveAttribute('aria-valuenow', '100');
  }

  async getProgressPercentage(): Promise<number> {
    const progressValue = await this.progressBar.getAttribute('aria-valuenow');
    return parseInt(progressValue || '0', 10);
  }

  async getCurrentStage(): Promise<string> {
    return (await this.currentStage.textContent()) || '';
  }

  async getCurrentTask(): Promise<string> {
    return (await this.currentTask.textContent()) || '';
  }

  async hasErrors(): Promise<boolean> {
    return await this.errorMessages.isVisible();
  }

  async getErrors(): Promise<string[]> {
    const errorElements = await this.errorMessages.all();
    const errors = [];

    for (const element of errorElements) {
      const text = await element.textContent();
      if (text) errors.push(text);
    }

    return errors;
  }

  async viewLogs() {
    // Scroll to logs section
    await this.pipelineLogs.scrollIntoViewIfNeeded();
  }

  async filterLogsByLevel(level: string) {
    await this.logLevelFilter.selectOption(level);
    // Wait for logs to update
    await this.page.waitForTimeout(1000);
  }

  async refreshLogs() {
    await this.refreshLogsButton.click();
    // Wait for logs to refresh
    await expect(this.page.getByText('Logs refreshed')).toBeVisible();
  }

  async downloadLogs() {
    // Start waiting for download before clicking
    const downloadPromise = this.page.waitForEvent('download');
    await this.downloadLogsButton.click();
    const download = await downloadPromise;

    return download;
  }

  async getLogCount(): Promise<number> {
    return await this.page.getByTestId('log-entry').count();
  }

  async waitForLogEntry(message: string, timeout: number = 10000) {
    await expect(this.page.getByText(message)).toBeVisible({ timeout });
  }

  async monitorPipelineProgress() {
    const stages = [
      'initializing',
      'research',
      'outline_generation',
      'article_generation',
      'polishing',
      'completed',
    ];

    for (const stage of stages) {
      await this.waitForStage(stage);

      // Verify progress is increasing
      const progress = await this.getProgressPercentage();
      expect(progress).toBeGreaterThan(0);

      console.log(`Pipeline stage: ${stage}, Progress: ${progress}%`);
    }

    // Verify final completion
    const finalProgress = await this.getProgressPercentage();
    expect(finalProgress).toBe(100);
  }
}

export default PipelinePage;
