'use client';

import {
  apiConfig,
  getLLMConfig,
  getRetrieverConfig,
} from '@/config/api.config';

export default function TestEnvPage() {
  // Get all environment variables that start with NEXT_PUBLIC_
  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith('NEXT_PUBLIC_'))
    .reduce(
      (acc, key) => {
        const value = process.env[key];
        // Mask sensitive data
        if (key.includes('KEY') || key.includes('TOKEN')) {
          acc[key] = value ? `${value.substring(0, 10)}...` : 'NOT SET';
        } else {
          acc[key] = value || 'NOT SET';
        }
        return acc;
      },
      {} as Record<string, string>
    );

  const openaiConfig = getLLMConfig('openai');
  const anthropicConfig = getLLMConfig('anthropic');
  const tavilyConfig = getRetrieverConfig('tavily');
  const googleConfig = getRetrieverConfig('google');

  return (
    <div className="mx-auto max-w-4xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Environment Variables Test</h1>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">
          Raw Environment Variables
        </h2>
        <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
          {JSON.stringify(envVars, null, 2)}
        </pre>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">API Config</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium">OpenAI Config:</h3>
            <pre className="rounded bg-gray-100 p-2 text-sm">
              {JSON.stringify(openaiConfig, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-medium">Anthropic Config:</h3>
            <pre className="rounded bg-gray-100 p-2 text-sm">
              {JSON.stringify(anthropicConfig, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-medium">Tavily Config:</h3>
            <pre className="rounded bg-gray-100 p-2 text-sm">
              {JSON.stringify(tavilyConfig, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="font-medium">Google Search Config:</h3>
            <pre className="rounded bg-gray-100 p-2 text-sm">
              {JSON.stringify(googleConfig, null, 2)}
            </pre>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-4 text-xl font-semibold">Full API Config</h2>
        <pre className="overflow-auto rounded bg-gray-100 p-4 text-sm">
          {JSON.stringify(apiConfig, null, 2)}
        </pre>
      </div>
    </div>
  );
}
