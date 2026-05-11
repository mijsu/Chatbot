/**
 * Database module — Dexie (IndexedDB) only
 * No Prisma/SQLite — all data is stored client-side using Dexie.
 */

export { db, generateId, initializeDefaults } from './offline-db';
