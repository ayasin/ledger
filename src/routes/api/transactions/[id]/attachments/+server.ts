import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AttachmentRepository } from '$lib/server/repositories/attachments';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const transactionId = parseInt(params.id, 10);
		const repo = new AttachmentRepository(locals.db);
		const attachments = await repo.findByTransactionId(transactionId);

		return json({ data: attachments });
	} catch (error) {
		console.error('Failed to fetch attachments:', error);
		return json(
			{
				error: {
					message: 'Failed to fetch attachments',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};
