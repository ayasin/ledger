import { z } from 'zod';
import { accountTypes, accountStatuses, transactionStatuses } from '$lib/server/db/schema';

// Account validation schemas
export const createAccountSchema = z.object({
	code: z.string().min(1).max(50),
	name: z.string().min(1).max(255),
	type: z.enum(accountTypes),
	description: z.string().max(1000).nullable().optional(),
	parent_id: z.number().int().positive().nullable().optional(),
	currency: z.string().length(3).default('USD'),
	status: z.enum(accountStatuses).default('active')
});

export const updateAccountSchema = createAccountSchema.partial();

// Category validation schemas
export const createCategorySchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().max(1000).nullable().optional(),
	type: z.enum(accountTypes).nullable().optional(),
	parent_id: z.number().int().positive().nullable().optional(),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
	budget_amount_cents: z.number().int().nonnegative().nullable().optional(),
	status: z.enum(accountStatuses).default('active')
});

export const updateCategorySchema = createCategorySchema.partial();

// Transaction Line validation schema
// Note: All amounts in cents/pennies (integers) to avoid floating-point precision errors
export const transactionLineSchema = z.object({
	category_id: z.number().int().positive().nullable().optional(),
	description: z.string().max(1000).nullable().optional(),
	amount_cents: z.number().int(),
	// Multi-currency fields - all in smallest currency unit
	original_amount_cents: z.number().int().nullable().optional(),
	original_currency: z.string().length(3).nullable().optional(),
	// Exchange rate as thousandths (e.g., 0.055 = 55)
	exchange_rate_thousandths: z.number().int().positive().nullable().optional()
}).refine(
	(data) => {
		// If any multi-currency field is provided, all must be provided
		const hasOriginalAmount = data.original_amount_cents !== undefined && data.original_amount_cents !== null;
		const hasOriginalCurrency = data.original_currency !== undefined && data.original_currency !== null;
		const hasExchangeRate = data.exchange_rate_thousandths !== undefined && data.exchange_rate_thousandths !== null;

		if (hasOriginalAmount || hasOriginalCurrency || hasExchangeRate) {
			return hasOriginalAmount && hasOriginalCurrency && hasExchangeRate;
		}
		return true;
	},
	{
		message: 'If using multi-currency, must provide original_amount_cents, original_currency, and exchange_rate_thousandths'
	}
);

// Transaction validation schemas
const transactionObjectSchema = z.object({
	transaction_date: z.coerce.date(),
	posting_date: z.coerce.date().nullable().optional(),
	account_id: z.number().int().positive(),
	counterparty: z.string().min(1).max(255).nullable().optional(),
	total_cents: z.number().int(),
	// Multi-currency support - transaction level
	receipt_currency: z.string().length(3).nullable().optional(),
	receipt_total_cents: z.number().int().nullable().optional(),
	exchange_rate_thousandths: z.number().int().positive().nullable().optional(),
	reference: z.string().max(100).nullable().optional(),
	memo: z.string().max(1000).nullable().optional(),
	status: z.enum(transactionStatuses).default('draft'),
	lines: z.array(transactionLineSchema).min(1)
});

const baseTransactionSchema = transactionObjectSchema.refine(
	(data) => {
		// If any multi-currency field is provided, all must be provided
		const hasCurrency = data.receipt_currency !== undefined && data.receipt_currency !== null && data.receipt_currency !== '';
		const hasReceiptTotal = data.receipt_total_cents !== undefined && data.receipt_total_cents !== null && data.receipt_total_cents > 0;
		const hasExchangeRate = data.exchange_rate_thousandths !== undefined && data.exchange_rate_thousandths !== null && data.exchange_rate_thousandths > 0;

		if (hasCurrency || hasReceiptTotal || hasExchangeRate) {
			return hasCurrency && hasReceiptTotal && hasExchangeRate;
		}
		return true;
	},
	{
		message: 'If using multi-currency, must provide receipt_currency, receipt_total_cents, and exchange_rate_thousandths'
	}
);

export const createTransactionSchema = baseTransactionSchema.refine(
	(data) => {
		// For multi-currency transactions, validate line amounts sum to receipt total
		const hasCurrency = data.receipt_currency && data.receipt_currency.trim();
		if (hasCurrency && data.receipt_total_cents) {
			const lineSum = data.lines.reduce((sum, line) => sum + line.amount_cents, 0);
			return lineSum === data.receipt_total_cents;
		}

		// For same-currency transactions, validate line amounts sum to total_cents
		const lineSum = data.lines.reduce((sum, line) => sum + line.amount_cents, 0);
		return lineSum === data.total_cents;
	},
	{
		message: 'Sum of transaction line amounts must equal transaction total (or receipt total for multi-currency)'
	}
);

export const updateTransactionSchema = transactionObjectSchema.partial();

// Tag validation schemas
export const createTagSchema = z.object({
	name: z.string().min(1).max(100),
	color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional()
});

export const updateTagSchema = createTagSchema.partial();

// Query parameter validation
export const listQuerySchema = z.object({
	page: z.coerce.number().int().positive().default(1),
	limit: z.coerce.number().int().positive().max(10000000).default(50),
	sort: z.string().optional(),
	order: z.enum(['asc', 'desc']).default('asc')
});

export const accountFilterSchema = listQuerySchema.extend({
	type: z.enum(accountTypes).optional(),
	status: z.enum(accountStatuses).optional(),
	parent_id: z.coerce.number().int().positive().optional()
});

export const categoryFilterSchema = listQuerySchema.extend({
	type: z.enum(accountTypes).optional(),
	status: z.enum(accountStatuses).optional(),
	parent_id: z.coerce.number().int().positive().optional()
});

export const
transactionFilterSchema = listQuerySchema.extend({
	status: z.enum(transactionStatuses).optional(),
	from_date: z.coerce.date().optional(),
	to_date: z.coerce.date().optional(),
	category: z.string().optional(),
	tag: z.string().optional(),
	account: z.string().optional(),
	counterparty: z.string().optional(),
	line_level_filter: z.coerce.boolean().optional(),
	filter_expr: z.string().optional() // JSON-encoded filter expression tree
});

// Auth validation schemas
export const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8)
});

export const createUserSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	name: z.string().min(1).max(255)
});
