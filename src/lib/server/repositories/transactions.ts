import { eq, and, desc, asc, count, gte, lte, inArray, like, isNull, notInArray } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import {
	transactions,
	transactionLines,
	accounts,
	categories,
	tags,
	transactionTags,
	type Transaction,
	type NewTransaction,
	type TransactionLine
} from '$lib/server/db/schema';
import type { ListOptions } from '$lib/types/api';
import type { TransactionLineInput } from '$lib/server/services/accounting';

export interface TransactionFilter extends ListOptions {
	status?: string;
	from_date?: Date;
	to_date?: Date;
	category?: string;
	tag?: string;
	account?: string;
	counterparty?: string;
	line_level_filter?: boolean; // When true, filter lines within transactions
	filter_expr?: string; // JSON-encoded filter expression tree
}

// Filter expression tree node (matches queryParser.ts)
interface FilterNode {
	type: 'filter' | 'group';
	field?: 'category' | 'tag' | 'account' | 'counterparty';
	value?: string;
	operator?: 'and' | 'or';
	children?: FilterNode[];
}

export interface TransactionWithLines extends Transaction {
	lines: TransactionLine[];
	tags?: Array<{
		id: number;
		name: string;
		color: string | null;
	}>;
}

export class TransactionRepository {
	constructor(private db: Database) {}

