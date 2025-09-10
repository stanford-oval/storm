import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Configure MSW for Node.js environment (testing)
export const server = setupServer(...handlers);

// Server configuration for testing
export function setupMockServer() {
  // Start server before all tests
  beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
  });

  // Reset handlers after each test
  afterEach(() => {
    server.resetHandlers();
  });

  // Clean up after all tests
  afterAll(() => {
    server.close();
  });
}

// Export for manual setup if needed
export { server as mockServer };
