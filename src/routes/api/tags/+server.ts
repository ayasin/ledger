import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TagRepository } from '$lib/server/repositories/tags';
import { z, ZodError } from 'zod';

const tagFilterSchema = z.object({
	page: z.coerce.number().int().positive().optional(),
	limit: z.coerce.number().int().positive().max(1000).optional(),
	sort: z.enum(['name']).optional(),
	order: z.enum(['asc', 'desc']).optional()
});

const createTagSchema = z.object({
	name: z.string().min(1).max(255),
	color: z.string().max(7).nullable().optional()
});

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const params = Object.fromEntries(url.searchParams);
		const filter = tagFilterSchema.parse(params);

		const repo = new TagRepository(locals.db);
		const { items, meta } = await repo.findAll(filter);

		return json({
			data: items,
			meta
		});
	} catch (error) {
		if (error instanceof ZodError) {
			return json(
				{
					error: {
						message: 'Invalid query parameters',
						details: error.issues
					}
				},
				{ status: 400 }
			);
		}

		return json(
			{
				error: {
					message: 'Failed to fetch tags',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		const body = await request.json();
		const data = createTagSchema.parse(body);

		const repo = new TagRepository(locals.db);
		const tag = await repo.create(data);

		return json({ data: tag }, { status: 201 });
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
					message: 'Failed to create tag',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
