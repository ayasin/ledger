import type { Database } from '$lib/server/db';
import { users, type User, type NewUser } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export class UserRepository {
	constructor(private db: Database) {}

	async findByEmail(email: string): Promise<User | null> {
		const result = (await this.db
			.select()
			.from(users)
			.where(eq(users.email, email))
			.limit(1)) as User[];
		return result[0] || null;
	}

	async findById(id: number): Promise<User | null> {
		const result = (await this.db.select().from(users).where(eq(users.id, id)).limit(1)) as User[];
		return result[0] || null;
	}

	async create(data: NewUser): Promise<User> {
		const result = (await this.db.insert(users).values(data).returning()) as User[];
		return result[0];
	}
}
