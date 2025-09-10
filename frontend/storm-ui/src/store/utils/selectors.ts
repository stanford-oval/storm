// Reusable selectors and selector utilities
import { createSelector, shallowEqual } from '../middleware/subscriptions';

// Memoized selector creator with shallow equality
export const createShallowSelector = <T, R>(selector: (state: T) => R) =>
  createSelector(selector, shallowEqual);

// Deep selector creator (use sparingly as it's expensive)
export const createDeepSelector = <T, R>(
  selector: (state: T) => R,
  equalityFn?: (a: R, b: R) => boolean
) => createSelector(selector, equalityFn);

// Parametrized selector creator
export const createParametrizedSelector = <T, P, R>(
  selector: (state: T, params: P) => R
) => {
  const cache = new Map<string, { result: R; lastState: T; lastParams: P }>();

  return (params: P) =>
    (state: T): R => {
      const key = JSON.stringify(params);
      const cached = cache.get(key);

      if (
        cached &&
        Object.is(cached.lastState, state) &&
        Object.is(cached.lastParams, params)
      ) {
        return cached.result;
      }

      const result = selector(state, params);
      cache.set(key, { result, lastState: state, lastParams: params });

      // Cleanup old cache entries (keep only last 50)
      if (cache.size > 50) {
        const firstKey = cache.keys().next().value;
        if (firstKey !== undefined) {
          cache.delete(firstKey);
        }
      }

      return result;
    };
};

// Array selector with item stability
export const createArraySelector = <T, I>(
  selector: (state: T) => I[],
  keyFn: (item: I, index: number) => string | number = (item, index) => index
) => {
  let lastResult: I[] = [];
  let lastState: T;
  let itemsMap = new Map<string | number, I>();

  return (state: T): I[] => {
    if (Object.is(state, lastState)) {
      return lastResult;
    }

    const newItems = selector(state);
    const newItemsMap = new Map<string | number, I>();
    const result: I[] = [];

    // Preserve object identity for unchanged items
    newItems.forEach((item, index) => {
      const key = keyFn(item, index);
      const existingItem = itemsMap.get(key);

      if (existingItem && shallowEqual(existingItem, item)) {
        result.push(existingItem);
        newItemsMap.set(key, existingItem);
      } else {
        result.push(item);
        newItemsMap.set(key, item);
      }
    });

    lastState = state;
    lastResult = result;
    itemsMap = newItemsMap;

    return result;
  };
};

// Filtered selector
export const createFilteredSelector = <T, I>(
  selector: (state: T) => I[],
  filterFn: (item: I, index: number, array: I[]) => boolean
) =>
  createSelector((state: T) => selector(state).filter(filterFn), shallowEqual);

// Sorted selector
export const createSortedSelector = <T, I>(
  selector: (state: T) => I[],
  compareFn: (a: I, b: I) => number
) =>
  createSelector(
    (state: T) => [...selector(state)].sort(compareFn),
    shallowEqual
  );

// Paginated selector
export const createPaginatedSelector = <T, I>(
  selector: (state: T) => I[],
  pageSize: number
) =>
  createParametrizedSelector((state: T, page: number) => {
    const items = selector(state);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    return {
      items: items.slice(startIndex, endIndex),
      totalItems: items.length,
      totalPages: Math.ceil(items.length / pageSize),
      currentPage: page,
      hasNextPage: endIndex < items.length,
      hasPreviousPage: page > 1,
    };
  });

