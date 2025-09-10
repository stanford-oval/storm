import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

// Configure MSW for browser environment
export const worker = setupWorker(...handlers);

// Enable API mocking in development
export async function enableMocking() {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  try {
    await worker.start({
      onUnhandledRequest: 'warn',
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
    });
    console.log('🔧 API mocking enabled for development');
  } catch (error) {
    console.error('Failed to start MSW worker:', error);
  }
}

export async function disableMocking() {
  if (worker) {
    worker.stop();
    console.log('🔧 API mocking disabled');
  }
}

// Helper to update mock responses dynamically
export function updateHandler(newHandler: any) {
  worker.use(newHandler);
}

// Helper to reset all handlers
export function resetHandlers() {
  worker.resetHandlers(...handlers);
}
