import { createRxDatabase, addRxPlugin, RxDatabase, RxStorage } from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'; // or getRxStorageMemory for SSR fallback
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { workspaceSchema } from './workspaceSchema';
import { submissionSchema } from './submissionSchema';
import { submissionDataSchema } from './submissionDataSchema';
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';

addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBMigrationSchemaPlugin);

let dbPromise: Promise<RxDatabase> | null = null;
let devModeAdded = false;

export async function initDatabase() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!dbPromise) {
    dbPromise = (async () => {
      if (process.env.NODE_ENV === 'development' && !devModeAdded) {
        const m = await import('rxdb/plugins/dev-mode');
        m.disableWarnings();
        addRxPlugin(m.RxDBDevModePlugin);
        devModeAdded = true;
      }

      let storage: RxStorage = getRxStorageDexie();
      if (process.env.NODE_ENV === 'development') {
        const { wrappedValidateAjvStorage } = await import('rxdb/plugins/validate-ajv');
        storage = wrappedValidateAjvStorage({ storage });
      }

      const db = await createRxDatabase({
        name: 'chefs_rxdb_store',
        storage, // Wrapped in development for schema validation
        ignoreDuplicate: true, // Solves Next.js HMR re-init issues in development
      });

      await db.addCollections({
        workspaces: {
          schema: workspaceSchema,
          migrationStrategies: {}, // for when the data changes
        },
        submissions: {
          schema: submissionSchema,
          migrationStrategies: {}, //f or when the data changes
        },
        submissionData: {
          schema: submissionDataSchema,
          migrationStrategies: {}, // for when the data changes
        },
      });

      return db;
    })();
  }

  return dbPromise;
}
