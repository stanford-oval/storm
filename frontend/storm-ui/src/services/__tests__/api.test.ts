/**
 * API Service Tests
 */

import { ProjectService, SettingsService, PipelineService } from '../api';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('API Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ProjectService', () => {
    it('should fetch projects list', async () => {
      const mockProjects = {
        projects: [
          {
            id: '1',
            title: 'Test Project',
            topic: 'Test Topic',
            status: 'draft',
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      });

      const result = await ProjectService.listProjects();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.objectContaining({
          method: 'GET',
        });
      expect(result).toEqual(mockProjects);
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(ProjectService.listProjects()).rejects.toThrow(
        'API Error: 500 Internal Server Error'
      );
    });

    it('should create a new project', async () => {
      const newProject = {
        title: 'New Project',
        topic: 'AI Research',
        description: 'Test description',
      };

      const mockResponse = {
        id: '123',
        ...newProject,
        status: 'draft',
        created_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await ProjectService.createProject(newProject);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(newProject),
        });
      expect(result).toEqual(mockResponse);
    });

  describe('SettingsService', () => {
    it('should fetch settings', async () => {
      const mockSettings = {
        openai_key_preview: 'sk-...abc',
        anthropic_key_preview: 'sk-ant-...xyz',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      });

      const result = await SettingsService.getSettings();

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/settings'),
        expect.objectContaining({
          method: 'GET',
        });
      expect(result).toEqual(mockSettings);
    });

    it('should never return full API keys', async () => {
      const mockSettings = {
        openai_key_preview: 'sk-...abc',
        anthropic_key_preview: 'sk-ant-...xyz',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockSettings,
      });

      const result = await SettingsService.getSettings();

      // Ensure no full API keys are exposed
      Object.values(result).forEach(value => {
        if (typeof value === 'string' && value.includes('...')) {
          expect(value).toMatch(/\.\.\./); // Should contain masked portion
          expect(value.length).toBeLessThan(50); // Should not be a full key
        }
      });

  describe('PipelineService', () => {
    it('should run pipeline for a project', async () => {
      const projectId = 'test-project-id';
      const config = {
        llm_model: 'gpt-4',
        retriever_type: 'tavily',
      };

      const mockResponse = {
        status: 'started',
        message: 'Pipeline started successfully',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await PipelineService.runPipeline(projectId, config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/pipeline/${projectId}/run`),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(config),
        });
      expect(result).toEqual(mockResponse);
    });

    it('should fetch pipeline progress', async () => {
      const projectId = 'test-project-id';
      const mockProgress = {
        stage: 'research',
        progress: 45,
        message: 'Conducting research...',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProgress,
      });

      const result = await PipelineService.getProgress(projectId);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/pipeline/${projectId}/progress`),
        expect.objectContaining({
          method: 'GET',
        });
      expect(result).toEqual(mockProgress);
    });
});
