import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		await locals.db.run(sql`SELECT 1`);

		return json({
			data: {
				status: 'healthy',
				database: 'connected',
				timestamp: new Date().toISOString()
			}
		});
	} catch (error) {
		return json(
			{
				error: {
					message: 'Database connection failed',
					details: error
				}
			},
			{ status: 503 }
		);
	}
};
