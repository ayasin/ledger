import type { Database } from '$lib/server/db';
import type { JWTPayload } from '$lib/server/services/auth';

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			code?: string;
			details?: unknown;
		}
		interface Locals {
			db: Database;
			requestId: string;
			startTime: number;
			user?: JWTPayload;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
