// Environment variable handling for both SvelteKit and standalone scripts
import { env } from '$env/dynamic/private';
import * as dotenv from 'dotenv';

// Load dotenv for standalone scripts
dotenv.config();

export const JWT_SECRET = env.JWT_SECRET || process.env.JWT_SECRET || '';
export const JWT_EXPIRES_IN = env.JWT_EXPIRES_IN || process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET || JWT_SECRET.length < 32) {
	throw new Error('JWT_SECRET must be at least 32 characters');
}
