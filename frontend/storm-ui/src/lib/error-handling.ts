/**
 * Enhanced error handling utilities for API services
 */

export interface EnhancedError extends Error {
  originalError?: any;
  operation?: string;
  status?: number;
  code?: string;
  context?: Record<string, any>;
  timestamp: Date;
  retryable: boolean;
  userMessage: string;
}

export class ApiErrorHandler {
  /**
   * Enhance an error with additional context and user-friendly messaging
   */
  static enhance(
    error: any,
    operation: string,
    context?: Record<string, any>
  ): EnhancedError {
    const message = error?.message || 'Unknown error occurred';
    const status = error?.status || error?.response?.status;
    const code = error?.code || error?.response?.data?.code;

    const enhancedError: EnhancedError = new Error(message) as EnhancedError;
    enhancedError.originalError = error;
    enhancedError.operation = operation;
    enhancedError.status = status;
    enhancedError.code = code;
    enhancedError.context = context;
    enhancedError.timestamp = new Date();
    enhancedError.retryable = this.isRetryable(error);
    enhancedError.userMessage = this.getUserMessage(status, operation, code);

    return enhancedError;
  }

  /**
   * Determine if an error is retryable
   */
  static isRetryable(error: any): boolean {
    const status = error?.status || error?.response?.status;
    const code = error?.code;

    // Network errors are generally retryable
    if (!status && (code === 'NETWORK_ERROR' || code === 'ECONNABORTED')) {
      return true;
    }

    // 5xx server errors are retryable
    if (status >= 500 && status < 600) {
      return true;
    }

    // Rate limit errors are retryable
    if (status === 429) {
      return true;
    }

    // Timeout errors are retryable
    if (code === 'ECONNABORTED') {
      return true;
    }

    return false;
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(
    status: number | undefined,
    operation: string,
    code?: string
  ): string {
    if (!status) {
      if (code === 'NETWORK_ERROR') {
        return 'Network connection failed. Please check your internet connection and try again.';
      }
      if (code === 'ECONNABORTED') {
        return 'Request timed out. Please try again.';
      }
      return `Failed to ${operation.toLowerCase()}. Please try again.`;
    }

    switch (status) {
      case 400:
        return `Invalid request. Please check your input and try again.`;
      case 401:
        return 'You need to log in to perform this action.';
      case 403:
        return `You don't have permission to ${operation.toLowerCase()}.`;
      case 404:
        return 'The requested resource was not found. It may have been deleted or moved.';
      case 409:
        return `The ${operation.toLowerCase()} failed due to a conflict. Please refresh and try again.`;
      case 422:
        return 'The data provided is invalid. Please check your input.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'A server error occurred. Please try again in a few moments.';
      case 502:
        return 'The service is temporarily unavailable. Please try again later.';
      case 503:
        return 'The service is currently under maintenance. Please try again later.';
      case 504:
        return 'The request took too long to complete. Please try again.';
      default:
        return `Failed to ${operation.toLowerCase()}. Please try again or contact support.`;
    }
  }

  /**
   * Log error with appropriate level
   */
  static log(error: EnhancedError): void {
    const logData = {
      operation: error.operation,
      status: error.status,
      code: error.code,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp,
      retryable: error.retryable,
      originalError: error.originalError,
    };

    if (error.status && error.status >= 500) {
      console.error('🚨 Server Error:', logData);
    } else if (error.status && error.status >= 400) {
      console.warn('⚠️  Client Error:', logData);
    } else {
      console.error('❌ Network/Unknown Error:', logData);
    }
  }

  /**
   * Handle error with automatic retry logic
   */
  static async handleWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    options: {
      maxRetries?: number;
      retryDelay?: number;
      context?: Record<string, any>;
      onRetry?: (attempt: number, error: EnhancedError) => void;
    } = {}
  ): Promise<T> {
    const { maxRetries = 3, retryDelay = 1000, context, onRetry } = options;
    let lastError: EnhancedError | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        const enhancedError = this.enhance(error, operationName, {
          ...context,
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
        });

        lastError = enhancedError;
        this.log(enhancedError);

        // Don't retry if it's the last attempt or error is not retryable
        if (attempt === maxRetries || !enhancedError.retryable) {
          break;
        }

        // Call retry callback if provided
        onRetry?.(attempt + 1, enhancedError);

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}

/**
 * Error recovery strategies
 */
export class ErrorRecoveryStrategies {
  /**
   * Recover from authentication errors
   */
  static async handleAuthError(error: EnhancedError): Promise<boolean> {
    if (error.status === 401) {
      // Clear any cached auth tokens
      if (typeof window !== 'undefined') {
        localStorage.removeItem('storm_auth_token');
        sessionStorage.removeItem('storm_auth_token');
      }

      // Could trigger auth flow here
      console.log('Authentication required - redirecting to login');
      return true;
    }
    return false;
  }

