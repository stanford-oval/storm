// Subscription middleware for reactive state management
import { StateCreator } from 'zustand';
import { StoreSubscription } from '../types';

// Subscription manager
export class SubscriptionManager {
  private subscriptions = new Map<string, StoreSubscription>();
  private nextId = 0;

  subscribe<T>(
    selector: (state: T) => any,
    callback: (state: any, prevState: any) => void,
    equalityFn: (a: any, b: any) => boolean = Object.is
  ): () => void {
    const id = `sub_${this.nextId++}`;
    let currentValue: any;
    let hasCurrentValue = false;

    const subscription: StoreSubscription = {
      id,
      selector,
      callback: (state: T, prevState: T) => {
        const nextValue = selector(state);

        if (!hasCurrentValue) {
          currentValue = nextValue;
          hasCurrentValue = true;
          return;
        }

        if (!equalityFn(currentValue, nextValue)) {
          const prevValue = currentValue;
          currentValue = nextValue;
          callback(nextValue, prevValue);
        }
      },
      active: true,
    };

    this.subscriptions.set(id, subscription);

    // Return unsubscribe function
    return () => {
      this.subscriptions.delete(id);
    };
  }

  // Notify all subscriptions of state change
  notify<T>(state: T, prevState: T) {
    this.subscriptions.forEach(subscription => {
      if (subscription.active) {
        subscription.callback(state, prevState);
      }
    });
  }

  // Pause/resume subscriptions
  pause(id?: string) {
    if (id) {
      const subscription = this.subscriptions.get(id);
      if (subscription) {
        subscription.active = false;
      }
    } else {
      this.subscriptions.forEach(subscription => {
        subscription.active = false;
      });
    }
  }

  resume(id?: string) {
    if (id) {
      const subscription = this.subscriptions.get(id);
      if (subscription) {
        subscription.active = true;
      }
    } else {
      this.subscriptions.forEach(subscription => {
        subscription.active = true;
      });
    }
  }

  // Clear all subscriptions
  clear() {
    this.subscriptions.clear();
  }

  // Get subscription count
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Get active subscription count
  getActiveSubscriptionCount(): number {
    return Array.from(this.subscriptions.values()).filter(sub => sub.active)
      .length;
  }
}

// Subscription middleware
export const subscriptions = <T>(config: StateCreator<T>) => {
  const subscriptionManager = new SubscriptionManager();

  return (set: any, get: any, api: any) => {
    const store = config(
      (args: any, replace?: boolean, actionName?: string) => {
        const prevState = get();
        set(args, replace, actionName);
        const nextState = get();

        // Notify subscriptions
        subscriptionManager.notify(nextState, prevState);
      },
      get,
      api
    );

    // Add subscription methods to store
    (store as any).subscribe =
      subscriptionManager.subscribe.bind(subscriptionManager);
    (store as any).subscriptions = subscriptionManager;

    return store;
  };
};

// Utility for creating memoized selectors
export const createSelector = <T, R>(
  selector: (state: T) => R,
  equalityFn: (a: R, b: R) => boolean = Object.is
) => {
  let lastResult: R;
  let lastState: T;
  let hasBeenCalled = false;

  return (state: T): R => {
    if (!hasBeenCalled || !Object.is(state, lastState)) {
      const newResult = selector(state);

      if (!hasBeenCalled || !equalityFn(newResult, lastResult)) {
        lastResult = newResult;
      }

      lastState = state;
      hasBeenCalled = true;
    }

    return lastResult;
  };
};

// Shallow equality function for objects and arrays
export const shallowEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!Object.is(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];

    if (
      !Object.prototype.hasOwnProperty.call(b, key) ||
      !Object.is(a[key], b[key])
    ) {
      return false;
    }
  }

  return true;
};

// Deep equality function
export const deepEqual = (a: any, b: any): boolean => {
  if (Object.is(a, b)) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  if (typeof a !== typeof b) {
    return false;
  }

  if (typeof a !== 'object') {
    return a === b;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

// Utility for creating computed values that update when dependencies change
export const createComputed = <T, D extends readonly any[], R>(
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
