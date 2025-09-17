// Immer middleware for immutable state updates
import { produce, Draft } from 'immer';
import { StateCreator } from 'zustand';

// Immer middleware type
export interface ImmerStateCreator<T> {
  (set: (fn: (draft: Draft<T>) => void) => void, get: () => T, api: any): T;
}

// Immer middleware implementation
export const immer = <T>(config: ImmerStateCreator<T>): StateCreator<T> => {
  return (set, get, api) => {
    const immerSet = (fn: (draft: Draft<T>) => void, actionName?: string) => {
      // Ignore actionName for now - it's used for debugging
      set(produce(fn) as any);
    };

    return config(immerSet, get, api);
  };
};

// Utility to create immer-based actions
export const createImmerActions = <
  T,
  A extends Record<string, (...args: any[]) => void>,
>(
  actions: (
    set: (fn: (draft: Draft<T>) => void, actionName?: string) => void,
    get: () => T
  ) => A
) => {
  return (set: any, get: any) => {
    const immerSet = (fn: (draft: Draft<T>) => void, actionName?: string) => {
      const namedFunction = function (state: T) {
        return produce(state, fn);
      };

      Object.defineProperty(namedFunction, 'name', {
        value: actionName || fn.name || 'immerUpdate',
        configurable: true,
      });

      return set(namedFunction, false, actionName);
    };

    return actions(immerSet, get);
  };
};

// Helper functions for common patterns
export const immerHelpers = {
  // Add item to array
  addToArray:
    <T>(array: T[], item: T) =>
    (draft: T[]) => {
      draft.push(item);
    },

  // Remove item from array by index
  removeFromArray:
    <T>(array: T[], index: number) =>
    (draft: T[]) => {
      draft.splice(index, 1);
    },

  // Remove item from array by predicate
  removeFromArrayBy:
    <T>(predicate: (item: T) => boolean) =>
    (draft: T[]) => {
      const index = draft.findIndex(predicate);
      if (index !== -1) {
        draft.splice(index, 1);
      }
    },

  // Update item in array
  updateInArray:
    <T>(index: number, updater: (item: T) => void | Partial<T>) =>
    (draft: T[]) => {
      if (draft[index]) {
        const result = updater(draft[index]);
        if (result) {
          Object.assign(draft[index] as any, result);
        }
      }
    },

  // Update item in array by predicate
  updateInArrayBy:
    <T>(
      predicate: (item: T) => boolean,
      updater: (item: T) => void | Partial<T>
    ) =>
    (draft: T[]) => {
      const index = draft.findIndex(predicate);
      if (index !== -1) {
        const result = updater(draft[index]);
        if (result) {
          Object.assign(draft[index] as any, result);
        }
      }
    },

  // Toggle item in array (add if not present, remove if present)
  toggleInArray:
    <T>(item: T, compareFn?: (a: T, b: T) => boolean) =>
    (draft: T[]) => {
      const compare = compareFn || ((a, b) => a === b);
      const index = draft.findIndex(existing => compare(existing, item));

      if (index !== -1) {
        draft.splice(index, 1);
      } else {
        draft.push(item);
      }
    },

  // Update nested object property
  updateNested:
    <T extends Record<string, any>>(path: string, value: any) =>
    (draft: T) => {
      const keys = path.split('.');
      let current = draft as any;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
    },

  // Merge objects
  merge:
    <T extends Record<string, any>>(updates: Partial<T>) =>
    (draft: T) => {
      Object.assign(draft, updates);
    },

  // Deep merge objects
  deepMerge:
    <T extends Record<string, any>>(updates: any) =>
    (draft: T) => {
      const merge = (target: any, source: any) => {
        for (const key in source) {
          if (
            source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key])
          ) {
            if (!target[key] || typeof target[key] !== 'object') {
              target[key] = {};
            }
            merge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      };

      merge(draft, updates);
    },

  // Reset specific properties to their default values
  resetProperties:
    <T extends Record<string, any>>(
      properties: (keyof T)[],
      defaults: Partial<T>
    ) =>
    (draft: T) => {
      properties.forEach(prop => {
        if (prop in defaults) {
          draft[prop] = defaults[prop]!;
        }
      });
    },

  // Apply conditional update
  conditionalUpdate:
    <T>(condition: (state: T) => boolean, updater: (draft: Draft<T>) => void) =>
    (draft: Draft<T>) => {
      if (condition(draft as T)) {
        updater(draft);
      }
    },

  // Batch multiple updates
  batch:
    <T>(...updaters: Array<(draft: Draft<T>) => void>) =>
    (draft: Draft<T>) => {
      updaters.forEach(updater => updater(draft));
    },
};
