import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { UserRepository } from '$lib/server/repositories/users';
import { AuthService } from '$lib/server/services/auth';
import { loginSchema } from '$lib/server/services/validation';
import { ZodError } from 'zod';

export const POST: RequestHandler = async ({ locals, request }) => {
	try {
		const body = await request.json();
		const { email, password } = loginSchema.parse(body);

		const userRepo = new UserRepository(locals.db);
		const user = await userRepo.findByEmail(email);

		if (!user || !user.is_active) {
			return json({ error: { message: 'Invalid credentials' } }, { status: 401 });
		}

		const authService = new AuthService();
		const isValid = await authService.verifyPassword(password, user.password_hash);

		if (!isValid) {
			return json({ error: { message: 'Invalid credentials' } }, { status: 401 });
		}

		const token = await authService.generateToken(user);

		return json({
			data: {
				token,
				user: {
					id: user.id,
					email: user.email,
					name: user.name
				}
			}
		});
	} catch (error) {
		if (error instanceof ZodError) {
			return json(
				{
					error: {
						message: 'Validation failed',
						details: error.issues
					}
				},
				{ status: 400 }
			);
		}

		return json({ error: { message: 'Login failed' } }, { status: 500 });
	}
};
