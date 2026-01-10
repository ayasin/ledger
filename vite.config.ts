import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		fs: {
			strict: false
		},
		port: 1815,
		strictPort: true,
		allowedHosts: ['yasin.ngrok.io']
	},
	logLevel: 'info',
	clearScreen: false
});