  /**
   * Recover from rate limit errors
   */
  static async handleRateLimit(error: EnhancedError): Promise<number> {
    if (error.status === 429) {
      // Extract retry-after header if available
      const retryAfter =
        error.originalError?.response?.headers?.['retry-after'];
      if (retryAfter) {
        return parseInt(retryAfter) * 1000; // Convert to milliseconds
      }

      // Default backoff
      return 60000; // 1 minute
    }
    return 0;
  }

  /**
   * Handle WebSocket connection errors
   */
  static handleWebSocketError(error: any): {
    shouldReconnect: boolean;
    delay: number;
    maxRetries: number;
  } {
    // Default WebSocket recovery strategy
    return {
      shouldReconnect: true,
      delay: 5000,
      maxRetries: 5,
    };
  }
}

/**
 * Error notification utilities
 */
export class ErrorNotifications {
  /**
   * Display error notification to user
   */
  static notify(error: EnhancedError): void {
    // This would integrate with your notification system
    // For now, we'll use console logging
    console.error('User Error Notification:', {
      message: error.userMessage,
      operation: error.operation,
      retryable: error.retryable,
      timestamp: error.timestamp,
    });

    // Example integration with a notification library:
    // toast.error(error.userMessage, {
    //   id: `error-${error.operation}-${error.timestamp.getTime()}`,
    //   duration: error.retryable ? 5000 : 3000,
    //   action: error.retryable ? {
    //     label: 'Retry',
    //     onClick: () => { /* retry logic */ }
    //   } : undefined
    // });
  }

  /**
   * Display success notification after error recovery
   */
  static notifyRecovery(operation: string): void {
    console.log('Recovery Notification:', {
      message: `${operation} completed successfully after retry`,
      timestamp: new Date(),
    });

    // toast.success(`${operation} completed successfully`);
  }
}

/**
 * Utility functions for common error scenarios
 */
export const ErrorUtils = {
  /**
   * Check if error is a network error
   */
  isNetworkError(error: any): boolean {
    return (
      !error.status &&
      (error.code === 'NETWORK_ERROR' ||
        error.code === 'ECONNABORTED' ||
        error.message?.includes('Network Error') ||
        error.message?.includes('fetch'))
    );
  },

  /**
   * Check if error is a validation error
   */
  isValidationError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    return status === 400 || status === 422;
  },

  /**
   * Check if error is a server error
   */
  isServerError(error: any): boolean {
    const status = error?.status || error?.response?.status;
    return status >= 500 && status < 600;
  },

  /**
   * Extract validation errors from API response
   */
  extractValidationErrors(error: any): Record<string, string[]> {
    const data = error?.response?.data || error?.data;
    if (data?.errors && typeof data.errors === 'object') {
      return data.errors;
    }
    if (data?.details?.errors) {
      return data.details.errors;
    }
    return {};
  },

  /**
   * Create a formatted error message for display
   */
  formatForDisplay(error: EnhancedError): string {
    let message = error.userMessage;

    if (error.context?.field) {
      message = `${error.context.field}: ${message}`;
    }

    if (error.retryable) {
      message += ' (This operation can be retried)';
    }

    return message;
  },
};

export default ApiErrorHandler;
