import { eq } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import {
	attachments,
	type Attachment,
	type NewAttachment
} from '$lib/server/db/schema';

export class AttachmentRepository {
	constructor(private db: Database) {}

	async findByTransactionId(transactionId: number): Promise<Attachment[]> {
		return this.db
			.select()
			.from(attachments)
			.where(eq(attachments.transaction_id, transactionId))
			.all();
	}

	async findById(id: number): Promise<Attachment | null> {
		return this.db
			.select()
			.from(attachments)
			.where(eq(attachments.id, id))
			.limit(1)
			.get() || null;
	}

	async create(data: NewAttachment): Promise<Attachment> {
		const [attachment] = this.db
			.insert(attachments)
			.values(data)
			.returning()
			.all();

		return attachment;
	}

	async delete(id: number): Promise<boolean> {
		const result = this.db
			.delete(attachments)
			.where(eq(attachments.id, id))
			.run();

		return result.changes > 0;
	}

	async deleteByTransactionId(transactionId: number): Promise<number> {
		const result = this.db
			.delete(attachments)
			.where(eq(attachments.transaction_id, transactionId))
			.run();

		return result.changes;
	}
}
