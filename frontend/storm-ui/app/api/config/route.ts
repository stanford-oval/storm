import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/utils/logger';

// API Configuration endpoint for frontend-backend connection
// This provides configuration info and health checks for the STORM API

export async function GET(_request: NextRequest) {
  try {
    const backendUrl = process.env.STORM_API_URL || 'http://localhost:8000';

    // Test backend connectivity
    const healthCheck = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(() => null);

    const isBackendHealthy = healthCheck?.ok || false;
    const backendVersion =
      healthCheck?.headers.get('X-STORM-Version') || 'unknown';

    const config = {
      backend: {
        url: backendUrl,
        healthy: isBackendHealthy,
        version: backendVersion,
      },
      frontend: {
        version: process.env.npm_package_version || '1.0.0',
        buildTime: process.env.BUILD_TIME || new Date().toISOString(),
      },
      features: {
        storm: true,
        coStorm: process.env.NEXT_PUBLIC_ENABLE_CO_STORM === 'true',
        analytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
        vectorSearch: process.env.NEXT_PUBLIC_ENABLE_VECTOR_SEARCH === 'true',
      },
      defaults: {
        llm: {
          provider: process.env.NEXT_PUBLIC_DEFAULT_LLM_PROVIDER || 'openai',
          model: process.env.NEXT_PUBLIC_DEFAULT_LLM_MODEL || 'gpt-4',
        },
        retriever: {
          type: process.env.NEXT_PUBLIC_DEFAULT_RETRIEVER || 'bing',
        },
      },
    };

    return NextResponse.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Config API error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load configuration',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'test_connection': {
        const { url } = params;
        const backendUrl =
          url || process.env.STORM_API_URL || 'http://localhost:8000';

        try {
          const response = await fetch(`${backendUrl}/health`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Add timeout
            signal: AbortSignal.timeout(10000), // 10 second timeout
          });

          if (!response.ok) {
            throw new Error(`Backend responded with status ${response.status}`);
          }

          const health = await response.json();

          return NextResponse.json({
            success: true,
            data: {
              connected: true,
              url: backendUrl,
              version: response.headers.get('X-STORM-Version') || 'unknown',
              health,
            },
          });
        } catch (error) {
          return NextResponse.json({
            success: false,
            error: `Failed to connect to backend: ${error instanceof Error ? error.message : 'Unknown error'}`,
            data: {
              connected: false,
              url: backendUrl,
            },
          });
        }
      }

      case 'validate_api_keys': {
        const { keys } = params;
        const validationResults: Record<
          string,
          { valid: boolean; error?: string }
        > = {};

        // Validate OpenAI API Key
        if (keys.openai) {
          try {
            const response = await fetch('https://api.openai.com/v1/models', {
              headers: {
                Authorization: `Bearer ${keys.openai}`,
                'Content-Type': 'application/json',
              },
              signal: AbortSignal.timeout(10000),
            });

            validationResults.openai = {
              valid: response.ok,
              error: response.ok
                ? undefined
                : 'Invalid API key or network error',
            };
          } catch (error) {
            validationResults.openai = {
              valid: false,
              error: error instanceof Error ? error.message : 'Network error',
            };
          }
        }

        // Validate Anthropic API Key
        if (keys.anthropic) {
          try {
            const response = await fetch(
              'https://api.anthropic.com/v1/messages',
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${keys.anthropic}`,
                  'Content-Type': 'application/json',
                  'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                  model: 'claude-3-sonnet-20240229',
                  max_tokens: 1,
                  messages: [{ role: 'user', content: 'test' }],
                }),
                signal: AbortSignal.timeout(10000),
              }
            );

            // Anthropic returns 400 for invalid requests but 401 for auth issues
            validationResults.anthropic = {
              valid: response.status !== 401,
              error: response.status === 401 ? 'Invalid API key' : undefined,
            };
          } catch (error) {
            validationResults.anthropic = {
              valid: false,
              error: error instanceof Error ? error.message : 'Network error',
            };
          }
        }

        return NextResponse.json({
          success: true,
          data: validationResults,
        });
      }

      case 'get_supported_models': {
        const { provider } = params;

        // Return supported models for different providers
        const supportedModels: Record<string, string[]> = {
          openai: [
            'gpt-4',
            'gpt-4-turbo',
            'gpt-3.5-turbo',
            'gpt-3.5-turbo-16k',
          ],
          anthropic: [
            'claude-3-opus-20240229',
            'claude-3-sonnet-20240229',
            'claude-3-haiku-20240307',
          ],
          azure: ['gpt-4', 'gpt-4-32k', 'gpt-35-turbo', 'gpt-35-turbo-16k'],
          ollama: ['llama2', 'codellama', 'mistral', 'neural-chat'],
          groq: ['llama2-70b-4096', 'mixtral-8x7b-32768', 'gemma-7b-it'],
        };

        return NextResponse.json({
          success: true,
          data: {
            models: supportedModels[provider] || [],
          },
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Unknown action',
          },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Config API POST error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // This would typically save configuration to a database or file
    // For now, we just validate the configuration structure

    const requiredFields = ['llm', 'retriever', 'pipeline'];
    const missingFields = requiredFields.filter(field => !(field in body));

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate LLM configuration
    if (!body.llm.provider || !body.llm.model) {
      return NextResponse.json(
        {
          success: false,
          error: 'LLM configuration must include provider and model',
        },
        { status: 400 }
      );
    }

    // Validate retriever configuration
    if (!body.retriever.type) {
      return NextResponse.json(
        {
          success: false,
          error: 'Retriever configuration must include type',
        },
        { status: 400 }
      );
    }

    // In a real implementation, you would save this configuration
    // For now, just return success

    return NextResponse.json({
      success: true,
      message: 'Configuration saved successfully',
      data: body,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Config API PUT error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
