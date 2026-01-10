import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Enums
export const accountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
export const accountStatuses = ['active', 'inactive'] as const;
export const transactionStatuses = ['draft', 'posted', 'void'] as const;

// Users Table - Authentication
export const users = sqliteTable(
	'users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		email: text('email').notNull().unique(),
		password_hash: text('password_hash').notNull(),
		name: text('name').notNull(),
		is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updated_at: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
	},
	(table) => [index('users_email_idx').on(table.email)]
);

// Accounts Table - Chart of Accounts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const accounts: any = sqliteTable(
	'accounts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		code: text('code').notNull().unique(),
		name: text('name').notNull(),
		type: text('type', { enum: accountTypes }).notNull(),
		description: text('description'),
		parent_id: integer('parent_id').references((): any => accounts.id, { onDelete: 'set null' }),
		currency: text('currency').notNull().default('USD'),
		status: text('status', { enum: accountStatuses }).notNull().default('active'),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updated_at: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('accounts_type_idx').on(table.type),
		index('accounts_status_idx').on(table.status),
		index('accounts_parent_id_idx').on(table.parent_id)
	]
);

// Categories Table - Transaction Categorization
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const categories: any = sqliteTable(
	'categories',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull(),
		description: text('description'),
		type: text('type', { enum: accountTypes }),
		parent_id: integer('parent_id').references((): any => categories.id, { onDelete: 'set null' }),
		color: text('color'),
		budget_amount_cents: integer('budget_amount_cents'),
		status: text('status', { enum: accountStatuses }).notNull().default('active'),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updated_at: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('categories_type_idx').on(table.type),
		index('categories_parent_id_idx').on(table.parent_id)
	]
);

// Transactions Table - Transaction Headers
export const transactions = sqliteTable(
	'transactions',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		transaction_date: integer('transaction_date', { mode: 'timestamp' }).notNull(),
		posting_date: integer('posting_date', { mode: 'timestamp' }),
		account_id: integer('account_id')
			.notNull()
			.references(() => accounts.id, { onDelete: 'restrict' }),
		counterparty: text('counterparty'),
		total_cents: integer('total_cents').notNull(),
		// Multi-currency support - transaction level
		receipt_currency: text('receipt_currency'),
		receipt_total_cents: integer('receipt_total_cents'),
		exchange_rate_thousandths: integer('exchange_rate_thousandths'),
		reference: text('reference'),
		memo: text('memo'),
		status: text('status', { enum: transactionStatuses }).notNull().default('draft'),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updated_at: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('transactions_transaction_date_idx').on(table.transaction_date),
		index('transactions_account_id_idx').on(table.account_id),
		index('transactions_status_idx').on(table.status),
		index('transactions_reference_idx').on(table.reference)
	]
);

// Transaction Lines Table - Individual line items for split transactions
// Note: All monetary amounts stored as integers (cents/pennies) to avoid floating-point precision errors
export const transactionLines = sqliteTable(
	'transaction_lines',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		transaction_id: integer('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		category_id: integer('category_id').references(() => categories.id, {
			onDelete: 'set null'
		}),
		description: text('description'),
		// Amount in cents (USD) or smallest currency unit
		amount_cents: integer('amount_cents').notNull(),
		// Multi-currency support - store original amount in smallest unit (e.g., centavos for MXN)
		original_amount_cents: integer('original_amount_cents'),
		original_currency: text('original_currency'),
		// Exchange rate stored as integer with 3 decimal precision (multiply by 1,000)
		// Example: 0.055 MXN->USD stored as 55
		exchange_rate_thousandths: integer('exchange_rate_thousandths'),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updated_at: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('transaction_lines_transaction_id_idx').on(table.transaction_id),
		index('transaction_lines_category_id_idx').on(table.category_id)
	]
);

// Tags Table - Flexible Tagging System
export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull().unique(),
	color: text('color'),
	created_at: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`),
	updated_at: integer('updated_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
		.$onUpdate(() => new Date())
});

// Transaction Tags Table - Many-to-Many Relationship
export const transactionTags = sqliteTable(
	'transaction_tags',
	{
		transaction_id: integer('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		tag_id: integer('tag_id')
			.notNull()
			.references(() => tags.id, { onDelete: 'cascade' }),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(table) => [
		index('transaction_tags_transaction_id_idx').on(table.transaction_id),
		index('transaction_tags_tag_id_idx').on(table.tag_id)
	]
);

// Attachments Table - Document Metadata
export const attachments = sqliteTable(
	'attachments',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		transaction_id: integer('transaction_id')
			.notNull()
			.references(() => transactions.id, { onDelete: 'cascade' }),
		filename: text('filename').notNull(),
		file_path: text('file_path').notNull(),
		file_size: integer('file_size').notNull(),
		mime_type: text('mime_type').notNull(),
		description: text('description'),
		created_at: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`),
		updated_at: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
			.$onUpdate(() => new Date())
	},
	(table) => [
		index('attachments_transaction_id_idx').on(table.transaction_id)
	]
);

// Type exports for use in application code
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type TransactionLine = typeof transactionLines.$inferSelect;
export type NewTransactionLine = typeof transactionLines.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
