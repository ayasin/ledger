import { eq, desc, asc, count } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { tags, type Tag, type NewTag } from '$lib/server/db/schema';
import type { ListOptions } from '$lib/types/api';

export interface TagFilter extends ListOptions {}

export class TagRepository {
	constructor(private db: Database) {}

	async findAll(filter: TagFilter = {}) {
		const { page = 1, limit = 50, sort = 'name', order = 'asc' } = filter;
		const offset = (page - 1) * limit;

		const orderByColumn = tags.name;
		const orderFn = order === 'desc' ? desc : asc;

		const items = this.db
			.select()
			.from(tags)
			.orderBy(orderFn(orderByColumn))
			.limit(limit)
			.offset(offset)
			.all();

		const [{ value: total }] = this.db
			.select({ value: count() })
			.from(tags)
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

	async findById(id: number): Promise<Tag | undefined> {
		return this.db.select().from(tags).where(eq(tags.id, id)).limit(1).get();
	}

	async create(data: NewTag): Promise<Tag> {
		const [result] = this.db.insert(tags).values(data).returning().all();
		return result;
	}

	async update(id: number, data: Partial<NewTag>): Promise<Tag | undefined> {
		const [result] = this.db.update(tags).set(data).where(eq(tags.id, id)).returning().all();
		return result;
	}

	async delete(id: number): Promise<boolean> {
		const result = this.db.delete(tags).where(eq(tags.id, id)).run();
		return result.changes > 0;
	}
}
