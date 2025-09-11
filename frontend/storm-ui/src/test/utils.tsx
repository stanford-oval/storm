import React from 'react';
import { render, RenderOptions, renderHook } from '@testing-library/react';
// import { ThemeProvider } from 'next-themes'; // TODO: Install next-themes
import { ThemeProvider } from '@/store/contexts/ThemeContext';
// import { axe, toHaveNoViolations } from 'jest-axe'; // TODO: Install jest-axe
// import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // TODO: Install react-query
import { StoreProvider } from '@/store/contexts/StoreProvider';
import { WebSocketContext } from '@/store/contexts/WebSocketContext';
import { ConfigContext } from '@/store/contexts/ConfigContext';
// import WS from 'jest-websocket-mock'; // TODO: Install jest-websocket-mock

// Extend jest matchers
// expect.extend(toHaveNoViolations); // TODO: Uncomment when jest-axe is installed

// Mock WebSocket server
// const mockWebSocketServer = new WS('ws://localhost:8080'); // TODO: Uncomment when jest-websocket-mock is installed

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialStoreState?: any;
  // queryClient?: QueryClient;
  webSocketUrl?: string;
  theme?: string;
}

const AllTheProviders: React.FC<{
  children: React.ReactNode;
  options?: CustomRenderOptions;
}> = ({ children, options = {} }) => {
  const {
    initialStoreState,
    // queryClient = new QueryClient({
    //   defaultOptions: {
    //     queries: { retry: false },
    //     mutations: { retry: false },
    //   },
    // }),
    webSocketUrl = 'ws://localhost:8080',
    theme = 'light',
  } = options;

  const mockWebSocket = {
    connect: jest.fn(),
    disconnect: jest.fn(),
    send: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    readyState: WebSocket.OPEN,
  };

  const mockConfig = {
    apiBaseUrl: 'http://localhost:3000/api',
    wsBaseUrl: webSocketUrl,
    defaultLLM: 'gpt-4o',
    defaultRetriever: 'bing',
  };

  return (
    <ThemeProvider defaultTheme={theme as 'light' | 'dark' | 'system'}>
      <ConfigContext.Provider value={mockConfig}>
        {/* <QueryClientProvider client={queryClient}> */}
        <WebSocketContext.Provider value={mockWebSocket}>
          <StoreProvider initialState={initialStoreState}>
            {children}
          </StoreProvider>
        </WebSocketContext.Provider>
        {/* </QueryClientProvider> */}
      </ConfigContext.Provider>
    </ThemeProvider>
  );
};

const customRender = (ui: React.ReactElement, options?: CustomRenderOptions) =>
  render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders options={options}>{children}</AllTheProviders>
    ),
    ...options,
  });

// Custom hook render function
const customRenderHook = <TProps, TResult>(
  callback: (props: TProps) => TResult,
  options?: RenderHookOptions<TProps> & CustomRenderOptions
) => {
  const {
    initialStoreState,
    queryClient,
    webSocketUrl,
    theme,
    ...hookOptions
  } = options || {};

  return renderHook(callback, {
    wrapper: ({ children }) => (
      <AllTheProviders
        options={{ initialStoreState, queryClient, webSocketUrl, theme }}
      >
        {children}
      </AllTheProviders>
    ),
    ...hookOptions,
  });
};

// Accessibility testing helper
export const runA11yTests = async (component: React.ReactElement) => {
  const { container } = customRender(component);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
  return results;
};

// Performance testing helper
export const measureRenderTime = (renderFn: () => void): number => {
  const startTime = performance.now();
  renderFn();
  const endTime = performance.now();
  return endTime - startTime;
};

// Wait for async operations
export const waitForNextTick = (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

export const waitForWebSocket = (): Promise<void> =>
  new Promise(resolve => {
    const checkConnection = () => {
      if (mockWebSocketServer.connected) {
        resolve();
      } else {
        setTimeout(checkConnection, 10);
      }
    };
    checkConnection();
  });

// Re-export everything
export * from '@testing-library/react';
export * from '@testing-library/user-event';
export { customRender as render };
export { customRenderHook as renderHook };
export { mockWebSocketServer };

// Common test data factories
export const createMockStormProject = (overrides?: any) => ({
  id: 'test-project-1',
  title: 'Test Article',
  topic: 'Test Topic',
  description: 'Test description',
  status: 'draft' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  config: {
    llm: {
      model: 'gpt-4o',
      provider: 'openai' as const,
      apiKey: 'test-key',
      temperature: 0.7,
    },
    retriever: {
      type: 'bing' as const,
      apiKey: 'test-bing-key',
      maxResults: 10,
    },
    pipeline: {
      doResearch: true,
      doGenerateOutline: true,
      doGenerateArticle: true,
      doPolishArticle: true,
    },
  },
  outputDir: '/test/output',
  ...overrides,
});

export const createMockPipelineProgress = (overrides?: any) => ({
  stage: 'research' as const,
  stageProgress: 45,
  overallProgress: 25,
  startTime: new Date('2024-01-01T10:00:00'),
  currentTask: 'Conducting perspective research...',
  errors: [],
  ...overrides,
});

export const createMockArticle = (overrides?: any) => ({
  title: 'Test Article',
  content: '<h1>Test Article</h1><p>This is test content.</p>',
  sections: [
    {
      id: 'section-1',
      title: 'Introduction',
      content: '<p>Introduction content</p>',
      level: 1,
      order: 1,
      citations: ['citation-1'],
    },
  ],
  citations: [
    {
      id: 'citation-1',
      sourceId: 'source-1',
      text: 'Test citation',
      url: 'https://example.com',
    },
  ],
  wordCount: 100,
  lastModified: new Date('2024-01-01'),
  ...overrides,
});

export const createMockOutline = (overrides?: any) => ({
  id: 'outline-1',
  sections: [
    {
      id: 'section-1',
      title: 'Introduction',
      level: 1,
      order: 1,
      isExpanded: true,
    },
    {
      id: 'section-2',
      title: 'Main Content',
      level: 1,
      order: 2,
      isExpanded: true,
    },
  ],
  lastModified: new Date('2024-01-01'),
  ...overrides,
});

export const createMockResearchData = (overrides?: any) => ({
  conversations: [
    {
      id: 'conv-1',
      perspective: 'Academic Researcher',
      turns: [
        {
          id: 'turn-1',
          speaker: 'user' as const,
          content: 'What are the key aspects of this topic?',
          timestamp: new Date('2024-01-01T10:00:00'),
          sources: ['source-1'],
        },
        {
          id: 'turn-2',
          speaker: 'assistant' as const,
          content: 'The key aspects include...',
          timestamp: new Date('2024-01-01T10:01:00'),
        },
      ],
      startTime: new Date('2024-01-01T10:00:00'),
      endTime: new Date('2024-01-01T10:05:00'),
      status: 'completed' as const,
    },
  ],
  sources: [
    {
      id: 'source-1',
      title: 'Test Source',
      url: 'https://example.com/source1',
      snippet: 'This is a test source snippet with relevant information.',
      retrievedAt: new Date('2024-01-01T09:30:00'),
      relevanceScore: 0.85,
    },
  ],
  perspectives: ['Academic Researcher', 'Industry Expert'],
  totalQueries: 5,
  lastUpdated: new Date('2024-01-01T10:05:00'),
  ...overrides,
});
