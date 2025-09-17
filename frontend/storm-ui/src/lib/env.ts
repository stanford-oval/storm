/**
 * Environment variable configuration
 * This file ensures environment variables are properly loaded
 */

// Server-side environment variables (available everywhere)
export const env = {
  // API URLs
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws',

  // LLM API Keys
  OPENAI_API_KEY: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  ANTHROPIC_API_KEY: process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '',
  AZURE_API_KEY: process.env.NEXT_PUBLIC_AZURE_API_KEY || '',
  GOOGLE_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
  GROQ_API_KEY: process.env.NEXT_PUBLIC_GROQ_API_KEY || '',

  // Search/Retriever API Keys
  TAVILY_API_KEY: process.env.NEXT_PUBLIC_TAVILY_API_KEY || '',
  GOOGLE_SEARCH_API_KEY: process.env.NEXT_PUBLIC_GOOGLE_SEARCH_API_KEY || '',
  GOOGLE_CSE_ID: process.env.NEXT_PUBLIC_GOOGLE_CSE_ID || '',
  SERPER_API_KEY: process.env.NEXT_PUBLIC_SERPER_API_KEY || '',
  YDC_API_KEY: process.env.NEXT_PUBLIC_YDC_API_KEY || '',
  BING_SEARCH_API_KEY: process.env.NEXT_PUBLIC_BING_SEARCH_API_KEY || '',
  BRAVE_API_KEY: process.env.NEXT_PUBLIC_BRAVE_API_KEY || '',

  // Feature flags
  USE_DUCKDUCKGO: process.env.NEXT_PUBLIC_USE_DUCKDUCKGO === 'true',
  ENABLE_DEBUG_MODE: process.env.NEXT_PUBLIC_ENABLE_DEBUG_MODE === 'true',

  // Defaults
  DEFAULT_LLM_PROVIDER:
    process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER || 'openai',
  DEFAULT_LLM_MODEL: process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || 'gpt-4o',
  DEFAULT_RETRIEVER_TYPE:
    process.env.NEXT_PUBLIC_DEFAULT_RETRIEVER_TYPE || 'tavily',
  DEFAULT_TEMPERATURE: parseFloat(
    process.env.NEXT_PUBLIC_DEFAULT_TEMPERATURE || '0.7'
  ),
  DEFAULT_MAX_TOKENS: parseInt(
    process.env.NEXT_PUBLIC_DEFAULT_MAX_TOKENS || '4000',
    10
  ),
  DEFAULT_MAX_SEARCH_RESULTS: parseInt(
    process.env.NEXT_PUBLIC_DEFAULT_MAX_SEARCH_RESULTS || '10',
    10
  ),
} as const;

// Debug function to log what's loaded
export const debugEnv = () => {
  if (typeof window !== 'undefined') {
    console.group('🌍 Environment Variables');
    console.log('API_URL:', env.API_URL);
    console.log('Has OpenAI Key:', !!env.OPENAI_API_KEY);
    console.log('Has Anthropic Key:', !!env.ANTHROPIC_API_KEY);
    console.log('Has Tavily Key:', !!env.TAVILY_API_KEY);
    console.log('Has Google Search Key:', !!env.GOOGLE_SEARCH_API_KEY);
    console.log('Default LLM:', env.DEFAULT_LLM_PROVIDER);
    console.log('Default Retriever:', env.DEFAULT_RETRIEVER_TYPE);
    console.groupEnd();
  }
};

// Auto-run debug in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugEnv = debugEnv;
}
