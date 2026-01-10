import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CategoryRepository } from '$lib/server/repositories/categories';
import { updateCategorySchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: { message: 'Invalid category ID' } }, { status: 400 });
		}

		const repo = new CategoryRepository(locals.db);
		const category = await repo.findById(id);

		if (!category) {
			return json({ error: { message: 'Category not found' } }, { status: 404 });
		}

		return json({ data: category });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to fetch category',
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
			return json({ error: { message: 'Invalid category ID' } }, { status: 400 });
		}

		const body = await request.json();
		const data = updateCategorySchema.parse(body);

		const repo = new CategoryRepository(locals.db);
		const category = await repo.update(id, data);

		if (!category) {
			return json({ error: { message: 'Category not found' } }, { status: 404 });
		}

		return json({ data: category });
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
					message: 'Failed to update category',
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
			return json({ error: { message: 'Invalid category ID' } }, { status: 400 });
		}

		const repo = new CategoryRepository(locals.db);
		const deleted = await repo.delete(id);

		if (!deleted) {
			return json({ error: { message: 'Category not found' } }, { status: 404 });
		}

		return json({ data: { success: true } });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to delete category',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
