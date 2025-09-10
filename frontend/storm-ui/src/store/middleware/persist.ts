// Persistence middleware for Zustand stores
import { StateCreator } from 'zustand';
import { PersistOptions, StateMigration } from '../types';

// Storage interface
export interface Storage {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

// Default localStorage implementation
export const createJSONStorage = (): Storage => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // Silently fail if localStorage is not available
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Silently fail if localStorage is not available
    }
  },
});

// Session storage implementation
export const createSessionStorage = (): Storage => ({
  getItem: (name: string) => {
    try {
      return sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      sessionStorage.setItem(name, value);
    } catch {
      // Silently fail if sessionStorage is not available
    }
  },
  removeItem: (name: string) => {
    try {
      sessionStorage.removeItem(name);
    } catch {
      // Silently fail if sessionStorage is not available
    }
  },
});

// Default migrations
const defaultMigrations: StateMigration[] = [
  {
    version: 1,
    migrate: (state: any) => state,
  },
];

// Persist middleware implementation
export const persist = <T>(
  config: StateCreator<T>,
  options: PersistOptions
) => {
  const {
    name,
    version = 1,
    migrate = (state: any) => state,
    partialize = (state: any) => state,
    storage = createJSONStorage(),
  } = options;

  return (set: any, get: any, api: any) => {
    const persistedState = loadPersistedState();

    const store = config(
      (args: any) => {
        set(args);
        saveState();
      },
      get,
      api
    );

    // Load persisted state on initialization
    function loadPersistedState() {
      try {
        const stored = storage.getItem(name);
        if (!stored) return null;

        const parsed = JSON.parse(stored);
        const { state, version: storedVersion } = parsed;

        // Apply migrations if version mismatch
        if (storedVersion < version) {
          return migrate(state, storedVersion);
        }

        return state;
      } catch (error) {
        console.warn(`Failed to load persisted state for ${name}:`, error);
        return null;
      }
    }

    // Save state to storage
    function saveState() {
      try {
        const state = partialize(get());
        const persistData = {
          state,
          version,
          timestamp: Date.now(),
        };

        storage.setItem(name, JSON.stringify(persistData));
      } catch (error) {
        console.warn(`Failed to save state for ${name}:`, error);
      }
    }

    // Merge persisted state with initial state
    if (persistedState) {
      Object.assign(store as any, persistedState);
    }

    // Add rehydration methods to store
    (store as any).persist = {
      clearStorage: () => storage.removeItem(name),
      rehydrate: () => {
        const state = loadPersistedState();
        if (state) {
          set(state);
        }
      },
      hasHydrated: () => true, // Simple implementation
    };

    return store;
  };
};

// Utility to create versioned state migrations
export const createMigrations = (
  migrations: Record<number, (state: any) => any>
) => {
  return (persistedState: any, version: number) => {
    let migratedState = persistedState;

    // Apply all migrations from stored version to current version
    const versions = Object.keys(migrations)
      .map(Number)
      .sort((a, b) => a - b)
      .filter(v => v > version);

    for (const targetVersion of versions) {
      migratedState = migrations[targetVersion](migratedState);
    }

    return migratedState;
  };
};

// Utility to create selective persistence
export const createPartialize = <T extends object>(keys: (keyof T)[]) => {
  return (state: T) => {
    const result: Partial<T> = {};
    for (const key of keys) {
      if (key in state) {
        result[key] = state[key];
      }
    }
    return result;
  };
};

// Utility for encrypted storage (basic implementation)
export const createEncryptedStorage = (encryptionKey: string): Storage => {
  const base64Encode = (str: string) => btoa(unescape(encodeURIComponent(str)));
  const base64Decode = (str: string) => decodeURIComponent(escape(atob(str)));

  // Simple XOR encryption (not secure for production use)
  const encrypt = (text: string, key: string) => {
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return base64Encode(result);
  };

  const decrypt = (encryptedText: string, key: string) => {
    try {
      const text = base64Decode(encryptedText);
      let result = '';
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(
          text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
        );
      }
      return result;
    } catch {
      return null;
    }
  };

  const baseStorage = createJSONStorage();

  return {
    getItem: async (name: string) => {
      const encrypted = await baseStorage.getItem(name);
      if (!encrypted) return null;

      const decrypted = decrypt(encrypted, encryptionKey);
      return decrypted;
    },
    setItem: (name: string, value: string) => {
      const encrypted = encrypt(value, encryptionKey);
      baseStorage.setItem(name, encrypted);
    },
    removeItem: (name: string) => {
      baseStorage.removeItem(name);
    },
  };
};
