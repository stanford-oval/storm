import { test, expect, Page } from '@playwright/test';
import { projectService } from '../src/services/project';
import { pipelineService } from '../src/services/pipeline';

// Test data
const testProject = {
  title: 'E2E Test Project',
  topic: 'Artificial Intelligence',
  description: 'A test project for E2E testing purposes',
};

const testConfig = {
  languageModel: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
  },
  retrieval: {
    provider: 'bing',
    maxResults: 10,
  },
  research: {
    maxConversations: 3,
    conversationDepth: 2,
  },
  generation: {
    maxSections: 5,
    includeImages: false,
  },
};

// Helper functions
async function login(
  page: Page,
  email = 'test@example.com',
  password = 'password123'
) {
  await page.goto('/login');
  await page.fill('[data-testid=email-input]', email);
  await page.fill('[data-testid=password-input]', password);
  await page.click('[data-testid=login-button]');
  await expect(page).toHaveURL('/dashboard');
}

async function createTestProject(page: Page) {
  await page.goto('/projects/new');

  // Fill project details
  await page.fill('[data-testid=project-title-input]', testProject.title);
  await page.fill('[data-testid=project-topic-input]', testProject.topic);
  await page.fill(
    '[data-testid=project-description-input]',
    testProject.description
  );

  // Configure LM settings
  await page.click('[data-testid=language-model-tab]');
  await page.selectOption(
    '[data-testid=lm-provider-select]',
    testConfig.languageModel.provider
  );
  await page.selectOption(
    '[data-testid=lm-model-select]',
    testConfig.languageModel.model
  );
  await page.fill(
    '[data-testid=temperature-input]',
    testConfig.languageModel.temperature.toString()
  );

  // Configure retrieval settings
  await page.click('[data-testid=retrieval-tab]');
  await page.selectOption(
    '[data-testid=retrieval-provider-select]',
    testConfig.retrieval.provider
  );
  await page.fill(
    '[data-testid=max-results-input]',
    testConfig.retrieval.maxResults.toString()
  );

  // Save project
  await page.click('[data-testid=create-project-button]');
  await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);

  return await page.url().split('/').pop()!;
}

