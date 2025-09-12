import { test, expect } from '@playwright/test';
import { ProjectPage } from '../pages/ProjectPage';

test.describe('Project Management', () => {
  let projectPage: ProjectPage;

  test.beforeEach(async ({ page }) => {
    projectPage = new ProjectPage(page);
    await projectPage.goto();
    await projectPage.waitForProjectsToLoad();
  });

  test('should create a new project', async () => {
    const initialCount = await projectPage.getProjectCount();

    await projectPage.createProject({
      title: 'Test Project',
      topic: 'Artificial Intelligence',
      description: 'A comprehensive guide to AI technologies',
      model: 'gpt-4o',
      provider: 'openai',
      apiKey: 'test-api-key-123',
      retrieverType: 'bing',
      retrieverApiKey: 'test-bing-key-456',
    });

    // Verify project was created
    const newCount = await projectPage.getProjectCount();
    expect(newCount).toBe(initialCount + 1);

    // Verify project appears in list
    const projectCard = await projectPage.getProjectCard('Test Project');
    await expect(projectCard).toBeVisible();
    await expect(projectCard).toContainText('Artificial Intelligence');
  });

  test('should validate required fields when creating project', async ({
    page,
  }) => {
    await projectPage.createProjectButton.click();

    // Try to save without filling required fields
    await projectPage.saveButton.click();

    // Should show validation errors
    await expect(page.getByText('Title is required')).toBeVisible();
    await expect(page.getByText('Topic is required')).toBeVisible();
    await expect(page.getByText('API key is required')).toBeVisible();
  });

  test('should search projects by title', async () => {
    // First create a test project
    await projectPage.createProject({
      title: 'Machine Learning Basics',
      topic: 'Machine Learning',
      apiKey: 'test-key',
    });

    // Search for the project
    await projectPage.searchProjects('Machine Learning');

    // Should show only matching projects
    const projectCard = await projectPage.getProjectCard(
      'Machine Learning Basics'
    );
    await expect(projectCard).toBeVisible();
  });

  test('should filter projects by status', async () => {
    await projectPage.filterByStatus('Draft');

    // Should only show draft projects
    const projectCards = await projectPage.projectCards.all();

    for (const card of projectCards) {
      await expect(card.getByTestId('project-status')).toContainText('Draft');
    }
  });

  test('should sort projects', async () => {
    await projectPage.sortBy('Title (A-Z)');

    // Get project titles
    const projectCards = await projectPage.projectCards.all();
    const titles = [];

    for (const card of projectCards) {
      const title = await card.getByTestId('project-title').textContent();
      if (title) titles.push(title);
    }

    // Verify alphabetical sorting
    const sortedTitles = [...titles].sort();
    expect(titles).toEqual(sortedTitles);
  });

  test('should open project details', async ({ page }) => {
    // Create a test project first
    await projectPage.createProject({
      title: 'Detail Test Project',
      topic: 'Testing',
      apiKey: 'test-key',
    });

    await projectPage.openProject('Detail Test Project');

    // Should navigate to project detail page
    await expect(page).toHaveURL(/\/projects\/[^\/]+$/);
    await expect(page.getByText('Detail Test Project')).toBeVisible();
  });

  test('should duplicate project', async () => {
    // Create original project
    await projectPage.createProject({
      title: 'Original Project',
      topic: 'Original Topic',
      apiKey: 'test-key',
    });

    const initialCount = await projectPage.getProjectCount();

    await projectPage.duplicateProject('Original Project');

    // Should have one more project
    const newCount = await projectPage.getProjectCount();
    expect(newCount).toBe(initialCount + 1);

    // Should show duplicated project with modified name
    const duplicateCard = await projectPage.getProjectCard(
      'Original Project (Copy)'
    );
    await expect(duplicateCard).toBeVisible();
  });

  test('should delete project', async () => {
    // Create project to delete
    await projectPage.createProject({
      title: 'Project to Delete',
      topic: 'Testing Deletion',
      apiKey: 'test-key',
    });

    const initialCount = await projectPage.getProjectCount();

    await projectPage.deleteProject('Project to Delete');

    // Should have one less project
    const newCount = await projectPage.getProjectCount();
    expect(newCount).toBe(initialCount - 1);

    // Project should no longer be visible
    const deletedCard = await projectPage.getProjectCard('Project to Delete');
    await expect(deletedCard).not.toBeVisible();
  });

  test('should handle project creation errors', async ({ page }) => {
    // Mock API error response
    await page.route('/api/projects', route => {
      route.fulfill({
        status: 400,
        body: JSON.stringify({
          success: false,
          error: 'Invalid API key format',
        }),
      });
    });

    await projectPage.createProject({
      title: 'Error Test Project',
      topic: 'Error Testing',
      apiKey: 'invalid-key',
    });

    // Should show error message
    await expect(page.getByText('Invalid API key format')).toBeVisible();
  });

  test('should persist project data across page refreshes', async ({
    page,
  }) => {
    await projectPage.createProject({
      title: 'Persistence Test',
      topic: 'Data Persistence',
      apiKey: 'test-key',
    });

    // Refresh the page
    await page.reload();
    await projectPage.waitForProjectsToLoad();

    // Project should still be visible
    const projectCard = await projectPage.getProjectCard('Persistence Test');
    await expect(projectCard).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Simulate network failure
    await page.route('/api/projects', route => {
      route.abort('failed');
    });

    await page.reload();

    // Should show error state
    await expect(page.getByText('Failed to load projects')).toBeVisible();
    await expect(page.getByTestId('retry-button')).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    await projectPage.createProject({
      title: 'Keyboard Test Project',
      topic: 'Accessibility',
      apiKey: 'test-key',
    });

    const projectCard = await projectPage.getProjectCard(
      'Keyboard Test Project'
    );

    // Focus the project card
    await projectCard.focus();

    // Should be able to navigate with keyboard
    await page.keyboard.press('Enter');

    // Should open project details
    await expect(page).toHaveURL(/\/projects\/[^\/]+$/);
  });

  test('should be responsive on mobile devices', async ({ page, isMobile }) => {
    if (isMobile) {
      // On mobile, project cards should stack vertically
      const projectCards = await projectPage.projectCards.all();

      if (projectCards.length > 1) {
        const firstCard = projectCards[0];
        const secondCard = projectCards[1];

        const firstCardBox = await firstCard.boundingBox();
        const secondCardBox = await secondCard.boundingBox();

        // Second card should be below first card
        expect(secondCardBox!.y).toBeGreaterThan(firstCardBox!.y);
      }
    }
  });

  test('should export project configuration', async ({ page }) => {
    await projectPage.createProject({
      title: 'Export Test Project',
      topic: 'Export Testing',
      apiKey: 'test-key',
    });

    const projectCard = await projectPage.getProjectCard('Export Test Project');
    await projectCard.getByTestId('project-menu-button').click();

    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('menuitem', { name: 'Export Config' }).click();
    const download = await downloadPromise;

    // Verify download
    expect(download.suggestedFilename()).toBe(
      'export-test-project-config.json'
    );
  });

  test('should import project configuration', async ({ page }) => {
    const configData = {
      title: 'Imported Project',
      topic: 'Import Testing',
      config: {
        llm: { model: 'gpt-4o', provider: 'openai', apiKey: 'imported-key' },
        retriever: { type: 'bing', apiKey: 'imported-bing-key' },
        pipeline: { doResearch: true, doGenerateOutline: true },
      },
    };

    await projectPage.createProjectButton.click();

    // Click import button
    await page.getByTestId('import-config-button').click();

    // Upload config file
    const fileInput = page.getByTestId('config-file-input');
    await fileInput.setInputFiles({
      name: 'config.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(configData)),
    });

    // Verify fields are populated
    await expect(projectPage.projectTitleInput).toHaveValue('Imported Project');
    await expect(projectPage.projectTopicInput).toHaveValue('Import Testing');
  });
});