	async findAll(filter: TransactionFilter = {}) {
		const {
			page = 1,
			limit = filter.limit || 50,
			sort = 'transaction_date',
			order = 'desc',
			status,
			from_date,
			to_date,
			category,
			tag,
			account,
			line_level_filter = false,
			filter_expr
		} = filter;
		const offset = (page - 1) * limit;

		// Parse filter expression if provided
		let filterTree: FilterNode | undefined;
		if (filter_expr) {
			try {
				filterTree = JSON.parse(filter_expr);
			} catch (e) {
				console.error('Failed to parse filter_expr:', e);
			}
		}

		const conditions = [];
		if (status) conditions.push(eq(transactions.status, status as any));
		if (from_date) conditions.push(gte(transactions.transaction_date, from_date));
		if (to_date) conditions.push(lte(transactions.transaction_date, to_date));

		// Determine transaction IDs from filters
		let filteredTransactionIds: number[] | null = null;

		if (filterTree) {
			// Use new filter tree evaluation
			filteredTransactionIds = this.evaluateFilterTree(filterTree);
			if (filteredTransactionIds.length === 0) {
				return { items: [], meta: { total: 0, page, limit, pages: 0 } };
			}
			conditions.push(inArray(transactions.id, filteredTransactionIds));
		} else {
			// Legacy filter logic for backward compatibility
			// Filter by account name
			if (account) {
			const matchingAccounts = this.db
				.select({ id: accounts.id })
				.from(accounts)
				.where(like(accounts.name, `%${account}%`))
				.all();

			if (matchingAccounts.length > 0) {
				conditions.push(inArray(transactions.account_id, matchingAccounts.map(a => a.id)));
			} else {
				// No matching accounts - return empty result
				return { items: [], meta: { total: 0, page, limit, pages: 0 } };
			}
		}

		// Filter by category name
		let transactionIdsFromCategory: number[] | null = null;
		if (category) {
			// Check for empty/null category filter
			if (category === '~empty~') {
				// Find transactions with lines that have null category_id
				const linesWithoutCategory = this.db
					.select({ transaction_id: transactionLines.transaction_id })
					.from(transactionLines)
					.where(isNull(transactionLines.category_id))
					.all();

				transactionIdsFromCategory = [...new Set(linesWithoutCategory.map(l => l.transaction_id))];

				if (transactionIdsFromCategory.length === 0) {
					return { items: [], meta: { total: 0, page, limit, pages: 0 } };
				}
			} else {
				// Normal category name filtering
				const matchingCategories = this.db
					.select({ id: categories.id })
					.from(categories)
					.where(like(categories.name, `%${category}%`))
					.all();

				if (matchingCategories.length > 0) {
					const categoryIds = matchingCategories.map(c => c.id).filter((id): id is number => id !== null && id !== undefined);

					if (categoryIds.length > 0) {
						const linesWithCategory = this.db
							.select({ transaction_id: transactionLines.transaction_id })
							.from(transactionLines)
							.where(inArray(transactionLines.category_id, categoryIds))
							.all();

						transactionIdsFromCategory = [...new Set(linesWithCategory.map(l => l.transaction_id))];

						if (transactionIdsFromCategory.length === 0) {
							return { items: [], meta: { total: 0, page, limit, pages: 0 } };
						}
					} else {
						return { items: [], meta: { total: 0, page, limit, pages: 0 } };
					}
				} else {
					return { items: [], meta: { total: 0, page, limit, pages: 0 } };
				}
			}
		}

		// Filter by tag name
		let transactionIdsFromTag: number[] | null = null;
		if (tag) {
			// Check for empty/null tag filter
			if (tag === '~empty~') {
				// Find all transaction IDs
				const allTransactions = this.db
					.select({ id: transactions.id })
					.from(transactions)
					.all();

				// Find transactions that have tags
				const txWithTags = this.db
					.select({ transaction_id: transactionTags.transaction_id })
					.from(transactionTags)
					.all();

				const txIdsWithTags = new Set(txWithTags.map(t => t.transaction_id));

				// Filter for transactions without any tags
				transactionIdsFromTag = allTransactions
					.map(t => t.id)
					.filter(id => !txIdsWithTags.has(id));

				if (transactionIdsFromTag.length === 0) {
					return { items: [], meta: { total: 0, page, limit, pages: 0 } };
				}
			} else {
				// Normal tag name filtering
				const matchingTags = this.db
					.select({ id: tags.id })
					.from(tags)
					.where(like(tags.name, `%${tag}%`))
					.all();

				if (matchingTags.length > 0) {
					const txWithTag = this.db
						.select({ transaction_id: transactionTags.transaction_id })
						.from(transactionTags)
						.where(inArray(transactionTags.tag_id, matchingTags.map(t => t.id)))
						.all();

					transactionIdsFromTag = [...new Set(txWithTag.map(t => t.transaction_id))];

					if (transactionIdsFromTag.length === 0) {
						return { items: [], meta: { total: 0, page, limit, pages: 0 } };
					}
				} else {
					return { items: [], meta: { total: 0, page, limit, pages: 0 } };
				}
			}
		}

			// Combine category and tag filters (intersection)
			if (transactionIdsFromCategory !== null && transactionIdsFromTag !== null) {
				const intersectionIds = transactionIdsFromCategory.filter(id => transactionIdsFromTag!.includes(id));
				if (intersectionIds.length > 0) {
					conditions.push(inArray(transactions.id, intersectionIds));
				} else {
					return { items: [], meta: { total: 0, page, limit, pages: 0 } };
				}
			} else if (transactionIdsFromCategory !== null) {
				conditions.push(inArray(transactions.id, transactionIdsFromCategory));
			} else if (transactionIdsFromTag !== null) {
				conditions.push(inArray(transactions.id, transactionIdsFromTag));
			}
		} // End of legacy filter logic

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderByColumn =
			sort === 'reference' ? transactions.reference : transactions.transaction_date;
		const orderFn = order === 'desc' ? desc : asc;

		const items = this.db
			.select()
			.from(transactions)
			.where(whereClause)
			.orderBy(orderFn(orderByColumn))
			.limit(limit)
			.offset(offset)
			.all();

		const [{ value: total }] = this.db
			.select({ value: count() })
			.from(transactions)
			.where(whereClause)
			.all();

		// Fetch lines and tags for all transactions
		const itemsWithLinesAndTags = items.map((transaction) => {
			// Fetch all lines for this transaction
			let lines = this.db
				.select()
				.from(transactionLines)
				.where(eq(transactionLines.transaction_id, transaction.id))
				.all();

			// Apply line-level filtering if enabled
			if (line_level_filter) {
				if (filterTree) {
					// Use new filter tree evaluation for line-level filtering
					lines = lines.filter(line => this.lineMatchesFilter(line, filterTree));
				} else if (category) {
					// Legacy line-level filtering
					if (category === '~empty~') {
						// Only include lines with null category_id
						lines = lines.filter(line => line.category_id === null);
					} else {
						// Get matching category IDs
						const matchingCategories = this.db
							.select({ id: categories.id })
							.from(categories)
							.where(like(categories.name, `%${category}%`))
							.all();

						const categoryIds = matchingCategories.map(c => c.id);

						// Only include lines that match the category filter
						lines = lines.filter(line =>
							line.category_id !== null && categoryIds.includes(line.category_id)
						);
					}
				}
			}

			// Fetch tags for this transaction
			const transactionTagsData = this.db
				.select({
					tag_id: transactionTags.tag_id,
					tag_name: tags.name,
					tag_color: tags.color
				})
				.from(transactionTags)
				.innerJoin(tags, eq(transactionTags.tag_id, tags.id))
				.where(eq(transactionTags.transaction_id, transaction.id))
				.all();

			return {
				...transaction,
				lines,
				tags: transactionTagsData.map(t => ({
					id: t.tag_id,
					name: t.tag_name,
					color: t.tag_color
				}))
			};
		});

		return {
			items: itemsWithLinesAndTags,
			meta: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit)
			}
		};
	}

	// Evaluate filter tree to get matching transaction IDs
	private evaluateFilterTree(node: FilterNode): number[] {
		if (node.type === 'filter') {
			return this.evaluateFilterNode(node);
		}

		if (node.type === 'group' && node.children && node.children.length > 0) {
			const childResults = node.children.map(child => this.evaluateFilterTree(child));

			if (node.operator === 'or') {
				// Union of all child results
				const unionSet = new Set<number>();
				childResults.forEach(ids => ids.forEach(id => unionSet.add(id)));
				return Array.from(unionSet);
			} else {
				// AND: Intersection of all child results
				if (childResults.length === 0) return [];
				let result = childResults[0];
				for (let i = 1; i < childResults.length; i++) {
					const set = new Set(childResults[i]);
					result = result.filter(id => set.has(id));
				}
				return result;
			}
		}

		return [];
	}

	// Evaluate a single filter node
	private evaluateFilterNode(node: FilterNode): number[] {
		if (node.field === 'category') {
			return this.getCategoryTransactionIds(node.value || '');
		} else if (node.field === 'tag') {
			return this.getTagTransactionIds(node.value || '');
		} else if (node.field === 'account') {
			return this.getAccountTransactionIds(node.value || '');
		} else if (node.field === 'counterparty') {
			return this.getCounterpartyTransactionIds(node.value || '');
		}
		return [];
	}

	// Get transaction IDs matching a category filter
	private getCategoryTransactionIds(categoryValue: string): number[] {
		if (categoryValue === '~empty~') {
			const linesWithoutCategory = this.db
				.select({ transaction_id: transactionLines.transaction_id })
				.from(transactionLines)
				.where(isNull(transactionLines.category_id))
				.all();
			return [...new Set(linesWithoutCategory.map(l => l.transaction_id))];
		}

		const matchingCategories = this.db
			.select({ id: categories.id })
			.from(categories)
			.where(like(categories.name, `%${categoryValue}%`))
			.all();

		if (matchingCategories.length === 0) return [];

		const categoryIds = matchingCategories.map(c => c.id).filter((id): id is number => id !== null && id !== undefined);
		if (categoryIds.length === 0) return [];

		const linesWithCategory = this.db
			.select({ transaction_id: transactionLines.transaction_id })
			.from(transactionLines)
			.where(inArray(transactionLines.category_id, categoryIds))
			.all();

		return [...new Set(linesWithCategory.map(l => l.transaction_id))];
	}

	// Get transaction IDs matching a tag filter
	private getTagTransactionIds(tagValue: string): number[] {
		if (tagValue === '~empty~') {
			const allTransactions = this.db
				.select({ id: transactions.id })
				.from(transactions)
				.all();

			const txWithTags = this.db
				.select({ transaction_id: transactionTags.transaction_id })
				.from(transactionTags)
				.all();

			const txIdsWithTags = new Set(txWithTags.map(t => t.transaction_id));
			return allTransactions.map(t => t.id).filter(id => !txIdsWithTags.has(id));
		}

		const matchingTags = this.db
			.select({ id: tags.id })
			.from(tags)
			.where(like(tags.name, `%${tagValue}%`))
			.all();

		if (matchingTags.length === 0) return [];

		const txWithTag = this.db
			.select({ transaction_id: transactionTags.transaction_id })
			.from(transactionTags)
			.where(inArray(transactionTags.tag_id, matchingTags.map(t => t.id)))
			.all();

		return [...new Set(txWithTag.map(t => t.transaction_id))];
	}

	// Get transaction IDs matching an account filter
	private getAccountTransactionIds(accountValue: string): number[] {
		const matchingAccounts = this.db
			.select({ id: accounts.id })
			.from(accounts)
			.where(like(accounts.name, `%${accountValue}%`))
			.all();

		if (matchingAccounts.length === 0) return [];

		const txWithAccount = this.db
			.select({ id: transactions.id })
			.from(transactions)
			.where(inArray(transactions.account_id, matchingAccounts.map(a => a.id)))
			.all();

		return txWithAccount.map(t => t.id);
	}

	// Get transaction IDs matching a counterparty filter (case-insensitive partial match)
	private getCounterpartyTransactionIds(counterpartyValue: string): number[] {
		if (counterpartyValue === '~empty~') {
			// Find transactions with null or empty counterparty
			const txWithoutCounterparty = this.db
				.select({ id: transactions.id })
				.from(transactions)
				.where(isNull(transactions.counterparty))
				.all();
			return txWithoutCounterparty.map(t => t.id);
		}

		// Case-insensitive partial match using LIKE
		// SQLite LIKE is case-insensitive for ASCII by default
		const txWithCounterparty = this.db
			.select({ id: transactions.id })
			.from(transactions)
			.where(like(transactions.counterparty, `%${counterpartyValue}%`))
			.all();

		return txWithCounterparty.map(t => t.id);
	}

	// Check if a transaction line matches a filter node (for line-level filtering)
	private lineMatchesFilter(line: TransactionLine, node: FilterNode): boolean {
		if (node.type === 'filter') {
			if (node.field === 'category') {
				return this.lineMatchesCategoryFilter(line, node.value || '');
			}
			// Tags and accounts are transaction-level, not line-level
			return true;
		}

		if (node.type === 'group' && node.children && node.children.length > 0) {
			const childResults = node.children.map(child => this.lineMatchesFilter(line, child));

			if (node.operator === 'or') {
				return childResults.some(r => r);
			} else {
				return childResults.every(r => r);
			}
		}

		return false;
	}

	// Check if a line matches a category filter
	private lineMatchesCategoryFilter(line: TransactionLine, categoryValue: string): boolean {
		if (categoryValue === '~empty~') {
			return line.category_id === null;
		}

		const matchingCategories = this.db
			.select({ id: categories.id })
			.from(categories)
			.where(like(categories.name, `%${categoryValue}%`))
			.all();

		const categoryIds = matchingCategories.map(c => c.id);
		return line.category_id !== null && categoryIds.includes(line.category_id);
	}

	async findById(id: number): Promise<TransactionWithLines | null> {
		const transaction = this.db
			.select()
			.from(transactions)
			.where(eq(transactions.id, id))
			.limit(1)
			.get();

		if (!transaction) return null;

		const lines = this.db
			.select()
			.from(transactionLines)
			.where(eq(transactionLines.transaction_id, id))
			.all();

		// Fetch tags for this transaction
		const transactionTagsData = this.db
			.select({
				tag_id: transactionTags.tag_id,
				tag_name: tags.name,
				tag_color: tags.color
			})
			.from(transactionTags)
			.innerJoin(tags, eq(transactionTags.tag_id, tags.id))
			.where(eq(transactionTags.transaction_id, id))
			.all();

		return {
			...transaction,
			lines,
			tags: transactionTagsData.map(t => ({
				id: t.tag_id,
				name: t.tag_name,
				color: t.tag_color
			}))
		};
	}

	async create(data: NewTransaction, lines: TransactionLineInput[]): Promise<TransactionWithLines> {
		// Use transaction to ensure atomicity
		return this.db.transaction((tx) => {
			// Insert transaction
			const [transaction] = tx.insert(transactions).values(data).returning().all();

			// Insert transaction lines
			const linesWithTransactionId = lines.map((line) => ({
				...line,
				transaction_id: transaction.id
			}));

			const createdLines = tx
				.insert(transactionLines)
				.values(linesWithTransactionId)
				.returning()
				.all();

			return {
				...transaction,
				lines: createdLines
			};
		});
	}

	async update(
		id: number,
		data: Partial<NewTransaction>,
		lines?: TransactionLineInput[]
	): Promise<TransactionWithLines | null> {
		return this.db.transaction((tx) => {
			const [transaction] = tx
				.update(transactions)
				.set(data)
				.where(eq(transactions.id, id))
				.returning()
				.all();

			if (!transaction) return null;

			if (lines) {
				tx.delete(transactionLines).where(eq(transactionLines.transaction_id, id)).run();

				const linesWithTransactionId = lines.map((line) => ({
					...line,
					transaction_id: id
				}));

				const createdLines = tx
					.insert(transactionLines)
					.values(linesWithTransactionId)
					.returning()
					.all();

				return {
					...transaction,
					lines: createdLines
				};
			}

			const existingLines = tx
				.select()
				.from(transactionLines)
				.where(eq(transactionLines.transaction_id, id))
				.all();

			return {
				...transaction,
				lines: existingLines
			};
		});
	}

	async delete(id: number): Promise<boolean> {
		const result = this.db.delete(transactions).where(eq(transactions.id, id)).run();
		return result.changes > 0;
	}

	async addTag(transactionId: number, tagId: number): Promise<void> {
		this.db
			.insert(transactionTags)
			.values({
				transaction_id: transactionId,
				tag_id: tagId
			})
			.run();
	}
}