async function waitForPipelineCompletion(
  page: Page,
  projectId: string,
  timeout = 300000
) {
  let attempts = 0;
  const maxAttempts = timeout / 5000; // Check every 5 seconds

  while (attempts < maxAttempts) {
    const progressBar = page.locator('[data-testid=pipeline-progress]');
    const statusText = await progressBar
      .locator('[data-testid=status-text]')
      .textContent();

    if (statusText?.includes('Completed') || statusText?.includes('Failed')) {
      return statusText.includes('Completed');
    }

    await page.waitForTimeout(5000);
    attempts++;
  }

  throw new Error('Pipeline did not complete within timeout');
}

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses for faster tests
    await page.route('**/api/v1/auth/**', route => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              token: 'mock-jwt-token',
              user: {
                id: 'test-user-id',
                email: 'test@example.com',
                name: 'Test User',
                role: 'user',
              },
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          }),
        });
      }
    });

    await login(page);
  });

  test('Complete Project Creation and Management Flow', async ({ page }) => {
    // 1. Navigate to projects dashboard
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid=projects-grid]')).toBeVisible();

    // 2. Create new project
    await page.click('[data-testid=create-project-button]');
    const projectId = await createTestProject(page);

    // 3. Verify project was created
    expect(projectId).toBeTruthy();
    await expect(page.locator('[data-testid=project-title]')).toContainText(
      testProject.title
    );
    await expect(page.locator('[data-testid=project-topic]')).toContainText(
      testProject.topic
    );

    // 4. Edit project details
    await page.click('[data-testid=edit-project-button]');
    await page.fill(
      '[data-testid=project-description-input]',
      'Updated description'
    );
    await page.click('[data-testid=save-changes-button]');
    await expect(page.locator('[data-testid=success-toast]')).toBeVisible();

    // 5. Duplicate project
    await page.click('[data-testid=project-actions-menu]');
    await page.click('[data-testid=duplicate-project-action]');
    await page.fill(
      '[data-testid=duplicate-title-input]',
      'Duplicated Test Project'
    );
    await page.click('[data-testid=confirm-duplicate-button]');

    // 6. Archive project
    await page.click('[data-testid=project-actions-menu]');
    await page.click('[data-testid=archive-project-action]');
    await page.click('[data-testid=confirm-archive-button]');
    await expect(page.locator('[data-testid=success-toast]')).toContainText(
      'archived'
    );

    // 7. Navigate back to dashboard and verify project is archived
    await page.goto('/dashboard');
    await page.click('[data-testid=show-archived-toggle]');
    await expect(
      page.locator(`[data-testid=project-card-${projectId}]`)
    ).toHaveAttribute('data-status', 'archived');
  });

  test('Complete STORM Pipeline Execution Flow', async ({ page }) => {
    // 1. Create a test project
    const projectId = await createTestProject(page);

    // 2. Start the pipeline
    await page.click('[data-testid=start-pipeline-button]');

    // Verify pipeline configuration modal
    await expect(
      page.locator('[data-testid=pipeline-config-modal]')
    ).toBeVisible();

    // Select pipeline stages
    await page.check('[data-testid=research-stage-checkbox]');
    await page.check('[data-testid=outline-stage-checkbox]');
    await page.check('[data-testid=article-stage-checkbox]');
    await page.check('[data-testid=polish-stage-checkbox]');

    await page.click('[data-testid=start-pipeline-confirm-button]');

    // 3. Monitor pipeline progress
    await expect(
      page.locator('[data-testid=pipeline-progress-panel]')
    ).toBeVisible();

    // Check research stage
    await expect(
      page.locator('[data-testid=research-stage-indicator]')
    ).toHaveClass(/active|running/);
    await page.waitForSelector('[data-testid=research-conversations]', {
      timeout: 60000,
    });
    await expect(
      page.locator('[data-testid=research-conversations] .conversation-item')
    ).toHaveCount(3);

    // 4. Review research results
    await page.click('[data-testid=research-tab]');
    await expect(
      page.locator('[data-testid=research-conversations]')
    ).toBeVisible();
    await expect(page.locator('[data-testid=research-sources]')).toBeVisible();

    // Verify conversation content
    const firstConversation = page.locator('[data-testid=conversation-0]');
    await expect(
      firstConversation.locator('[data-testid=conversation-title]')
    ).toBeVisible();
    await expect(
      firstConversation.locator('[data-testid=conversation-messages]')
    ).toBeVisible();

    // 5. Wait for outline generation
    await expect(
      page.locator('[data-testid=outline-stage-indicator]')
    ).toHaveClass(/active|running/);
    await page.waitForSelector('[data-testid=generated-outline]', {
      timeout: 120000,
    });

    // 6. Review and edit outline
    await page.click('[data-testid=outline-tab]');
    await expect(page.locator('[data-testid=outline-editor]')).toBeVisible();

    // Add a new section
    await page.click('[data-testid=add-section-button]');
    await page.fill('[data-testid=new-section-title]', 'Additional Insights');
    await page.fill(
      '[data-testid=new-section-description]',
      'Extra insights on the topic'
    );
    await page.click('[data-testid=confirm-add-section]');

    // Reorder sections using drag and drop
    const section1 = page.locator('[data-testid=outline-section-1]');
    const section2 = page.locator('[data-testid=outline-section-2]');
    await section1.dragTo(section2);

    await page.click('[data-testid=save-outline-button]');

    // 7. Continue with article generation
    await page.click('[data-testid=continue-pipeline-button]');
    await expect(
      page.locator('[data-testid=article-stage-indicator]')
    ).toHaveClass(/active|running/);

    // 8. Monitor article generation progress
    await page.waitForSelector('[data-testid=article-sections-progress]', {
      timeout: 180000,
    });

    // Check that sections are being generated
    await expect(
      page.locator('[data-testid=section-progress-0]')
    ).toHaveAttribute('data-status', 'completed');

    // 9. Review generated article
    await page.click('[data-testid=article-tab]');
    await expect(page.locator('[data-testid=article-editor]')).toBeVisible();

    // Verify article content
    const articleContent = page.locator('[data-testid=article-content]');
    await expect(articleContent).toContainText('# ' + testProject.title);
    await expect(
      articleContent.locator('[data-testid=citation-link]').first()
    ).toBeVisible();

    // 10. Edit article content
    await page.click('[data-testid=edit-article-button]');
    await page
      .locator('[data-testid=article-editor] [contenteditable=true]')
      .first()
      .fill('Updated introduction paragraph');
    await page.click('[data-testid=save-article-button]');

    // 11. Complete pipeline with polish stage
    await page.click('[data-testid=continue-pipeline-button]');
    await expect(
      page.locator('[data-testid=polish-stage-indicator]')
    ).toHaveClass(/active|running/);

    // 12. Wait for pipeline completion
    const completed = await waitForPipelineCompletion(page, projectId);
    expect(completed).toBe(true);

    // 13. Verify final results
    await expect(
      page.locator('[data-testid=pipeline-complete-banner]')
    ).toBeVisible();
    await expect(page.locator('[data-testid=pipeline-status]')).toContainText(
      'Completed'
    );

    // Check article statistics
    const stats = page.locator('[data-testid=article-stats]');
    await expect(stats.locator('[data-testid=word-count]')).not.toContainText(
      '0'
    );
    await expect(
      stats.locator('[data-testid=section-count]')
    ).not.toContainText('0');
    await expect(
      stats.locator('[data-testid=citation-count]')
    ).not.toContainText('0');
  });

  test('Article Export and Download Flow', async ({ page }) => {
    // 1. Create and complete a project
    const projectId = await createTestProject(page);

    // Mock completed project state
    await page.route(`**/api/v1/projects/${projectId}`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            ...testProject,
            id: projectId,
            status: 'completed',
            article: {
              title: testProject.title,
              content: '# Test Article\n\nThis is a test article content.',
              wordCount: 150,
              sectionCount: 3,
              citations: ['https://example.com/source1'],
            },
          },
        }),
      });
    });

    await page.goto(`/projects/${projectId}/article`);

    // 2. Test PDF export
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid=export-menu-button]');
    await page.click('[data-testid=export-pdf-option]');

    // Configure export options
    await expect(
      page.locator('[data-testid=export-options-modal]')
    ).toBeVisible();
    await page.check('[data-testid=include-outline-checkbox]');
    await page.check('[data-testid=include-citations-checkbox]');
    await page.selectOption('[data-testid=template-select]', 'academic');

    await page.click('[data-testid=start-export-button]');

    // Wait for export job to complete
    await expect(page.locator('[data-testid=export-progress]')).toBeVisible();
    await page.waitForSelector('[data-testid=download-ready-notification]', {
      timeout: 60000,
    });

    await page.click('[data-testid=download-export-button]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/.*\.pdf$/);

    // 3. Test Markdown export
    await page.click('[data-testid=export-menu-button]');
    await page.click('[data-testid=export-markdown-option]');

    const markdownDownloadPromise = page.waitForEvent('download');
    await page.click('[data-testid=start-export-button]');
    const markdownDownload = await markdownDownloadPromise;

    expect(markdownDownload.suggestedFilename()).toMatch(/.*\.md$/);

    // 4. Test sharing functionality
    await page.click('[data-testid=share-article-button]');
    await expect(page.locator('[data-testid=share-modal]')).toBeVisible();

    // Generate share link
    await page.selectOption('[data-testid=share-permissions-select]', 'view');
    await page.click('[data-testid=generate-link-button]');

    await expect(page.locator('[data-testid=share-link-input]')).toHaveValue(
      /https:\/\/.*\/shared\/[a-f0-9-]+/
    );

    // Copy link
    await page.click('[data-testid=copy-link-button]');
    await expect(page.locator('[data-testid=link-copied-toast]')).toBeVisible();
  });

  test('Error Handling and Recovery Flow', async ({ page }) => {
    // 1. Test network error handling
    await page.route('**/api/v1/projects', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Internal server error',
        }),
      });
    });

    await page.goto('/projects/new');
    await createTestProject(page);

    // Should show error toast
    await expect(page.locator('[data-testid=error-toast]')).toBeVisible();
    await expect(page.locator('[data-testid=error-toast]')).toContainText(
      'server error'
    );

    // 2. Test retry functionality
    // Fix the network issue
    await page.unroute('**/api/v1/projects');
    await page.click('[data-testid=retry-button]');

    // Should succeed on retry
    await expect(page).toHaveURL(/\/projects\/[a-f0-9-]+$/);

    // 3. Test validation errors
    await page.goto('/projects/new');
    await page.click('[data-testid=create-project-button]'); // Submit empty form

    await expect(page.locator('[data-testid=title-error]')).toBeVisible();
    await expect(page.locator('[data-testid=topic-error]')).toBeVisible();

    // 4. Test API key validation
    await page.goto('/settings/api-keys');
    await page.fill('[data-testid=openai-key-input]', 'invalid-key');
    await page.click('[data-testid=validate-keys-button]');

    await expect(
      page.locator('[data-testid=key-validation-error]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid=key-validation-error]')
    ).toContainText('invalid');

    // 5. Test session timeout handling
    await page.route('**/api/v1/**', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Token expired',
        }),
      });
    });

    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(
      page.locator('[data-testid=session-expired-message]')
    ).toBeVisible();
  });

  test('Search and Filter Functionality', async ({ page }) => {
    // Mock multiple projects
    await page.route('**/api/v1/projects*', route => {
      const url = new URL(route.request().url());
      const searchParam = url.searchParams.get('search');
      const statusParam = url.searchParams.get('status');

      const allProjects = [
        {
          id: '1',
          title: 'AI Research Project',
          topic: 'Artificial Intelligence',
          status: 'completed',
        },
        {
          id: '2',
          title: 'Climate Change Analysis',
          topic: 'Environment',
          status: 'draft',
        },
        {
          id: '3',
          title: 'Machine Learning Guide',
          topic: 'Technology',
          status: 'in_progress',
        },
        {
          id: '4',
          title: 'AI Ethics Study',
          topic: 'Artificial Intelligence',
          status: 'completed',
        },
      ];

      let filteredProjects = allProjects;

      if (searchParam) {
        filteredProjects = filteredProjects.filter(
          p =>
            p.title.toLowerCase().includes(searchParam.toLowerCase()) ||
            p.topic.toLowerCase().includes(searchParam.toLowerCase())
        );
      }

      if (statusParam) {
        const statuses = statusParam.split(',');
        filteredProjects = filteredProjects.filter(p =>
          statuses.includes(p.status)
        );
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: filteredProjects,
            total: filteredProjects.length,
            page: 1,
            limit: 10,
            totalPages: 1,
            hasNext: false,
            hasPrevious: false,
          },
        }),
      });
    });

    await page.goto('/dashboard');

    // 1. Test search functionality
    await page.fill('[data-testid=search-input]', 'AI');
    await page.press('[data-testid=search-input]', 'Enter');

    // Should show filtered results
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(2);
    await expect(
      page.locator('[data-testid=project-card]').first()
    ).toContainText('AI Research Project');
    await expect(
      page.locator('[data-testid=project-card]').nth(1)
    ).toContainText('AI Ethics Study');

    // 2. Test status filtering
    await page.click('[data-testid=status-filter-dropdown]');
    await page.check('[data-testid=status-completed-checkbox]');
    await page.click('[data-testid=apply-filters-button]');

    // Should show only completed AI projects
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(2);

    // 3. Test combined search and filter
    await page.fill('[data-testid=search-input]', 'Research');
    await page.press('[data-testid=search-input]', 'Enter');

    await expect(page.locator('[data-testid=project-card]')).toHaveCount(1);
    await expect(
      page.locator('[data-testid=project-card]').first()
    ).toContainText('AI Research Project');

    // 4. Test clear filters
    await page.click('[data-testid=clear-filters-button]');
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(4);

    // 5. Test sorting
    await page.click('[data-testid=sort-dropdown]');
    await page.click('[data-testid=sort-by-title-asc]');

    const firstProject = page.locator('[data-testid=project-card]').first();
    await expect(firstProject).toContainText('AI Ethics Study');
  });

  test('Responsive Design and Accessibility', async ({ page }) => {
    // 1. Test mobile responsiveness
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto('/dashboard');

    // Mobile menu should be visible
    await expect(
      page.locator('[data-testid=mobile-menu-button]')
    ).toBeVisible();
    await expect(page.locator('[data-testid=desktop-sidebar]')).toBeHidden();

    // Open mobile menu
    await page.click('[data-testid=mobile-menu-button]');
    await expect(page.locator('[data-testid=mobile-menu]')).toBeVisible();

    // Projects should stack vertically on mobile
    const projectCards = page.locator('[data-testid=project-card]');
    const firstCard = projectCards.first();
    const secondCard = projectCards.nth(1);

    const firstBox = await firstCard.boundingBox();
    const secondBox = await secondCard.boundingBox();

    // Second card should be below the first (not side by side)
    expect(secondBox!.y).toBeGreaterThan(firstBox!.y + firstBox!.height);

    // 2. Test tablet responsiveness
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    // Sidebar should be collapsible on tablet
    await expect(
      page.locator('[data-testid=collapsible-sidebar]')
    ).toBeVisible();

    // 3. Test keyboard navigation
    await page.setViewportSize({ width: 1280, height: 720 }); // Desktop

    await page.goto('/projects/new');

    // Tab through form elements
    await page.keyboard.press('Tab'); // Title input
    await expect(
      page.locator('[data-testid=project-title-input]')
    ).toBeFocused();

    await page.keyboard.press('Tab'); // Topic input
    await expect(
      page.locator('[data-testid=project-topic-input]')
    ).toBeFocused();

    await page.keyboard.press('Tab'); // Description textarea
    await expect(
      page.locator('[data-testid=project-description-input]')
    ).toBeFocused();

    // 4. Test screen reader accessibility
    // Check for proper ARIA labels and roles
    await expect(
      page.locator('[data-testid=project-title-input]')
    ).toHaveAttribute('aria-label');
    await expect(
      page.locator('[data-testid=create-project-button]')
    ).toHaveAttribute('aria-describedby');

    // Form validation should be announced
    await page.click('[data-testid=create-project-button]'); // Submit empty form
    await expect(page.locator('[data-testid=title-error]')).toHaveAttribute(
      'role',
      'alert'
    );

    // 5. Test high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('body')).toHaveClass(/dark/);

    // Check that interactive elements are still visible in dark mode
    await expect(
      page.locator('[data-testid=create-project-button]')
    ).toBeVisible();

    // 6. Test focus indicators
    await page.keyboard.press('Tab');
    const focusedElement = await page.locator(':focus');
    await expect(focusedElement).toHaveCSS('outline-style', 'solid');
  });
});

