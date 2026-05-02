#!/usr/bin/env node
import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import { performBackup, type BackupConfig } from './backup-lib.js';
import { uploadToS3, rotateS3Backups, type S3BackupConfig } from './s3-lib.js';

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
 * Main offline backup execution
 */
async function main(): Promise<void> {
  try {
    // Get configuration from environment variables
    const dbPath = resolve(process.env.DATABASE_URL || './data/accounting.db');
    const backupDir = resolve(process.env.BACKUP_DIR || './data/backups');
    const maxBackups = parseInt(process.env.BACKUP_MAX_BACKUPS || '12', 10);

    // S3 configuration
    const s3Region = process.env.S3_REGION;
    const s3Bucket = process.env.S3_BUCKET;
    const s3Prefix = process.env.S3_PREFIX;
    const s3Endpoint = process.env.S3_ENDPOINT;
    const s3MaxBackups = parseInt(process.env.S3_MAX_BACKUPS || '30', 10);

    // Validate S3 configuration
    if (!s3Region || !s3Bucket) {
      throw new Error('S3_REGION and S3_BUCKET environment variables are required');
    }

    if (maxBackups < 1) {
      throw new Error('BACKUP_MAX_BACKUPS must be at least 1');
    }

    if (s3MaxBackups < 1) {
      throw new Error('S3_MAX_BACKUPS must be at least 1');
    }

    log('Starting offline backup...');
    log(`Database: ${dbPath}`);
    log(`Backup directory: ${backupDir}`);
    log(`Max local backups: ${maxBackups}`);
    log(`S3 bucket: ${s3Bucket}`);
    log(`S3 region: ${s3Region}`);
    log(`S3 prefix: ${s3Prefix || '(none)'}`);
    log(`S3 endpoint: ${s3Endpoint || '(default)'}`);
    log(`Max S3 backups: ${s3MaxBackups}`);

    // Step 1: Perform local backup
    const localConfig: BackupConfig = {
      dbPath,
      backupDir,
      maxBackups
    };

    const localResult = await performBackup(localConfig);
    log(localResult.message);

    if (localResult.status === 'error') {
      if (localResult.error) {
        console.error('Error details:', localResult.error);
      }
      process.exit(2);
    }

    // If skipped, no new file was created — skip S3 upload
    if (localResult.status === 'skipped') {
      log('No changes detected. Skipping S3 upload.');
      process.exit(0);
    }

    // Step 2: Upload to S3
    if (!localResult.backupFile) {
      throw new Error('Backup succeeded but no backup file was returned');
    }

    const backupPath = join(backupDir, localResult.backupFile);
    const s3Config: S3BackupConfig = {
      region: s3Region,
      bucket: s3Bucket,
      prefix: s3Prefix,
      endpoint: s3Endpoint,
      maxBackups: s3MaxBackups
    };

    log(`Uploading ${localResult.backupFile} to S3...`);
    const s3Key = await uploadToS3(s3Config, backupPath, localResult.backupFile);
    log(`Upload complete: s3://${s3Bucket}/${s3Key}`);

    // Step 3: Rotate S3 backups
    log('Rotating old S3 backups...');
    await rotateS3Backups(s3Config);
    log('S3 rotation complete.');

    log('Offline backup completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(2);
  }
}

// Run main function
main();
