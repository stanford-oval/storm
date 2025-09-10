// Debug utility to check if API keys are loaded from environment
export const debugApiKeys = () => {
  console.group('🔑 API Keys Debug');

  // Check raw environment variables
  console.log('Raw environment variables:');
  const envKeys = Object.keys(process.env)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .reduce(
      (acc, key) => {
        const value = process.env[key];
        if (key.includes('KEY') || key.includes('TOKEN')) {
          acc[key] = value
            ? `${value.substring(0, 10)}...(${value.length} chars)`
            : 'NOT SET';
        } else {
          acc[key] = value || 'NOT SET';
        }
        return acc;
      },
      {} as Record<string, string>
    );
  console.table(envKeys);

  // Check API config
  const apiConfig = (window as any).__API_CONFIG__;
  if (apiConfig) {
    console.log('\n📦 API Config loaded:');
    console.log('LLM Providers:', Object.keys(apiConfig.llm.providers));
    console.log(
      'Retriever Providers:',
      Object.keys(apiConfig.retrievers.providers)
    );

    // Check specific configs
    const openaiConfig = apiConfig.llm.providers.openai;
    const tavilyConfig = apiConfig.retrievers.providers.tavily;

    console.log(
      '\nOpenAI Config:',
      openaiConfig
        ? {
            ...openaiConfig,
            apiKey: openaiConfig.apiKey
              ? `${openaiConfig.apiKey.substring(0, 10)}...`
              : 'NOT SET',
          }
        : 'NOT CONFIGURED'
    );

    console.log(
      'Tavily Config:',
      tavilyConfig
        ? {
            ...tavilyConfig,
            apiKey: tavilyConfig.apiKey
              ? `${tavilyConfig.apiKey.substring(0, 10)}...`
              : 'NOT SET',
          }
        : 'NOT CONFIGURED'
    );
  } else {
    console.warn('API Config not found in window.__API_CONFIG__');
  }

  console.groupEnd();
};

// Auto-run in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugApiKeys = debugApiKeys;
  console.log('💡 Run debugApiKeys() in console to check API key loading');
}
