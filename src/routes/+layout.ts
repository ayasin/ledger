import { redirect } from '@sveltejs/kit';
import type { LayoutLoad } from './$types';
import { browser } from '$app/environment';

const PUBLIC_ROUTES = ['/login'];

export const load: LayoutLoad = async ({ url }) => {
	// Only run authentication checks in the browser
	if (browser) {
		const isPublicRoute = PUBLIC_ROUTES.some((route) => url.pathname === route);

		if (!isPublicRoute) {
			const token = localStorage.getItem('auth_token');

			if (!token) {
				throw redirect(303, '/login');
			}
		}
	}

	return {};
};
