import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AccountRepository } from '$lib/server/repositories/accounts';
import { createAccountSchema, accountFilterSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const params = Object.fromEntries(url.searchParams);
		const filter = accountFilterSchema.parse(params);

		const repo = new AccountRepository(locals.db);
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
					message: 'Failed to fetch accounts',
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
		const data = createAccountSchema.parse(body);

		const repo = new AccountRepository(locals.db);
		const account = await repo.create(data);

		return json({ data: account }, { status: 201 });
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
					message: 'Failed to create account',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
