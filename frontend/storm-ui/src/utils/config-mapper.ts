/**
 * Utility functions to map between frontend and backend configuration formats
 */

import { StormConfig } from '@/types';

/**
 * Map frontend configuration to backend format
 */
export function mapConfigToBackend(config: StormConfig): any {
  return {
    config_version: '1.0.0',
    llm: {
      provider: config.llm?.provider || 'openai',
      model: config.llm?.model || 'gpt-4o',
      temperature: config.llm?.temperature || 0.7,
      max_tokens: config.llm?.maxTokens || 4000,
      top_p: config.llm?.topP || 1.0,
      frequency_penalty: config.llm?.frequencyPenalty || 0,
      presence_penalty: config.llm?.presencePenalty || 0,
      api_key: config.llm?.apiKey,
      api_base: config.llm?.baseUrl,
      api_version: config.llm?.apiVersion,
      deployment_name: config.llm?.deploymentName,
      // Ollama-specific
      ollama_host: config.llm?.ollamaHost,
      ollama_port: config.llm?.ollamaPort,
      stop_sequences: config.llm?.stopSequences,
    },
    retriever: {
      retriever_type: config.retriever?.type || 'duckduckgo',
      max_search_results: config.retriever?.maxResults || 10,
      search_top_k: config.retriever?.searchTopK || 3,
      min_relevance_score: config.retriever?.minRelevanceScore || 0.0,
      enable_reranking: config.retriever?.enableReranking || false,
      reranking_model: config.retriever?.rerankingModel,
      api_key: config.retriever?.apiKey,
    },
    pipeline: {
      do_research: config.pipeline?.doResearch ?? true, // Default true if undefined
      do_generate_outline: config.pipeline?.doGenerateOutline ?? true, // Default true if undefined
      do_generate_article: config.pipeline?.doGenerateArticle ?? true, // Default true if undefined
      do_polish_article: config.pipeline?.doPolishArticle ?? true, // Default true if undefined
      max_conv_turn: config.pipeline?.maxConvTurns || 3,
      max_perspective: config.pipeline?.maxPerspectives || 4,
      max_search_queries_per_turn: config.pipeline?.searchQueriesPerTurn || 3,
      disable_perspective: config.pipeline?.disablePerspective || false,
      include_figures: config.pipeline?.includeFigures || false,
      include_references: config.pipeline?.includeReferences || true,
    },
  };
}

/**
 * Map backend configuration to frontend format
 */
export function mapConfigFromBackend(backendConfig: any): StormConfig {
  if (!backendConfig) {
    return {};
  }

  // Check if this is the old flat format (has top-level llm_provider or do_research)
  if (backendConfig.llm_provider || (backendConfig.do_research !== undefined && !backendConfig.pipeline)) {
    // Old flat format
    return {
      llm: {
        model: backendConfig.llm_model || 'gpt-4o',
        provider: backendConfig.llm_provider || 'openai',
        temperature: backendConfig.temperature ?? 0.7,
        maxTokens: backendConfig.max_tokens || 4000,
      },
      retriever: {
        type: backendConfig.retriever_type || 'tavily',
        maxResults: backendConfig.max_search_results || 10,
        searchTopK: backendConfig.search_top_k || 3,
      },
      pipeline: {
        doResearch: backendConfig.do_research ?? true,
        doGenerateOutline: backendConfig.do_generate_outline ?? true,
        doGenerateArticle: backendConfig.do_generate_article ?? true,
        doPolishArticle: backendConfig.do_polish_article ?? true,
        maxConvTurns: backendConfig.max_conv_turn || 3,
        maxPerspectives: backendConfig.max_perspective || 4,
        searchQueriesPerTurn: backendConfig.max_search_queries_per_turn || 3,
      },
    };
  }

  // New nested format
  return {
    llm: backendConfig.llm ? {
      model: backendConfig.llm.model,
      provider: backendConfig.llm.provider,
      temperature: backendConfig.llm.temperature,
      maxTokens: backendConfig.llm.max_tokens,
      topP: backendConfig.llm.top_p,
      frequencyPenalty: backendConfig.llm.frequency_penalty,
      presencePenalty: backendConfig.llm.presence_penalty,
      apiKey: backendConfig.llm.api_key,
      baseUrl: backendConfig.llm.api_base,
      apiVersion: backendConfig.llm.api_version,
      deploymentName: backendConfig.llm.deployment_name,
      ollamaHost: backendConfig.llm.ollama_host,
      ollamaPort: backendConfig.llm.ollama_port,
      stopSequences: backendConfig.llm.stop_sequences,
    } : undefined,
    retriever: backendConfig.retriever ? {
      type: backendConfig.retriever.retriever_type,
      maxResults: backendConfig.retriever.max_search_results,
      searchTopK: backendConfig.retriever.search_top_k,
      minRelevanceScore: backendConfig.retriever.min_relevance_score,
      enableReranking: backendConfig.retriever.enable_reranking,
      rerankingModel: backendConfig.retriever.reranking_model,
      apiKey: backendConfig.retriever.api_key,
    } : undefined,
    pipeline: backendConfig.pipeline ? {
      doResearch: backendConfig.pipeline.do_research,
      doGenerateOutline: backendConfig.pipeline.do_generate_outline,
      doGenerateArticle: backendConfig.pipeline.do_generate_article,
      doPolishArticle: backendConfig.pipeline.do_polish_article,
      maxConvTurns: backendConfig.pipeline.max_conv_turn,
      maxPerspectives: backendConfig.pipeline.max_perspective,
      searchQueriesPerTurn: backendConfig.pipeline.search_queries_per_turn || backendConfig.pipeline.max_search_queries_per_turn,
      disablePerspective: backendConfig.pipeline.disable_perspective,
      includeFigures: backendConfig.pipeline.include_figures,
      includeReferences: backendConfig.pipeline.include_references,
    } : undefined,
  };
}