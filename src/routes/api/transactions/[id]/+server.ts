import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TransactionRepository } from '$lib/server/repositories/transactions';
import { AccountingService } from '$lib/server/services/accounting';
import { updateTransactionSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, params }) => {
	try {
		const id = parseInt(params.id);
		if (isNaN(id)) {
			return json({ error: { message: 'Invalid transaction ID' } }, { status: 400 });
		}

		const repo = new TransactionRepository(locals.db);
		const transaction = await repo.findById(id);

		if (!transaction) {
			return json({ error: { message: 'Transaction not found' } }, { status: 404 });
		}

		return json({ data: transaction });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to fetch transaction',
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
			return json({ error: { message: 'Invalid transaction ID' } }, { status: 400 });
		}
		
		const body = await request.json();
		const { lines, ...transactionData } = updateTransactionSchema.parse(body);
		
		// Validate line totals if both lines and total_cents are provided
		if (lines && transactionData.total_cents !== undefined) {
			const accountingService = new AccountingService();
			const validation = accountingService.validateTransactionTotal(
				lines,
				transactionData.total_cents,
				transactionData.receipt_total_cents,
				transactionData.receipt_currency,
				transactionData.exchange_rate_thousandths
			);

			if (!validation.valid) {
				return json(
					{
						error: {
							message: validation.error,
							code: 'INVALID_TRANSACTION_TOTAL'
						}
					},
					{ status: 400 }
				);
			}
		}
		
		const repo = new TransactionRepository(locals.db);
		const transaction = await repo.update(id, transactionData, lines);

		if (!transaction) {
			return json({ error: { message: 'Transaction not found' } }, { status: 404 });
		}

		return json({ data: {...transaction} });
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
		console.log((error as Error).message)
		return json(
			{
				error: {
					message: 'Failed to update transaction',
					details: (error as Error).message
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
			return json({ error: { message: 'Invalid transaction ID' } }, { status: 400 });
		}

		const repo = new TransactionRepository(locals.db);
		const deleted = await repo.delete(id);

		if (!deleted) {
			return json({ error: { message: 'Transaction not found' } }, { status: 404 });
		}

		return json({ data: { success: true } });
	} catch (error) {
		return json(
			{
				error: {
					message: 'Failed to delete transaction',
					details: error
				}
			},
			{ status: 500 }
		);
	}
};
