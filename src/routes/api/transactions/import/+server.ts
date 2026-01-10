import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { TransactionRepository } from '$lib/server/repositories/transactions';
import { CategoryRepository } from '$lib/server/repositories/categories';
import { TagRepository } from '$lib/server/repositories/tags';
import { AccountingService } from '$lib/server/services/accounting';
import { z } from 'zod';

const importSchema = z.object({
	accountId: z.number().int().positive(),
	columnMapping: z.record(z.string(), z.string()),
	rows: z.array(z.array(z.string())),
	hasHeader: z.boolean()
});

interface ImportResult {
	success: number;
	failed: number;
	errors: string[];
}

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		const body = await request.json();
		const { accountId, columnMapping, rows } = importSchema.parse(body);

		const result: ImportResult = {
			success: 0,
			failed: 0,
			errors: []
		};

		const transactionRepo = new TransactionRepository(locals.db);
		const categoryRepo = new CategoryRepository(locals.db);
		const tagRepo = new TagRepository(locals.db);
		const accountingService = new AccountingService();

		// Get reverse mapping: field name -> column index
		const fieldToColumn: Record<string, number> = {};
		Object.entries(columnMapping).forEach(([colIndex, fieldName]) => {
			if (fieldName) {
				fieldToColumn[fieldName] = parseInt(colIndex);
			}
		});

		// Import each row
		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 1;

			try {
				// Extract values from row based on mapping
				const dateStr = fieldToColumn['date'] !== undefined ? row[fieldToColumn['date']] : '';
				const amountStr = fieldToColumn['amount'] !== undefined ? row[fieldToColumn['amount']] : '';
				const counterparty = fieldToColumn['counterparty'] !== undefined ? row[fieldToColumn['counterparty']] : '';
				const currency = fieldToColumn['currency'] !== undefined ? row[fieldToColumn['currency']] : '';
				let receiptAmountStr = fieldToColumn['receipt_amount'] !== undefined ? row[fieldToColumn['receipt_amount']] : '';
				let receiptCurrency = fieldToColumn['receipt_currency'] !== undefined ? row[fieldToColumn['receipt_currency']] : '';
				const exchangeRateStr = fieldToColumn['exchange_rate'] !== undefined ? row[fieldToColumn['exchange_rate']] : '';
				const reference = fieldToColumn['reference'] !== undefined ? row[fieldToColumn['reference']] : '';
				const memo = fieldToColumn['memo'] !== undefined ? row[fieldToColumn['memo']] : '';
				const categoryName = fieldToColumn['category'] !== undefined ? row[fieldToColumn['category']] : '';
				const description = fieldToColumn['description'] !== undefined ? row[fieldToColumn['description']] : '';
				const tagsStr = fieldToColumn['tags'] !== undefined ? row[fieldToColumn['tags']] : '';

				if (receiptAmountStr === amountStr) {
					receiptAmountStr = '';
					receiptCurrency = '';
				}

				// Validate required fields
				if (!dateStr) {
					result.errors.push(`Row ${rowNum}: Missing date`);
					result.failed++;
					continue;
				}

				if (!amountStr) {
					result.errors.push(`Row ${rowNum}: Missing amount`);
					result.failed++;
					continue;
				}

				// Parse date
				const transactionDate = parseDate(dateStr);
				if (!transactionDate) {
					result.errors.push(`Row ${rowNum}: Invalid date format: ${dateStr}`);
					result.failed++;
					continue;
				}

				// Parse amount (remove currency symbols and commas)
				const amountCents = parseAmount(amountStr);
				if (isNaN(amountCents)) {
					result.errors.push(`Row ${rowNum}: Invalid amount: ${amountStr}`);
					result.failed++;
					continue;
				}

				// Parse optional multi-currency fields
				let receiptTotalCents: number | null = null;
				let exchangeRateThousandths: number | null = null;

				if (receiptCurrency && receiptAmountStr) {
					receiptTotalCents = parseAmount(receiptAmountStr);
					const rate = parseFloat(receiptAmountStr) / parseFloat(amountStr);
					if (!isNaN(rate)) {
						exchangeRateThousandths = Math.round(rate * 1000);
					}
				}

				// Find or skip category
				let categoryId: number | null = null;
				if (categoryName) {
					const categories = await categoryRepo.findAll({ limit: 1000 });
					const category = categories.items.find(c =>
						c.name.toLowerCase() === categoryName.toLowerCase()
					);
					if (category) {
						categoryId = category.id!;
					}
				}

				// Parse tags
				const tagNames = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(t => t) : [];
				const tagIds: number[] = [];

				if (tagNames.length > 0) {
					const allTags = await tagRepo.findAll({ limit: 1000 });
					tagNames.forEach(tagName => {
						const tag = allTags.items.find(t =>
							t.name.toLowerCase() === tagName.toLowerCase()
						);
						if (tag && tag.id) {
							tagIds.push(tag.id);
						}
					});
				}

				// Create transaction
				const transactionData = {
					transaction_date: transactionDate,
					account_id: accountId,
					counterparty: counterparty || null,
					total_cents: amountCents,
					receipt_currency: receiptCurrency,
					receipt_total_cents: receiptTotalCents,
					exchange_rate_thousandths: exchangeRateThousandths,
					reference: reference || null,
					memo: memo || null,
					status: 'posted' as const
				};

				// Create single line
				const lines = [{
					category_id: categoryId,
					description: description || null,
					amount_cents: receiptTotalCents ? receiptTotalCents : amountCents
				}];

				// Validate transaction
				const validation = accountingService.validateTransactionTotal(
					lines,
					transactionData.total_cents,
					transactionData.receipt_total_cents,
					transactionData.receipt_currency,
					transactionData.exchange_rate_thousandths
				);

				if (!validation.valid) {
					result.errors.push(`Row ${rowNum}: ${validation.error}`);
					result.failed++;
					continue;
				}

				// Create transaction
				const transaction = await transactionRepo.create(transactionData, lines);

				// Add tags if any
				if (tagIds.length > 0 && transaction.id) {
					for (const tagId of tagIds) {
						await transactionRepo.addTag(transaction.id, tagId);
					}
				}

				result.success++;
			} catch (error) {
				console.error(`Error importing row ${rowNum}:`, error);
				result.errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : 'Unknown error'}`);
				result.failed++;
			}
		}

		return json({
			data: result
		});
	} catch (error) {
		if (error instanceof z.ZodError) {
			return json(
				{
					error: {
						message: 'Invalid import data',
						details: error.issues
					}
				},
				{ status: 400 }
			);
		}

		console.error('Failed to import transactions:', error);
		return json(
			{
				error: {
					message: 'Failed to import transactions',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};

function parseDate(dateStr: string): Date | null {
	// Try various date formats
	let date: Date | null = null;

	// ISO format: YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
		date = new Date(dateStr);
	}
	// MM/DD/YYYY or MM/DD/YY
	else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dateStr)) {
		const parts = dateStr.split('/');
		const month = parseInt(parts[0], 10);
		const day = parseInt(parts[1], 10);
		let year = parseInt(parts[2], 10);

		if (year < 100) {
			year += year < 50 ? 2000 : 1900;
		}

		date = new Date(year, month - 1, day);
	}
	// DD/MM/YYYY or DD/MM/YY (European format)
	else if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(dateStr)) {
		const parts = dateStr.split('-');
		const day = parseInt(parts[0], 10);
		const month = parseInt(parts[1], 10);
		let year = parseInt(parts[2], 10);

		if (year < 100) {
			year += year < 50 ? 2000 : 1900;
		}

		date = new Date(year, month - 1, day);
	}
	// Try generic Date parse as fallback
	else {
		date = new Date(dateStr);
	}

	if (date && !isNaN(date.getTime())) {
		return date;
	}

	return null;
}

function parseAmount(amountStr: string): number {
	// Remove currency symbols, spaces, and commas
	const cleaned = amountStr.replace(/[$€£¥,\s]/g, '');

	// Handle negative values in parentheses
	if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
		const value = parseFloat(cleaned.slice(1, -1));
		return Math.round(-value * 100);
	}

	const value = parseFloat(cleaned);
	return Math.round(value * 100);
}
