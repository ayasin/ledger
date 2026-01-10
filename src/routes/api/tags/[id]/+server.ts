import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TagRepository } from '$lib/server/repositories/tags';
import { updateTagSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: { message: 'Invalid tag ID' } }, { status: 400 });
		}

		const repo = new TagRepository(locals.db);
		const tag = await repo.findById(id);

		if (!tag) {
			return json({ error: { message: 'Tag not found' } }, { status: 404 });
		}

		return json({ data: tag });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to fetch tag',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: { message: 'Invalid tag ID' } }, { status: 400 });
		}

		const body = await request.json();
		const data = updateTagSchema.parse(body);

		const repo = new TagRepository(locals.db);
		const tag = await repo.update(id, data);

		if (!tag) {
			return json({ error: { message: 'Tag not found' } }, { status: 404 });
		}

		return json({ data: tag });
	} catch (error) {
		if (error instanceof ZodError) {
			return json(
				{
					error: {
						message: 'Validation failed',
						details: error.issues
					}
				},
				{ status: 400 }
			);
		}

		return json(
			{
				error: {
					message: 'Failed to update tag',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: { message: 'Invalid tag ID' } }, { status: 400 });
		}

		const repo = new TagRepository(locals.db);
		const deleted = await repo.delete(id);

		if (!deleted) {
			return json({ error: { message: 'Tag not found' } }, { status: 404 });
		}

		return json({ data: { success: true } });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to delete tag',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
