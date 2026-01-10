import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AccountRepository } from '$lib/server/repositories/accounts';
import { updateAccountSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: { message: 'Invalid account ID' } }, { status: 400 });
		}

		const repo = new AccountRepository(locals.db);
		const account = await repo.findById(id);

		if (!account) {
			return json({ error: { message: 'Account not found' } }, { status: 404 });
		}

		return json({ data: account });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to fetch account',
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
			return json({ error: { message: 'Invalid account ID' } }, { status: 400 });
		}

		const body = await request.json();
		const data = updateAccountSchema.parse(body);

		const repo = new AccountRepository(locals.db);
		const account = await repo.update(id, data);

		if (!account) {
			return json({ error: { message: 'Account not found' } }, { status: 404 });
		}

		return json({ data: account });
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
					message: 'Failed to update account',
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
			return json({ error: { message: 'Invalid account ID' } }, { status: 400 });
		}

		const repo = new AccountRepository(locals.db);
		const deleted = await repo.delete(id);

		if (!deleted) {
			return json({ error: { message: 'Account not found' } }, { status: 404 });
		}

		return json({ data: { success: true } });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to delete account',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
