// State migration utilities
import { StateMigration } from '../types';

// Migration context
export interface MigrationContext {
  fromVersion: number;
  toVersion: number;
  storeName: string;
  timestamp: number;
}

// Migration result
export interface MigrationResult<T> {
  success: boolean;
  migratedState: T;
  appliedMigrations: number[];
  errors: string[];
  warnings: string[];
}

// Migration function type
export type MigrationFunction<T = any> = (
  state: T,
  context: MigrationContext
) => T;

// Enhanced migration with validation and rollback
export interface EnhancedMigration<T = any> {
  version: number;
  description: string;
  up: MigrationFunction<T>;
  down?: MigrationFunction<T>; // For rollback
  validate?: (state: T) => boolean; // Validate state before migration
  critical?: boolean; // If true, failing this migration should prevent loading
}

// Migration manager
export class MigrationManager<T> {
  private migrations: Map<number, EnhancedMigration<T>> = new Map();
  private rollbackStack: Array<{ version: number; state: T }> = [];

  constructor(private storeName: string) {}

  // Register a migration
  addMigration(migration: EnhancedMigration<T>) {
    this.migrations.set(migration.version, migration);
  }

  // Register multiple migrations
  addMigrations(migrations: EnhancedMigration<T>[]) {
    migrations.forEach(migration => this.addMigration(migration));
  }

