import { mapConfigToBackend, mapConfigFromBackend } from '../config-mapper';
import { StormConfig } from '@/types';

describe('Config Mapper', () => {
  describe('mapConfigToBackend', () => {
    it('should map frontend config to backend format', () => {
      const frontendConfig: StormConfig = {
        llm: {
          model: 'gpt-4o',
          provider: 'openai',
          temperature: 0.7,
          maxTokens: 4000,
        },
        retriever: {
          type: 'tavily',
          maxResults: 10,
        },
        pipeline: {
          doResearch: true,
          doGenerateOutline: false,
          doGenerateArticle: true,
          doPolishArticle: true,
          maxConvTurns: 5,
          maxPerspectives: 4,
        },
      };

      const backendConfig = mapConfigToBackend(frontendConfig);

      expect(backendConfig.llm.model).toBe('gpt-4o');
      expect(backendConfig.llm.provider).toBe('openai');
      expect(backendConfig.llm.max_tokens).toBe(4000);
      expect(backendConfig.retriever.retriever_type).toBe('tavily');
      expect(backendConfig.retriever.max_search_results).toBe(10);
      expect(backendConfig.pipeline.do_research).toBe(true);
      expect(backendConfig.pipeline.do_generate_outline).toBe(false);
      expect(backendConfig.pipeline.do_generate_article).toBe(true);
      expect(backendConfig.pipeline.do_polish_article).toBe(true);
      expect(backendConfig.pipeline.max_conv_turn).toBe(5);
      expect(backendConfig.pipeline.max_perspective).toBe(4);
    });

    it('should handle undefined pipeline stages correctly', () => {
      const frontendConfig: StormConfig = {
        llm: {
          model: 'gpt-4o',
          provider: 'openai',
        },
        pipeline: {
          doResearch: false,
          doGenerateOutline: false,
          doGenerateArticle: false,
          doPolishArticle: false,
        },
      };

      const backendConfig = mapConfigToBackend(frontendConfig);

      expect(backendConfig.pipeline.do_research).toBe(false);
      expect(backendConfig.pipeline.do_generate_outline).toBe(false);
      expect(backendConfig.pipeline.do_generate_article).toBe(false);
      expect(backendConfig.pipeline.do_polish_article).toBe(false);
    });
  });

  describe('mapConfigFromBackend', () => {
    it('should map backend config to frontend format', () => {
      const backendConfig = {
        llm: {
          model: 'claude-3-opus',
          provider: 'anthropic',
          temperature: 0.5,
          max_tokens: 8000,
        },
        retriever: {
          retriever_type: 'bing',
          max_search_results: 20,
        },
        pipeline: {
          do_research: true,
          do_generate_outline: true,
          do_generate_article: false,
          do_polish_article: false,
          max_conv_turn: 3,
          max_perspective: 5,
        },
      };

      const frontendConfig = mapConfigFromBackend(backendConfig);

      expect(frontendConfig.llm?.model).toBe('claude-3-opus');
      expect(frontendConfig.llm?.provider).toBe('anthropic');
      expect(frontendConfig.llm?.maxTokens).toBe(8000);
      expect(frontendConfig.retriever?.type).toBe('bing');
      expect(frontendConfig.retriever?.maxResults).toBe(20);
      expect(frontendConfig.pipeline?.doResearch).toBe(true);
      expect(frontendConfig.pipeline?.doGenerateOutline).toBe(true);
      expect(frontendConfig.pipeline?.doGenerateArticle).toBe(false);
      expect(frontendConfig.pipeline?.doPolishArticle).toBe(false);
      expect(frontendConfig.pipeline?.maxConvTurns).toBe(3);
      expect(frontendConfig.pipeline?.maxPerspectives).toBe(5);
    });

    it('should handle null/undefined backend config', () => {
      expect(mapConfigFromBackend(null)).toEqual({});
      expect(mapConfigFromBackend(undefined)).toEqual({});
    });
  });
});