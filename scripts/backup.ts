#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { performBackup, type BackupConfig } from './backup-lib.js';

// Load environment variables
dotenv.config();

/**
 * Log message with timestamp
 */
function log(message: string): void {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Main backup execution
 */
async function main(): Promise<void> {
  try {
    // Get configuration from environment variables
    const dbPath = resolve(process.env.DATABASE_URL || './data/accounting.db');
    const backupDir = resolve(process.env.BACKUP_DIR || './data/backups');
    const maxBackups = parseInt(process.env.BACKUP_MAX_BACKUPS || '12', 10);

    // Validate configuration
    if (maxBackups < 1) {
      throw new Error('BACKUP_MAX_BACKUPS must be at least 1');
    }

    log(`Starting backup...`);
    log(`Database: ${dbPath}`);
    log(`Backup directory: ${backupDir}`);
    log(`Max backups: ${maxBackups}`);

    // Perform backup
    const config: BackupConfig = {
      dbPath,
      backupDir,
      maxBackups
    };

    const result = await performBackup(config);

    // Log result
    log(result.message);

    // Exit with appropriate code
    if (result.status === 'skipped') {
      process.exit(0);
    } else if (result.status === 'success') {
      process.exit(1);
    } else {
      // Error
      if (result.error) {
        console.error(`Error details:`, result.error);
      }
      process.exit(2);
    }
  } catch (error) {
    console.error(`Fatal error:`, error);
    process.exit(2);
  }
}

// Run main function
main();
