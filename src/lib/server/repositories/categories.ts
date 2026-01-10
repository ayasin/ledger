import { eq, and, desc, asc, count, isNull } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { categories, type Category, type NewCategory } from '$lib/server/db/schema';
import type { ListOptions } from '$lib/types/api';

export interface CategoryFilter extends ListOptions {
	type?: string;
	status?: string;
	parent_id?: number | null;
}

export class CategoryRepository {
	constructor(private db: Database) {}

	async findAll(filter: CategoryFilter = {}) {
		const { page = 1, limit = 50, sort = 'name', order = 'asc', type, status, parent_id } = filter;
		const offset = (page - 1) * limit;

		const conditions = [];
		if (type) conditions.push(eq(categories.type, type as any));
		if (status) conditions.push(eq(categories.status, status as any));
		if (parent_id !== undefined) {
			if (parent_id === null) {
				conditions.push(isNull(categories.parent_id));
			} else {
				conditions.push(eq(categories.parent_id, parent_id));
			}
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		const orderByColumn = categories.name;
		const orderFn = order === 'desc' ? desc : asc;

		const items = this.db
			.select()
			.from(categories)
			.where(whereClause)
			.orderBy(orderFn(orderByColumn))
			.limit(limit)
			.offset(offset)
			.all();

		const [{ value: total }] = this.db
			.select({ value: count() })
			.from(categories)
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

	async findById(id: number): Promise<Category | null> {
		return this.db.select().from(categories).where(eq(categories.id, id)).limit(1).get() || null;
	}

	async findByType(type: string): Promise<Category[]> {
		return this.db.select().from(categories).where(eq(categories.type, type as any)).all();
	}

	async create(data: NewCategory): Promise<Category> {
		const [result] = this.db.insert(categories).values(data).returning().all() as Category[];
		return result;
	}

	async update(id: number, data: Partial<NewCategory>): Promise<Category | null> {
		const [result] = this.db
			.update(categories)
			.set(data)
			.where(eq(categories.id, id))
			.returning()
			.all() as Category[];
		return result || null;
	}

	async delete(id: number): Promise<boolean> {
		const result = this.db.delete(categories).where(eq(categories.id, id)).run();
		return result.changes > 0;
	}
}
