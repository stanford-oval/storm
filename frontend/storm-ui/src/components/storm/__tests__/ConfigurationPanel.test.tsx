import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@/test/utils';
import { ConfigurationPanel } from '../ConfigurationPanel';
import { StormConfig } from '@/types/storm';
import userEvent from '@testing-library/user-event';
import { runA11yTests } from '@/test/utils';

const mockConfig: StormConfig = {
  llm: {
    model: 'gpt-4o',
    provider: 'openai',
    apiKey: 'test-api-key',
    temperature: 0.7,
    maxTokens: 4000,
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
    maxConvTurns: 5,
    maxPerspectives: 3,
  },
};

describe('ConfigurationPanel', () => {
  const mockOnChange = jest.fn();
  const mockOnSave = jest.fn();
  const mockOnCancel = jest.fn();
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all configuration sections', () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/llm configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/retriever configuration/i)).toBeInTheDocument();
      expect(screen.getByText(/pipeline configuration/i)).toBeInTheDocument();
    });

    it('displays current configuration values', () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue('gpt-4o')).toBeInTheDocument();
      expect(screen.getByDisplayValue('openai')).toBeInTheDocument();
      expect(screen.getByDisplayValue('0.7')).toBeInTheDocument();
      expect(screen.getByDisplayValue('4000')).toBeInTheDocument();
      expect(screen.getByDisplayValue('bing')).toBeInTheDocument();
      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
    });

    it('shows loading state when isLoading is true', () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    });
  });

  describe('LLM Configuration', () => {
    it('updates model selection', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const modelSelect = screen.getByLabelText(/model/i);
      await user.selectOptions(modelSelect, 'gpt-3.5-turbo');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, model: 'gpt-3.5-turbo' },
      });
    });

    it('updates provider selection', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const providerSelect = screen.getByLabelText(/provider/i);
      await user.selectOptions(providerSelect, 'anthropic');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, provider: 'anthropic' },
      });
    });

    it('updates API key with masked input', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const apiKeyInput = screen.getByLabelText(/api key/i);
      expect(apiKeyInput).toHaveAttribute('type', 'password');

      await user.clear(apiKeyInput);
      await user.type(apiKeyInput, 'new-api-key');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, apiKey: 'new-api-key' },
      });
    });

    it('toggles API key visibility', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const apiKeyInput = screen.getByLabelText(/api key/i);
      const toggleButton = screen.getByRole('button', {
        name: /toggle api key visibility/i,
      });

      expect(apiKeyInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(apiKeyInput).toHaveAttribute('type', 'text');

      await user.click(toggleButton);
      expect(apiKeyInput).toHaveAttribute('type', 'password');
    });

    it('updates temperature with slider', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const temperatureSlider = screen.getByLabelText(/temperature/i);
      fireEvent.change(temperatureSlider, { target: { value: '0.5' } });

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, temperature: 0.5 },
      });
    });

    it('updates max tokens', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const maxTokensInput = screen.getByLabelText(/max tokens/i);
      await user.clear(maxTokensInput);
      await user.type(maxTokensInput, '8000');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, maxTokens: 8000 },
      });
    });
  });

  describe('Retriever Configuration', () => {
    it('updates retriever type', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const retrieverSelect = screen.getByLabelText(/retriever type/i);
      await user.selectOptions(retrieverSelect, 'you');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        retriever: { ...mockConfig.retriever, type: 'you' },
      });
    });

    it('updates retriever API key', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const retrieverApiKeyInput = screen.getByLabelText(/retriever api key/i);
      await user.clear(retrieverApiKeyInput);
      await user.type(retrieverApiKeyInput, 'new-retriever-key');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        retriever: { ...mockConfig.retriever, apiKey: 'new-retriever-key' },
      });
    });

    it('updates max results', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const maxResultsInput = screen.getByLabelText(/max results/i);
      await user.clear(maxResultsInput);
      await user.type(maxResultsInput, '20');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        retriever: { ...mockConfig.retriever, maxResults: 20 },
      });
    });

    it('shows different API key field based on retriever type', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Initially shows Bing API key
      expect(screen.getByText(/bing search api key/i)).toBeInTheDocument();

      const retrieverSelect = screen.getByLabelText(/retriever type/i);
      await user.selectOptions(retrieverSelect, 'you');

      // Should now show You.com API key
      expect(screen.getByText(/you\.com api key/i)).toBeInTheDocument();
    });
  });

  describe('Pipeline Configuration', () => {
    it('toggles research step', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const researchToggle = screen.getByLabelText(/do research/i);
      await user.click(researchToggle);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        pipeline: { ...mockConfig.pipeline, doResearch: false },
      });
    });

    it('toggles outline generation step', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const outlineToggle = screen.getByLabelText(/generate outline/i);
      await user.click(outlineToggle);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        pipeline: { ...mockConfig.pipeline, doGenerateOutline: false },
      });
    });

    it('updates max conversation turns', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const maxTurnsInput = screen.getByLabelText(/max conversation turns/i);
      await user.clear(maxTurnsInput);
      await user.type(maxTurnsInput, '10');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        pipeline: { ...mockConfig.pipeline, maxConvTurns: 10 },
      });
    });

    it('updates max perspectives', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const maxPerspectivesInput = screen.getByLabelText(/max perspectives/i);
      await user.clear(maxPerspectivesInput);
      await user.type(maxPerspectivesInput, '5');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        pipeline: { ...mockConfig.pipeline, maxPerspectives: 5 },
      });
    });
  });

  describe('Actions', () => {
    it('saves configuration', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('cancels configuration changes', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('resets to defaults', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const resetButton = screen.getByRole('button', {
        name: /reset to defaults/i,
      });
      await user.click(resetButton);

      expect(mockOnChange).toHaveBeenCalledWith({
        llm: {
          model: 'gpt-4o',
          provider: 'openai',
          temperature: 0.7,
        },
        retriever: {
          type: 'bing',
          maxResults: 10,
        },
        pipeline: {
          doResearch: true,
          doGenerateOutline: true,
          doGenerateArticle: true,
          doPolishArticle: true,
          maxConvTurns: 3,
          maxPerspectives: 4,
        },
      });
    });

    it('imports configuration from file', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const importButton = screen.getByRole('button', {
        name: /import config/i,
      });
      const fileInput = screen.getByLabelText(/import configuration file/i);

      const file = new File(
        [
          JSON.stringify({
            llm: { model: 'gpt-3.5-turbo', provider: 'openai' },
            retriever: { type: 'you' },
            pipeline: { doResearch: false },
          }),
        ],
        'config.json',
        { type: 'application/json' }
      );

      await user.upload(fileInput, file);

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, model: 'gpt-3.5-turbo' },
        retriever: { ...mockConfig.retriever, type: 'you' },
        pipeline: { ...mockConfig.pipeline, doResearch: false },
      });
    });

    it('exports configuration to file', async () => {
      // Mock URL.createObjectURL
      global.URL.createObjectURL = jest.fn(() => 'blob:url');
      global.URL.revokeObjectURL = jest.fn();

      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const exportButton = screen.getByRole('button', {
        name: /export config/i,
      });
      await user.click(exportButton);

      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('validates required API keys', async () => {
      const invalidConfig = {
        ...mockConfig,
        llm: { ...mockConfig.llm, apiKey: '' },
      };

      render(
        <ConfigurationPanel
          config={invalidConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(screen.getByText(/api key is required/i)).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('validates temperature range', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const temperatureInput = screen.getByLabelText(/temperature/i);
      fireEvent.change(temperatureInput, { target: { value: '2.0' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(
        screen.getByText(/temperature must be between 0 and 1/i)
      ).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('validates max tokens range', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const maxTokensInput = screen.getByLabelText(/max tokens/i);
      await user.clear(maxTokensInput);
      await user.type(maxTokensInput, '100000');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(screen.getByText(/max tokens cannot exceed/i)).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('validates max results is positive', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const maxResultsInput = screen.getByLabelText(/max results/i);
      await user.clear(maxResultsInput);
      await user.type(maxResultsInput, '-5');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(
        screen.getByText(/must be a positive number/i)
      ).toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('Configuration Presets', () => {
    it('loads quick research preset', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const presetSelect = screen.getByLabelText(/configuration preset/i);
      await user.selectOptions(presetSelect, 'quick-research');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          llm: expect.objectContaining({
            model: 'gpt-3.5-turbo',
            temperature: 0.3,
          }),
          pipeline: expect.objectContaining({
            maxConvTurns: 2,
            maxPerspectives: 2,
          }),
        })
      );
    });

    it('loads comprehensive preset', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const presetSelect = screen.getByLabelText(/configuration preset/i);
      await user.selectOptions(presetSelect, 'comprehensive');

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          llm: expect.objectContaining({
            model: 'gpt-4o',
            temperature: 0.7,
          }),
          pipeline: expect.objectContaining({
            maxConvTurns: 6,
            maxPerspectives: 5,
          }),
        })
      );
    });
  });

  describe('Advanced Settings', () => {
    it('toggles advanced settings panel', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.queryByText(/base url/i)).not.toBeInTheDocument();

      const advancedToggle = screen.getByText(/advanced settings/i);
      await user.click(advancedToggle);

      expect(screen.getByText(/base url/i)).toBeInTheDocument();
    });

    it('updates base URL in advanced settings', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const advancedToggle = screen.getByText(/advanced settings/i);
      await user.click(advancedToggle);

      const baseUrlInput = screen.getByLabelText(/base url/i);
      await user.type(baseUrlInput, 'https://custom-api.example.com');

      expect(mockOnChange).toHaveBeenCalledWith({
        ...mockConfig,
        llm: { ...mockConfig.llm, baseUrl: 'https://custom-api.example.com' },
      });
    });
  });

  describe('Accessibility', () => {
    it('meets accessibility standards', async () => {
      const component = (
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await runA11yTests(component);
    });

    it('has proper form labels', () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByLabelText(/model/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/provider/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/temperature/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/retriever type/i)).toBeInTheDocument();
    });

    it('provides helpful descriptions', () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      expect(
        screen.getByText(/controls randomness of responses/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/maximum tokens in response/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/number of search results/i)).toBeInTheDocument();
    });
  });

  describe('Keyboard Navigation', () => {
    it('supports tab navigation through form', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      // Tab through form elements
      await user.tab();
      expect(screen.getByLabelText(/preset/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/model/i)).toHaveFocus();

      await user.tab();
      expect(screen.getByLabelText(/provider/i)).toHaveFocus();
    });

    it('saves with Enter on save button', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      saveButton.focus();
      await user.keyboard('{Enter}');

      expect(mockOnSave).toHaveBeenCalled();
    });

    it('cancels with Escape', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      await user.keyboard('{Escape}');
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('handles invalid JSON import gracefully', async () => {
      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSave}
          onCancel={mockOnCancel}
        />
      );

      const fileInput = screen.getByLabelText(/import configuration file/i);
      const invalidFile = new File(['invalid json content'], 'config.json', {
        type: 'application/json',
      });

      await user.upload(fileInput, invalidFile);

      expect(
        screen.getByText(/invalid configuration file/i)
      ).toBeInTheDocument();
      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('shows network error message', async () => {
      const mockOnSaveError = jest.fn(() => {
        throw new Error('Network error');
      });

      render(
        <ConfigurationPanel
          config={mockConfig}
          onChange={mockOnChange}
          onSave={mockOnSaveError}
          onCancel={mockOnCancel}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(
        screen.getByText(/failed to save configuration/i)
      ).toBeInTheDocument();
    });
  });
});