  // Apply migrations from one version to another
  migrate(
    state: T,
    fromVersion: number,
    toVersion: number
  ): MigrationResult<T> {
    const result: MigrationResult<T> = {
      success: true,
      migratedState: state,
      appliedMigrations: [],
      errors: [],
      warnings: [],
    };

    try {
      // Get sorted list of migrations to apply
      const migrationsToApply = this.getMigrationsInRange(
        fromVersion,
        toVersion
      );

      if (migrationsToApply.length === 0) {
        return result;
      }

      console.log(
        `🔄 [${this.storeName}] Applying ${migrationsToApply.length} migrations from v${fromVersion} to v${toVersion}`
      );

      let currentState = this.deepClone(state);

      // Apply each migration in order
      for (const migration of migrationsToApply) {
        try {
          const context: MigrationContext = {
            fromVersion,
            toVersion,
            storeName: this.storeName,
            timestamp: Date.now(),
          };

          // Validate state before migration if validator exists
          if (migration.validate && !migration.validate(currentState)) {
            const error = `State validation failed for migration v${migration.version}`;
            result.errors.push(error);

            if (migration.critical) {
              result.success = false;
              break;
            } else {
              result.warnings.push(
                `Skipping non-critical migration v${migration.version} due to validation failure`
              );
              continue;
            }
          }

          // Store state for potential rollback
          this.rollbackStack.push({
            version: migration.version,
            state: this.deepClone(currentState),
          });

          // Apply migration
          const migratedState = migration.up(currentState, context);

          console.log(
            `✅ [${this.storeName}] Applied migration v${migration.version}: ${migration.description}`
          );

          currentState = migratedState;
          result.appliedMigrations.push(migration.version);
        } catch (error) {
          const errorMessage = `Migration v${migration.version} failed: ${error instanceof Error ? error.message : String(error)}`;
          result.errors.push(errorMessage);

          if (migration.critical) {
            result.success = false;
            break;
          } else {
            result.warnings.push(
              `Non-critical migration v${migration.version} failed but continuing`
            );
          }
        }
      }

      result.migratedState = currentState;

      if (result.success) {
        console.log(
          `🎉 [${this.storeName}] Successfully migrated from v${fromVersion} to v${toVersion}`
        );
      } else {
        console.error(`❌ [${this.storeName}] Migration failed`, result.errors);
      }

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(
        `Migration process failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return result;
    }
  }

  // Rollback to a previous version
  rollback(targetVersion: number): T | null {
    const rollbackPoint = this.rollbackStack.find(
      point => point.version <= targetVersion
    );

    if (!rollbackPoint) {
      console.error(
        `❌ [${this.storeName}] No rollback point found for version ${targetVersion}`
      );
      return null;
    }

    // Apply down migrations if available
    const migrationsToRollback = this.rollbackStack
      .filter(point => point.version > targetVersion)
      .reverse();

    let currentState = rollbackPoint.state;

    for (const point of migrationsToRollback) {
      const migration = this.migrations.get(point.version);

      if (migration?.down) {
        try {
          const context: MigrationContext = {
            fromVersion: point.version,
            toVersion: targetVersion,
            storeName: this.storeName,
            timestamp: Date.now(),
          };

          currentState = migration.down(currentState, context);
          console.log(
            `↩️ [${this.storeName}] Rolled back migration v${point.version}`
          );
        } catch (error) {
          console.error(
            `❌ [${this.storeName}] Rollback failed for migration v${point.version}:`,
            error
          );
        }
      }
    }

    // Clear rollback stack beyond target version
    this.rollbackStack = this.rollbackStack.filter(
      point => point.version <= targetVersion
    );

    console.log(
      `🔄 [${this.storeName}] Rolled back to version ${targetVersion}`
    );
    return currentState;
  }

  // Get migrations in version range
  private getMigrationsInRange(
    fromVersion: number,
    toVersion: number
  ): EnhancedMigration<T>[] {
    const migrations: EnhancedMigration<T>[] = [];

    // Get all migration versions in range
    const versions = Array.from(this.migrations.keys())
      .filter(version => version > fromVersion && version <= toVersion)
      .sort((a, b) => a - b);

    return versions.map(version => this.migrations.get(version)!);
  }

  // Deep clone state for rollback purposes
  private deepClone<U>(obj: U): U {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as any;
    }

    if (obj instanceof Map) {
      const clonedMap = new Map();
      obj.forEach((value, key) => {
        clonedMap.set(key, this.deepClone(value));
      });
      return clonedMap as any;
    }

    if (obj instanceof Set) {
      const clonedSet = new Set();
      obj.forEach(value => {
        clonedSet.add(this.deepClone(value));
      });
      return clonedSet as any;
    }

    const cloned: any = {};
    Object.keys(obj).forEach(key => {
      cloned[key] = this.deepClone((obj as any)[key]);
    });

    return cloned;
  }

  // Get migration info
  getMigrationInfo() {
    const migrations = Array.from(this.migrations.values()).sort(
      (a, b) => a.version - b.version
    );

    return {
      storeName: this.storeName,
      totalMigrations: migrations.length,
      versions: migrations.map(m => m.version),
      latestVersion:
        migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) : 0,
      migrations: migrations.map(m => ({
        version: m.version,
        description: m.description,
        critical: m.critical || false,
        hasRollback: !!m.down,
        hasValidation: !!m.validate,
      })),
    };
  }

  // Clear rollback stack (useful after successful migration)
  clearRollbackStack() {
    this.rollbackStack = [];
  }
}

// Create migration function factory
export const createMigration = <T>(
  version: number,
  description: string,
  migrationFn: MigrationFunction<T>,
  options: {
    down?: MigrationFunction<T>;
    validate?: (state: T) => boolean;
    critical?: boolean;
  } = {}
): EnhancedMigration<T> => ({
  version,
  description,
  up: migrationFn,
  ...options,
});

// Common migration utilities
export const migrationUtils = {
  // Add a field with default value
  addField:
    <T, K extends string, V>(
      field: K,
      defaultValue: V
    ): MigrationFunction<T & Record<K, V>> =>
    state =>
      ({
        ...state,
        [field]: defaultValue,
      }) as T & Record<K, V>,

  // Remove a field
  removeField:
    <T>(field: string): MigrationFunction<T> =>
    state => {
      const { [field]: removed, ...rest } = state as any;
      return rest;
    },

  // Rename a field
  renameField:
    <T>(oldField: string, newField: string): MigrationFunction<T> =>
    state => {
      const newState = { ...state } as any;
      if (oldField in newState) {
        newState[newField] = newState[oldField];
        delete newState[oldField];
      }
      return newState;
    },

  // Transform field value
  transformField:
    <T, K extends keyof T>(
      field: K,
      transformer: (value: T[K]) => T[K]
    ): MigrationFunction<T> =>
    state => ({
      ...state,
      [field]: transformer(state[field]),
    }),

  // Migrate array items
  migrateArrayItems:
    <T, I>(
      arrayField: keyof T,
      itemMigration: (item: I) => I
    ): MigrationFunction<T> =>
    state => {
      const array = (state as any)[arrayField];
      if (Array.isArray(array)) {
        return {
          ...state,
          [arrayField]: array.map(itemMigration),
        };
      }
      return state;
    },

  // Change data structure
  restructure:
    <T, R>(restructurer: (state: T) => R): MigrationFunction<R> =>
    (state: any) =>
      restructurer(state as T),

  // Conditional migration
  conditional:
    <T>(
      condition: (state: T) => boolean,
      migration: MigrationFunction<T>
    ): MigrationFunction<T> =>
    (state, context) => {
      if (condition(state)) {
        return migration(state, context);
      }
      return state;
    },

  // Compose multiple migrations
  compose:
    <T>(...migrations: MigrationFunction<T>[]): MigrationFunction<T> =>
    (state, context) => {
      return migrations.reduce(
        (currentState, migration) => migration(currentState, context),
        state
      );
    },
};

// Version comparison utilities
export const versionUtils = {
  // Compare semantic versions (e.g., "1.2.3")
  compareSemanticVersions: (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;

      if (part1 > part2) return 1;
      if (part1 < part2) return -1;
    }

    return 0;
  },

  // Parse version string to number
  parseVersion: (version: string): number => {
    const parts = version.split('.').map(Number);
    return parts[0] * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
  },

  // Format version number to string
  formatVersion: (version: number): string => {
    const major = Math.floor(version / 10000);
    const minor = Math.floor((version % 10000) / 100);
    const patch = version % 100;

    return `${major}.${minor}.${patch}`;
  },
};

// Export a ready-to-use migration creator
export const createStoreWithMigrations = <T>(
  storeName: string,
  migrations: EnhancedMigration<T>[]
) => {
  const migrationManager = new MigrationManager<T>(storeName);
  migrationManager.addMigrations(migrations);

  return {
    migrationManager,
    createMigrator:
      (currentVersion: number) =>
      (persistedState: any, version: number): T | null => {
        if (version >= currentVersion) {
          return persistedState;
        }

        const result = migrationManager.migrate(
          persistedState,
          version,
          currentVersion
        );

        if (!result.success) {
          console.error(`Failed to migrate ${storeName} store:`, result.errors);
          return null;
        }

        if (result.warnings.length > 0) {
          console.warn(`Migration warnings for ${storeName}:`, result.warnings);
        }

        return result.migratedState;
      },
  };
};
