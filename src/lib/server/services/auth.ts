import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcrypt';
import { JWT_SECRET, JWT_EXPIRES_IN } from '$lib/server/env';
import type { User } from '$lib/server/db/schema';

const secret = new TextEncoder().encode(JWT_SECRET);

export interface JWTPayload {
	userId: number;
	email: string;
	name: string;
	[key: string]: unknown;
}

export class AuthService {
	/**
	 * Hash password using bcrypt
	 */
	async hashPassword(password: string): Promise<string> {
		return bcrypt.hash(password, 10);
	}

	/**
	 * Verify password against hash
	 */
	async verifyPassword(password: string, hash: string): Promise<boolean> {
		return bcrypt.compare(password, hash);
	}

	/**
	 * Generate JWT token for user
	 */
	async generateToken(user: Pick<User, 'id' | 'email' | 'name'>): Promise<string> {
		const payload: JWTPayload = {
			userId: user.id,
			email: user.email,
			name: user.name
		};

		const token = await new SignJWT(payload)
			.setProtectedHeader({ alg: 'HS256' })
			.setIssuedAt()
			.setExpirationTime(JWT_EXPIRES_IN || '7d')
			.sign(secret);

		return token;
	}

	/**
	 * Verify JWT token and extract payload
	 */
	async verifyToken(token: string): Promise<JWTPayload | null> {
		try {
			const { payload } = await jwtVerify(token, secret);
			return payload as unknown as JWTPayload;
		} catch {
			return null;
		}
	}

	/**
	 * Extract Bearer token from Authorization header
	 */
	extractTokenFromHeader(authHeader: string | null): string | null {
		if (!authHeader?.startsWith('Bearer ')) {
			return null;
		}
		return authHeader.substring(7);
	}
}
