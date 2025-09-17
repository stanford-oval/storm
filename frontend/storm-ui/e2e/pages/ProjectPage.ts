import { Page, Locator, expect } from '@playwright/test';

export class ProjectPage {
  readonly page: Page;
  readonly createProjectButton: Locator;
  readonly projectTitleInput: Locator;
  readonly projectTopicInput: Locator;
  readonly projectDescriptionInput: Locator;
  readonly modelSelect: Locator;
  readonly providerSelect: Locator;
  readonly apiKeyInput: Locator;
  readonly retrieverSelect: Locator;
  readonly retrieverApiKeyInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly projectCards: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;
  readonly sortDropdown: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createProjectButton = page.getByTestId('create-project-button');
    this.projectTitleInput = page.getByTestId('project-title-input');
    this.projectTopicInput = page.getByTestId('project-topic-input');
    this.projectDescriptionInput = page.getByTestId(
      'project-description-input'
    );
    this.modelSelect = page.getByTestId('model-select');
    this.providerSelect = page.getByTestId('provider-select');
    this.apiKeyInput = page.getByTestId('api-key-input');
    this.retrieverSelect = page.getByTestId('retriever-select');
    this.retrieverApiKeyInput = page.getByTestId('retriever-api-key-input');
    this.saveButton = page.getByTestId('save-button');
    this.cancelButton = page.getByTestId('cancel-button');
    this.projectCards = page.getByTestId('project-card');
    this.searchInput = page.getByTestId('project-search-input');
    this.filterDropdown = page.getByTestId('project-filter-dropdown');
    this.sortDropdown = page.getByTestId('project-sort-dropdown');
  }

  async goto() {
    await this.page.goto('/projects');
    await expect(this.page).toHaveURL('/projects');
  }

  async createProject(projectData: {
    title: string;
    topic: string;
    description?: string;
    model?: string;
    provider?: string;
    apiKey?: string;
    retrieverType?: string;
    retrieverApiKey?: string;
  }) {
    await this.createProjectButton.click();

    // Wait for modal to appear
    await expect(this.projectTitleInput).toBeVisible();

    // Fill basic info
    await this.projectTitleInput.fill(projectData.title);
    await this.projectTopicInput.fill(projectData.topic);

    if (projectData.description) {
      await this.projectDescriptionInput.fill(projectData.description);
    }

    // Configure LLM settings
    if (projectData.model) {
      await this.modelSelect.selectOption(projectData.model);
    }

    if (projectData.provider) {
      await this.providerSelect.selectOption(projectData.provider);
    }

    if (projectData.apiKey) {
      await this.apiKeyInput.fill(projectData.apiKey);
    }

    // Configure retriever settings
    if (projectData.retrieverType) {
      await this.retrieverSelect.selectOption(projectData.retrieverType);
    }

    if (projectData.retrieverApiKey) {
      await this.retrieverApiKeyInput.fill(projectData.retrieverApiKey);
    }

    // Save project
    await this.saveButton.click();

    // Wait for project to be created
    await expect(
      this.page.getByText('Project created successfully')
    ).toBeVisible();
  }

  async searchProjects(query: string) {
    await this.searchInput.fill(query);
    // Wait for search results to update
    await this.page.waitForTimeout(500);
  }

  async filterByStatus(status: string) {
    await this.filterDropdown.click();
    await this.page.getByRole('option', { name: status }).click();
  }

  async sortBy(sortOption: string) {
    await this.sortDropdown.click();
    await this.page.getByRole('option', { name: sortOption }).click();
  }

  async getProjectCard(title: string) {
    return this.page.getByTestId('project-card').filter({ hasText: title });
  }

  async openProject(title: string) {
    const projectCard = await this.getProjectCard(title);
    await projectCard.click();
  }

  async deleteProject(title: string) {
    const projectCard = await this.getProjectCard(title);
    await projectCard.getByTestId('project-menu-button').click();
    await this.page.getByRole('menuitem', { name: 'Delete' }).click();

    // Confirm deletion
    await this.page.getByTestId('confirm-delete-button').click();
    await expect(
      this.page.getByText('Project deleted successfully')
    ).toBeVisible();
  }

  async duplicateProject(title: string) {
    const projectCard = await this.getProjectCard(title);
    await projectCard.getByTestId('project-menu-button').click();
    await this.page.getByRole('menuitem', { name: 'Duplicate' }).click();

    await expect(
      this.page.getByText('Project duplicated successfully')
    ).toBeVisible();
  }

  async getProjectCount() {
    return await this.projectCards.count();
  }

  async waitForProjectsToLoad() {
    await expect(this.page.getByTestId('projects-loading')).not.toBeVisible();
  }
}

export default ProjectPage;
