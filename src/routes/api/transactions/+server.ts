import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TransactionRepository } from '$lib/server/repositories/transactions';
import { AccountingService } from '$lib/server/services/accounting';
import { createTransactionSchema, transactionFilterSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const params = Object.fromEntries(url.searchParams);
		const filter = transactionFilterSchema.parse(params);

		const repo = new TransactionRepository(locals.db);
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
					message: 'Failed to fetch transactions',
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
		const { lines, ...transactionData } = createTransactionSchema.parse(body);

		// Note: Validation is already done by the Zod schema, but we can add
		// additional service-level validation here if needed
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

		const repo = new TransactionRepository(locals.db);
		const transaction = await repo.create(transactionData, lines);

		return json({ data: transaction }, { status: 201 });
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

		console.error('Failed to create transaction:', error);
		return json(
			{
				error: {
					message: 'Failed to create transaction',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};