// Grouped selector
export const createGroupedSelector = <T, I, K>(
  selector: (state: T) => I[],
  keyFn: (item: I) => K
) =>
  createSelector((state: T) => {
    const items = selector(state);
    const groups = new Map<K, I[]>();

    items.forEach(item => {
      const key = keyFn(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    });

    return Object.fromEntries(groups);
  }, shallowEqual);

// Aggregated selector
export const createAggregatedSelector = <T, I, R>(
  selector: (state: T) => I[],
  aggregateFn: (items: I[]) => R
) => createSelector((state: T) => aggregateFn(selector(state)));

// Search selector
export const createSearchSelector = <T, I>(
  selector: (state: T) => I[],
  searchFn: (item: I, query: string) => boolean
) =>
  createParametrizedSelector((state: T, query: string) => {
    if (!query.trim()) {
      return selector(state);
    }

    const normalizedQuery = query.toLowerCase().trim();
    return selector(state).filter(item => searchFn(item, normalizedQuery));
  });

// Combined selector for multiple states
export const createCombinedSelector = <T1, T2, R>(
  selector1: (state: T1) => any,
  selector2: (state: T2) => any,
  combiner: (result1: any, result2: any) => R
) => {
  let lastResult: R;
  let lastState1: T1;
  let lastState2: T2;
  let lastResult1: any;
  let lastResult2: any;

  return (state1: T1, state2: T2): R => {
    const result1 = selector1(state1);
    const result2 = selector2(state2);

    if (
      Object.is(state1, lastState1) &&
      Object.is(state2, lastState2) &&
      Object.is(result1, lastResult1) &&
      Object.is(result2, lastResult2)
    ) {
      return lastResult;
    }

    const result = combiner(result1, result2);

    lastState1 = state1;
    lastState2 = state2;
    lastResult1 = result1;
    lastResult2 = result2;
    lastResult = result;

    return result;
  };
};

// Computed selector with dependencies
export const createComputedSelector = <T, D extends readonly any[], R>(
  dependencies: (state: T) => D,
  compute: (...deps: D) => R,
  equalityFn: (a: D, b: D) => boolean = shallowEqual
) => {
  let lastDeps: D;
  let lastResult: R;
  let hasBeenCalled = false;

  return (state: T): R => {
    const currentDeps = dependencies(state);

    if (!hasBeenCalled || !equalityFn(currentDeps, lastDeps)) {
      lastResult = compute(...currentDeps);
      lastDeps = currentDeps;
      hasBeenCalled = true;
    }

    return lastResult;
  };
};

// Async selector for computed values
export const createAsyncSelector = <T, R>(
  selector: (state: T) => Promise<R>,
  defaultValue: R
) => {
  let lastState: T;
  let currentPromise: Promise<R> | null = null;
  let cachedResult: R = defaultValue;

  return (state: T): { data: R; loading: boolean; error: Error | null } => {
    if (!Object.is(state, lastState)) {
      lastState = state;
      currentPromise = selector(state)
        .then(result => {
          cachedResult = result;
          currentPromise = null;
          return result;
        })
        .catch(error => {
          currentPromise = null;
          throw error;
        });
    }

    return {
      data: cachedResult,
      loading: currentPromise !== null,
      error: null, // Error handling would require more complex state management
    };
  };
};

// Performance monitoring selector
export const createPerformanceSelector = <T, R>(
  selector: (state: T) => R,
  name: string = 'unnamed'
) => {
  let totalTime = 0;
  let callCount = 0;

  return (state: T): R => {
    const startTime = performance.now();
    const result = selector(state);
    const endTime = performance.now();

    totalTime += endTime - startTime;
    callCount++;

    if (callCount % 100 === 0) {
      console.log(`Selector "${name}" performance:`, {
        averageTime: totalTime / callCount,
        totalCalls: callCount,
        totalTime,
      });
    }

    return result;
  };
};

// Debounced selector for expensive computations
export const createDebouncedSelector = <T, R>(
  selector: (state: T) => R,
  delay: number = 100
) => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastResult: R;
  let pendingState: T;
  let hasResult = false;

  return (state: T): R | undefined => {
    pendingState = state;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      lastResult = selector(pendingState);
      hasResult = true;
      timeoutId = null;
    }, delay);

    return hasResult ? lastResult : undefined;
  };
};

// Common selector utilities
export const selectById =
  <T extends { id: string }>(id: string) =>
  (items: T[]) =>
    items.find(item => item.id === id);

export const selectByIds =
  <T extends { id: string }>(ids: string[]) =>
  (items: T[]) =>
    items.filter(item => ids.includes(item.id));

export const selectWhere =
  <T>(predicate: (item: T) => boolean) =>
  (items: T[]) =>
    items.filter(predicate);

export const selectFirst = <T>(items: T[]) => items[0];
export const selectLast = <T>(items: T[]) => items[items.length - 1];
export const selectLength = <T>(items: T[]) => items.length;
export const selectEmpty = <T>(items: T[]) => items.length === 0;

// Selector composition utilities
export const pipe =
  <T, R1, R2>(selector1: (state: T) => R1, selector2: (result: R1) => R2) =>
  (state: T) =>
    selector2(selector1(state));

export const compose =
  <T, R1, R2, R3>(
    selector1: (state: T) => R1,
    selector2: (result: R1) => R2,
    selector3: (result: R2) => R3
  ) =>
  (state: T) =>
    selector3(selector2(selector1(state)));

// Selector debugging utilities
export const debugSelector =
  <T, R>(selector: (state: T) => R, name: string = 'selector') =>
  (state: T): R => {
    console.time(`${name} execution`);
    const result = selector(state);
    console.timeEnd(`${name} execution`);
    console.log(`${name} result:`, result);
    return result;
  };
