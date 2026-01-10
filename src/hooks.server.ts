import type { Handle, HandleServerError } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { AuthService } from '$lib/server/services/auth';

const PUBLIC_ROUTES = ['/api/auth/login', '/api/health'];

export const handle: Handle = async ({ event, resolve }) => {
	const startTime = Date.now();
	const requestId = crypto.randomUUID();

	event.locals.db = db;
	event.locals.requestId = requestId;
	event.locals.startTime = startTime;

	// Authentication middleware for API routes
	if (event.url.pathname.startsWith('/api/')) {
		const isPublicRoute = PUBLIC_ROUTES.some((route) => event.url.pathname === route);

		if (!isPublicRoute) {
			const authHeader = event.request.headers.get('Authorization');
			const authService = new AuthService();
			const token = authService.extractTokenFromHeader(authHeader);

			if (!token) {
				return new Response(JSON.stringify({ error: { message: 'Authentication required' } }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}

			const payload = await authService.verifyToken(token);

			if (!payload) {
				return new Response(
					JSON.stringify({ error: { message: 'Invalid or expired token' } }),
					{ status: 401, headers: { 'Content-Type': 'application/json' } }
				);
			}

			event.locals.user = payload;
		}
	}

	const response = await resolve(event);
	const duration = Date.now() - startTime;

	if (event.url.pathname.startsWith('/api/')) {
		const userInfo = event.locals.user ? ` [user:${event.locals.user.email}]` : '';
		const statusColor = response.status >= 400 ? '\x1b[31m' : response.status >= 300 ? '\x1b[33m' : '\x1b[32m';
		const reset = '\x1b[0m';
		const timestamp = new Date().toISOString();

		console.log(
			`${timestamp} [${requestId}]${userInfo} ${event.request.method} ${event.url.pathname} - ${statusColor}${response.status}${reset} (${duration}ms)`
		);
	}

	response.headers.set('X-Request-Id', requestId);
	response.headers.set('X-Response-Time', `${duration}ms`);

	return response;
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const errorId = crypto.randomUUID();
	const timestamp = new Date().toISOString();
	const red = '\x1b[31m';
	const reset = '\x1b[0m';

	console.error(`${red}${timestamp} [${errorId}] ERROR in ${event.url.pathname}:${reset}`, error);

	return {
		message: status === 500 ? 'Internal server error' : message,
		code: errorId
	};
};
