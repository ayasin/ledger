import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AttachmentRepository } from '$lib/server/repositories/attachments';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		const id = parseInt(params.id, 10);
		const repo = new AttachmentRepository(locals.db);
		const attachment = await repo.findById(id);

		if (!attachment) {
			return json(
				{
					error: {
						message: 'Attachment not found'
					}
				},
				{ status: 404 }
			);
		}

		// Read file from disk
		if (!existsSync(attachment.file_path)) {
			return json(
				{
					error: {
						message: 'File not found on disk'
					}
				},
				{ status: 404 }
			);
		}

		const fileBuffer = await readFile(attachment.file_path);

		return new Response(fileBuffer, {
			headers: {
				'Content-Type': attachment.mime_type,
				'Content-Disposition': `inline; filename="${attachment.filename}"`,
				'Content-Length': attachment.file_size.toString()
			}
		});
	} catch (error) {
		console.error('Failed to get attachment:', error);
		return json(
			{
				error: {
					message: 'Failed to get attachment',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		const id = parseInt(params.id, 10);
		const repo = new AttachmentRepository(locals.db);
		const attachment = await repo.findById(id);

		if (!attachment) {
			return json(
				{
					error: {
						message: 'Attachment not found'
					}
				},
				{ status: 404 }
			);
		}

		// Delete file from disk
		if (existsSync(attachment.file_path)) {
			await unlink(attachment.file_path);
		}

		// Delete attachment record
		await repo.delete(id);

		return json({ data: { success: true } });
	} catch (error) {
		console.error('Failed to delete attachment:', error);
		return json(
			{
				error: {
					message: 'Failed to delete attachment',
					details: error instanceof Error ? error.message : String(error)
				}
			},
			{ status: 500 }
		);
	}
};