test.describe('Performance and Load Testing', () => {
  test('Large Dataset Handling', async ({ page }) => {
    // Mock large dataset
    const largeProjectList = Array.from({ length: 100 }, (_, i) => ({
      id: `project-${i}`,
      title: `Project ${i}`,
      topic: `Topic ${i % 10}`,
      status: ['draft', 'in_progress', 'completed'][i % 3],
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    }));

    await page.route('**/api/v1/projects*', route => {
      const url = new URL(route.request().url());
      const page_param = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const start = (page_param - 1) * limit;
      const end = start + limit;

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            items: largeProjectList.slice(start, end),
            total: largeProjectList.length,
            page: page_param,
            limit,
            totalPages: Math.ceil(largeProjectList.length / limit),
            hasNext: end < largeProjectList.length,
            hasPrevious: page_param > 1,
          },
        }),
      });
    });

    await page.goto('/dashboard');

    // 1. Test initial load performance
    const startTime = Date.now();
    await expect(page.locator('[data-testid=projects-grid]')).toBeVisible();
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(3000); // Should load within 3 seconds

    // 2. Test pagination performance
    await page.click('[data-testid=next-page-button]');
    await expect(page.locator('[data-testid=page-indicator]')).toContainText(
      'Page 2'
    );

    // 3. Test search performance with large dataset
    const searchStartTime = Date.now();
    await page.fill('[data-testid=search-input]', 'Project 5');
    await page.press('[data-testid=search-input]', 'Enter');
    await expect(page.locator('[data-testid=project-card]')).toHaveCount(11); // Project 5, 15, 25, etc.
    const searchTime = Date.now() - searchStartTime;

    expect(searchTime).toBeLessThan(2000); // Search should complete within 2 seconds

    // 4. Test virtual scrolling (if implemented)
    await page.goto('/dashboard?view=list');

    // Scroll to bottom and verify new items load
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    const itemCount = await page
      .locator('[data-testid=project-list-item]')
      .count();
    expect(itemCount).toBeGreaterThan(20); // More items should have loaded
  });

  test('Memory Usage and Resource Cleanup', async ({ page }) => {
    // Monitor memory usage during intensive operations
    await page.goto('/dashboard');

    // Simulate creating and deleting multiple projects rapidly
    for (let i = 0; i < 5; i++) {
      await page.click('[data-testid=create-project-button]');
      await page.fill(
        '[data-testid=project-title-input]',
        `Memory Test Project ${i}`
      );
      await page.fill('[data-testid=project-topic-input]', `Test Topic ${i}`);
      await page.click('[data-testid=create-project-button]');

      // Wait for creation and then delete
      await page.waitForSelector('[data-testid=project-actions-menu]');
      await page.click('[data-testid=project-actions-menu]');
      await page.click('[data-testid=delete-project-action]');
      await page.click('[data-testid=confirm-delete-button]');

      await page.waitForTimeout(500);
    }

    // Check that the page is still responsive
    await expect(
      page.locator('[data-testid=create-project-button]')
    ).toBeEnabled();

    // Verify no memory leaks by checking WebSocket connections
    const wsConnections = await page.evaluate(() => {
      // Count active WebSocket connections (if accessible)
      return (window as any).__activeWebSockets?.size || 0;
    });

    expect(wsConnections).toBeLessThanOrEqual(2); // Should have minimal active connections
  });
});
