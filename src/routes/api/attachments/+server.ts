import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AttachmentRepository } from '$lib/server/repositories/attachments';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';

const UPLOAD_DIR = './data/uploads';

// Ensure upload directory exists
async function ensureUploadDir() {
	if (!existsSync(UPLOAD_DIR)) {
		await mkdir(UPLOAD_DIR, { recursive: true });
	}
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		await ensureUploadDir();

		const formData = await request.formData();
		const file = formData.get('file') as File | null;
		const transactionId = formData.get('transaction_id') as string | null;
		const description = formData.get('description') as string | null;

		if (!file) {
			return json(
				{
					error: {
						message: 'No file provided'
					}
				},
				{ status: 400 }
			);
		}

		if (!transactionId) {
			return json(
				{
					error: {
						message: 'Transaction ID is required'
					}
				},
				{ status: 400 }
			);
		}

		// Generate unique filename
		const ext = file.name.split('.').pop() || '';
		const uniqueName = `${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
		const filePath = join(UPLOAD_DIR, uniqueName);

		// Save file to disk
		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filePath, buffer);

		// Create attachment record
		const repo = new AttachmentRepository(locals.db);
		const attachment = await repo.create({
			transaction_id: parseInt(transactionId, 10),
			filename: file.name,
			file_path: filePath,
			file_size: file.size,
			mime_type: file.type,
			description: description || null
		});

		return json({ data: attachment }, { status: 201 });
	} catch (error) {
		console.error('Failed to upload file:', error);
		return json(
			{
				error: {
					message: 'Failed to upload file',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};
