// Action creators and utilities
import { Draft } from 'immer';

// Action creator type
export type ActionCreator<TPayload = void> = TPayload extends void
  ? () => void
  : (payload: TPayload) => void;

// Async action creator type
export type AsyncActionCreator<
  TPayload = void,
  TReturn = void,
> = TPayload extends void
  ? () => Promise<TReturn>
  : (payload: TPayload) => Promise<TReturn>;

// Action with metadata
export interface ActionWithMeta<TPayload = any, TMeta = any> {
  payload: TPayload;
  meta?: TMeta;
  error?: boolean;
}

// Create action creator
export const createAction = <TPayload = void>(
  type: string
): ActionCreator<TPayload> => {
  const actionCreator = (payload?: TPayload) => {
    return {
      type,
      payload,
    };
  };

  actionCreator.type = type;
  actionCreator.toString = () => type;

  return actionCreator as any;
};

// Create async action creator
export const createAsyncAction = <TPayload = void, TReturn = void>(
  type: string,
  asyncFn: (payload: TPayload) => Promise<TReturn>
): AsyncActionCreator<TPayload, TReturn> => {
  const actionCreator = async (payload?: TPayload) => {
    return asyncFn(payload as TPayload);
  };

  actionCreator.type = type;
  actionCreator.toString = () => type;

  return actionCreator as any;
};

// Create action with metadata
export const createActionWithMeta =
  <TPayload = void, TMeta = any>(type: string) =>
  (payload: TPayload, meta?: TMeta): ActionWithMeta<TPayload, TMeta> => ({
    payload,
    meta,
    error: false,
  });

// Create error action
export const createErrorAction =
  <TPayload = Error>(type: string) =>
  (payload: TPayload, meta?: any): ActionWithMeta<TPayload> => ({
    payload,
    meta,
    error: true,
  });

// Optimistic update utilities
export interface OptimisticUpdate<T, P> {
  apply: (draft: Draft<T>, payload: P) => void;
  revert: (draft: Draft<T>, payload: P) => void;
}

export const createOptimisticAction = <T, P>(
  type: string,
  optimisticUpdate: OptimisticUpdate<T, P>,
  asyncFn: (payload: P) => Promise<any>
) => {
  return (set: any, get: any) => async (payload: P) => {
    // Apply optimistic update
    set((draft: Draft<T>) => {
      optimisticUpdate.apply(draft, payload);
    }, `${type}:optimistic`);

    try {
      // Perform async operation
      const result = await asyncFn(payload);

      // Update with real data if needed
      set((draft: Draft<T>) => {
        // Implementation depends on the specific use case
        // This is where you'd apply the real server response
      }, `${type}:success`);

      return result;
    } catch (error) {
      // Revert optimistic update
      set((draft: Draft<T>) => {
        optimisticUpdate.revert(draft, payload);
      }, `${type}:error`);

      throw error;
    }
  };
};

// Batch action creator
export const createBatchAction =
  <T>(actions: Array<(draft: Draft<T>) => void>) =>
  (set: any) => {
    set((draft: Draft<T>) => {
      actions.forEach(action => action(draft));
    }, 'batch');
  };

// Conditional action creator
export const createConditionalAction =
  <T, P>(
    condition: (state: T, payload: P) => boolean,
    action: (draft: Draft<T>, payload: P) => void
  ) =>
  (set: any, get: any) =>
  (payload: P) => {
    const state = get();
    if (condition(state, payload)) {
      set((draft: Draft<T>) => {
        action(draft, payload);
      }, 'conditional');
    }
  };

// Throttled action creator
export const createThrottledAction = <P>(
  action: (payload: P) => void,
  delay: number = 100
) => {
  let isThrottled = false;

  return (payload: P) => {
    if (isThrottled) return;

    isThrottled = true;
    action(payload);

    setTimeout(() => {
      isThrottled = false;
    }, delay);
  };
};

// Debounced action creator
export const createDebouncedAction = <P>(
  action: (payload: P) => void,
  delay: number = 300
) => {
  let timeoutId: NodeJS.Timeout | null = null;

  return (payload: P) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      action(payload);
      timeoutId = null;
    }, delay);
  };
};

// Undo/Redo utilities
export interface UndoableState<T> {
  past: T[];
  present: T;
  future: T[];
}

export const createUndoableActions = <T>() => ({
  undo: (set: any, get: any) => () => {
    set((draft: UndoableState<T>) => {
      if (draft.past.length === 0) return;

      const previous = draft.past[draft.past.length - 1];
      const newPast = draft.past.slice(0, -1);

      draft.future = [draft.present, ...draft.future];
      draft.present = previous;
      draft.past = newPast;
    }, 'undo');
  },

  redo: (set: any, get: any) => () => {
    set((draft: UndoableState<T>) => {
      if (draft.future.length === 0) return;

      const next = draft.future[0];
      const newFuture = draft.future.slice(1);

      draft.past = [...draft.past, draft.present];
      draft.present = next;
      draft.future = newFuture;
    }, 'redo');
  },

  clearHistory: (set: any) => () => {
    set((draft: UndoableState<T>) => {
      draft.past = [];
      draft.future = [];
    }, 'clearHistory');
  },

  pushToHistory: (set: any) => (state: T) => {
    set((draft: UndoableState<T>) => {
      draft.past.push(draft.present);
      draft.present = state;
      draft.future = [];

      // Limit history size
      if (draft.past.length > 50) {
        draft.past = draft.past.slice(-50);
      }
    }, 'pushToHistory');
  },
});

