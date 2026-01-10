#!/usr/bin/env node

import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { users } from '../src/lib/server/db/schema.js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize database
const dbPath = process.env.DATABASE_URL || './data/accounting.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

const readline = createInterface({ input, output });

/**
 * Read password from stdin without echoing to screen
 * Shows asterisks (*) as user types for feedback
 */
async function readPassword(prompt: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdout.write(prompt);

		let password = '';
		const stdin = process.stdin;

		// Set raw mode to read character by character
		stdin.setRawMode(true);
		stdin.resume();
		stdin.setEncoding('utf8');

		const onData = (char: string) => {
			// Handle different key inputs
			switch (char) {
				case '\n':
				case '\r':
				case '\u0004': // Ctrl+D
					// Enter pressed - finish input
					stdin.setRawMode(false);
					stdin.pause();
					stdin.removeListener('data', onData);
					process.stdout.write('\n');
					resolve(password);
					break;
				case '\u0003': // Ctrl+C
					// Exit on Ctrl+C
					process.stdout.write('\n');
					process.exit(1);
					break;
				case '\u007f': // Backspace (Mac/Linux)
				case '\b': // Backspace (Windows)
					// Remove last character
					if (password.length > 0) {
						password = password.slice(0, -1);
						// Clear the asterisk: move back, write space, move back again
						process.stdout.write('\b \b');
					}
					break;
				default:
					// Regular character - add to password and show asterisk
					if (char.charCodeAt(0) >= 32) { // Printable characters only
						password += char;
						// Move back to overwrite the echoed character with an asterisk
						process.stdout.write('\b*');
					}
					break;
			}
		};

		stdin.on('data', onData);
	});
}

async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 10);
}

async function findUserByEmail(email: string) {
	const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
	return result[0] || null;
}

async function addUser() {
	console.log('\n=== Add New User ===\n');

	const email = await readline.question('Email: ');
	if (!email || !email.includes('@')) {
		console.error('Error: Valid email is required');
		process.exit(1);
	}

	// Check if user already exists
	const existing = await findUserByEmail(email);
	if (existing) {
		console.error(`Error: User with email ${email} already exists`);
		process.exit(1);
	}

	const name = await readline.question('Name: ');
	if (!name) {
		console.error('Error: Name is required');
		process.exit(1);
	}

	const password = await readPassword('Password: ');
	if (!password || password.length < 8) {
		console.error('Error: Password must be at least 8 characters');
		process.exit(1);
	}

	const confirmPassword = await readPassword('Confirm Password: ');
	if (password !== confirmPassword) {
		console.error('Error: Passwords do not match');
		process.exit(1);
	}

	const isActiveInput = await readline.question('Active? (Y/n): ');
	const isActive = isActiveInput.toLowerCase() !== 'n';

	// Hash password and create user
	const passwordHash = await hashPassword(password);
	try {
		const result = await db
			.insert(users)
			.values({
				email,
				name,
				password_hash: passwordHash,
				is_active: isActive
			})
			.returning();

		const user = result[0];

		console.log(`\n✓ User created successfully!`);
		console.log(`  ID: ${user.id}`);
		console.log(`  Email: ${user.email}`);
		console.log(`  Name: ${user.name}`);
		console.log(`  Active: ${user.is_active ? 'Yes' : 'No'}`);
	} catch (error) {
		console.error('Error creating user:', (error as Error).message);
		process.exit(1);
	}
}

async function changePassword() {
	console.log('\n=== Change User Password ===\n');

	const email = await readline.question('User Email: ');
	if (!email) {
		console.error('Error: Email is required');
		process.exit(1);
	}

	const user = await findUserByEmail(email);
	if (!user) {
		console.error(`Error: User with email ${email} not found`);
		process.exit(1);
	}

	console.log(`\nFound user: ${user.name} (${user.email})\n`);

	const newPassword = await readPassword('New Password: ');
	if (!newPassword || newPassword.length < 8) {
		console.error('Error: Password must be at least 8 characters');
		process.exit(1);
	}

	const confirmPassword = await readPassword('Confirm New Password: ');
	if (newPassword !== confirmPassword) {
		console.error('Error: Passwords do not match');
		process.exit(1);
	}

	// Hash new password and update user
	const passwordHash = await hashPassword(newPassword);

	await db
		.update(users)
		.set({
			password_hash: passwordHash,
			updated_at: new Date()
		})
		.where(eq(users.id, user.id));

	console.log(`\n✓ Password changed successfully for ${user.email}`);
}

async function showHelp() {
	console.log(`
User Management CLI

Usage:
  npm run user-cli <command>
  npx tsx scripts/user-cli.ts <command>

Commands:
  add-user          Add a new user
  change-password   Change a user's password
  help              Show this help message

Examples:
  npm run user-cli add-user
  npm run user-cli change-password
`);
}

async function main() {
	const command = process.argv[2];

	try {
		switch (command) {
			case 'add-user':
				await addUser();
				break;
			case 'change-password':
				await changePassword();
				break;
			case 'help':
			case '--help':
			case '-h':
				await showHelp();
				break;
			default:
				console.error(`Unknown command: ${command}\n`);
				await showHelp();
				process.exit(1);
		}
	} catch (error) {
		console.error('\nError:', error instanceof Error ? error.message : error);
		process.exit(1);
	} finally {
		readline.close();
		sqlite.close();
		process.exit(0);
	}
}

main();
