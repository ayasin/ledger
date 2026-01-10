import { eq, and, desc, asc, count, isNull } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { accounts, type Account, type NewAccount } from '$lib/server/db/schema';
import type { ListOptions } from '$lib/types/api';

export interface AccountFilter extends ListOptions {
	type?: string;
	status?: string;
	parent_id?: number | null;
}

export class AccountRepository {
	constructor(private db: Database) {}

	async findAll(filter: AccountFilter = {}) {
		const { page = 1, limit = 50, sort = 'code', order = 'asc', type, status, parent_id } = filter;
		const offset = (page - 1) * limit;

		const conditions = [];
		if (type) conditions.push(eq(accounts.type, type as any));
		if (status) conditions.push(eq(accounts.status, status as any));
		if (parent_id !== undefined) {
			if (parent_id === null) {
				conditions.push(isNull(accounts.parent_id));
			} else {
				conditions.push(eq(accounts.parent_id, parent_id));
			}
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderByColumn = sort === 'name' ? accounts.name : accounts.code;
		const orderFn = order === 'desc' ? desc : asc;

		const items = this.db
			.select()
			.from(accounts)
			.where(whereClause)
			.orderBy(orderFn(orderByColumn))
			.limit(limit)
			.offset(offset)
			.all();

		const [{ value: total }] = this.db
			.select({ value: count() })
			.from(accounts)
			.where(whereClause)
			.all();

		return {
			items,
			meta: {
				total,
				page,
				limit,
				pages: Math.ceil(total / limit)
			}
		};
	}

	async findById(id: number): Promise<Account | null> {
		return this.db.select().from(accounts).where(eq(accounts.id, id)).limit(1).get() || null;
	}

	async findByCode(code: string): Promise<Account | null> {
		return this.db.select().from(accounts).where(eq(accounts.code, code)).limit(1).get() || null;
	}

	async findByType(type: string): Promise<Account[]> {
		return this.db.select().from(accounts).where(eq(accounts.type, type as any)).all();
	}

	async create(data: NewAccount): Promise<Account> {
		const [result] = this.db.insert(accounts).values(data).returning().all() as Account[];
		return result;
	}

	async update(id: number, data: Partial<NewAccount>): Promise<Account | null> {
		const [result] = this.db
			.update(accounts)
			.set(data)
			.where(eq(accounts.id, id))
			.returning()
			.all() as Account[];
		return result || null;
	}

	async delete(id: number): Promise<boolean> {
		const result = this.db.delete(accounts).where(eq(accounts.id, id)).run();
		return result.changes > 0;
	}
}
