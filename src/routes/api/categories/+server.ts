import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CategoryRepository } from '$lib/server/repositories/categories';
import { createCategorySchema, categoryFilterSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const params = Object.fromEntries(url.searchParams);
		const filter = categoryFilterSchema.parse(params);

		const repo = new CategoryRepository(locals.db);
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
					message: 'Failed to fetch categories',
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
		const data = createCategorySchema.parse(body);

		const repo = new CategoryRepository(locals.db);
		const category = await repo.create(data);

		return json({ data: category }, { status: 201 });
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
					message: 'Failed to create category',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