// Validation utilities
export type Validator<T> = (value: T) => string | null;

export const createValidatedAction =
  <T, P>(
    validator: Validator<P>,
    action: (draft: Draft<T>, payload: P) => void
  ) =>
  (set: any, get: any) =>
  (payload: P) => {
    const error = validator(payload);
    if (error) {
      throw new Error(error);
    }

    set((draft: Draft<T>) => {
      action(draft, payload);
    }, 'validated');
  };

// Common validators
export const validators = {
  required: <T>(value: T): string | null =>
    value == null || value === '' ? 'This field is required' : null,

  minLength:
    (min: number) =>
    (value: string): string | null =>
      value.length < min ? `Minimum length is ${min}` : null,

  maxLength:
    (max: number) =>
    (value: string): string | null =>
      value.length > max ? `Maximum length is ${max}` : null,

  email: (value: string): string | null => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : 'Invalid email format';
  },

  min:
    (min: number) =>
    (value: number): string | null =>
      value < min ? `Minimum value is ${min}` : null,

  max:
    (max: number) =>
    (value: number): string | null =>
      value > max ? `Maximum value is ${max}` : null,

  pattern:
    (regex: RegExp, message: string) =>
    (value: string): string | null =>
      regex.test(value) ? null : message,
};

// Combine validators
export const combineValidators =
  <T>(...validators: Validator<T>[]): Validator<T> =>
  (value: T) => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return null;
  };

// Loading state utilities
export interface LoadingState {
  loading: boolean;
  error: string | null;
}

export const createLoadingActions = <T extends LoadingState>() => ({
  setLoading: (set: any) => (loading: boolean) => {
    set((draft: Draft<T>) => {
      draft.loading = loading;
      if (loading) {
        draft.error = null;
      }
    }, 'setLoading');
  },

  setError: (set: any) => (error: string | null) => {
    set((draft: Draft<T>) => {
      draft.error = error;
      draft.loading = false;
    }, 'setError');
  },

  clearError: (set: any) => () => {
    set((draft: Draft<T>) => {
      draft.error = null;
    }, 'clearError');
  },

  resetLoading: (set: any) => () => {
    set((draft: Draft<T>) => {
      draft.loading = false;
      draft.error = null;
    }, 'resetLoading');
  },
});

// Pagination utilities
export interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

export const createPaginationActions = <
  T extends { pagination: PaginationState },
>() => ({
  setPage: (set: any) => (page: number) => {
    set((draft: Draft<T>) => {
      draft.pagination.page = Math.max(1, page);
    }, 'setPage');
  },

  setLimit: (set: any) => (limit: number) => {
    set((draft: Draft<T>) => {
      draft.pagination.limit = Math.max(1, limit);
      draft.pagination.page = 1; // Reset to first page
    }, 'setLimit');
  },

  setTotal: (set: any) => (total: number) => {
    set((draft: Draft<T>) => {
      draft.pagination.total = Math.max(0, total);
    }, 'setTotal');
  },

  nextPage: (set: any, get: any) => () => {
    const { pagination } = get();
    const maxPage = Math.ceil(pagination.total / pagination.limit);

    set((draft: Draft<T>) => {
      draft.pagination.page = Math.min(maxPage, pagination.page + 1);
    }, 'nextPage');
  },

  previousPage: (set: any, get: any) => () => {
    const { pagination } = get();

    set((draft: Draft<T>) => {
      draft.pagination.page = Math.max(1, pagination.page - 1);
    }, 'previousPage');
  },

  firstPage: (set: any) => () => {
    set((draft: Draft<T>) => {
      draft.pagination.page = 1;
    }, 'firstPage');
  },

  lastPage: (set: any, get: any) => () => {
    const { pagination } = get();
    const maxPage = Math.ceil(pagination.total / pagination.limit);

    set((draft: Draft<T>) => {
      draft.pagination.page = maxPage;
    }, 'lastPage');
  },
});

// Array manipulation utilities
export const arrayActions = {
  add: <T, I>(array: T[], item: I, at?: number) => {
    if (at !== undefined) {
      array.splice(at, 0, item as any);
    } else {
      array.push(item as any);
    }
  },

  remove: <T>(array: T[], index: number) => {
    array.splice(index, 1);
  },

  removeBy: <T>(array: T[], predicate: (item: T) => boolean) => {
    const index = array.findIndex(predicate);
    if (index !== -1) {
      array.splice(index, 1);
    }
  },

  update: <T>(array: T[], index: number, item: Partial<T>) => {
    if (array[index]) {
      Object.assign(array[index], item);
    }
  },

  updateBy: <T extends object>(
    array: T[],
    predicate: (item: T) => boolean,
    updater: (item: T) => Partial<T>
  ) => {
    const index = array.findIndex(predicate);
    if (index !== -1) {
      Object.assign(array[index], updater(array[index]));
    }
  },

  move: <T>(array: T[], fromIndex: number, toIndex: number) => {
    const item = array.splice(fromIndex, 1)[0];
    array.splice(toIndex, 0, item);
  },

  clear: <T>(array: T[]) => {
    array.length = 0;
  },

  replace: <T>(array: T[], newItems: T[]) => {
    array.splice(0, array.length, ...newItems);
  },
};
