import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { transactionTags } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	try {
		const transactionId = parseInt(params.id);
		if (isNaN(transactionId)) {
			return json({ error: { message: 'Invalid transaction ID' } }, { status: 400 });
		}

		const { tag_ids } = await request.json();

		if (!Array.isArray(tag_ids)) {
			return json({ error: { message: 'tag_ids must be an array' } }, { status: 400 });
		}

		// Delete existing tags
		locals.db.delete(transactionTags).where(eq(transactionTags.transaction_id, transactionId)).run();

		// Insert new tags
		if (tag_ids.length > 0) {
			locals.db.insert(transactionTags).values(
				tag_ids.map((tag_id: number) => ({
					transaction_id: transactionId,
					tag_id
				}))
			).run();
		}

		return json({ data: { success: true } });
	} catch (error) {
		console.error('Failed to update transaction tags:', error);
		return json(
			{
				error: {
					message: 'Failed to update transaction tags',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};
