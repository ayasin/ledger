import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as dotenv from 'dotenv';

// Load .env file for standalone scripts (SvelteKit handles this automatically)
if (typeof process !== 'undefined' && !process.env.VITE_USER_NODE_ENV) {
	dotenv.config();
}

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqliteInstance: Database.Database | null = null;

export function getDb() {
	if (!dbInstance) {
		const dbPath = process.env.DATABASE_URL || './data/accounting.db';

		sqliteInstance = new Database(dbPath);
		sqliteInstance.pragma('journal_mode = WAL');
		sqliteInstance.pragma('foreign_keys = ON');

		dbInstance = drizzle(sqliteInstance, { schema });
	}
	return dbInstance;
}

export function closeDb() {
	if (sqliteInstance) {
		sqliteInstance.close();
		sqliteInstance = null;
		dbInstance = null;
	}
}

export const db = getDb();
export { schema };
export type Database = typeof db;
