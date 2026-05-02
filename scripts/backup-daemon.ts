#!/usr/bin/env node
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import { resolve, join } from 'path';
import { performBackup, type BackupConfig } from './backup-lib.js';
import { uploadToS3, rotateS3Backups, type S3BackupConfig } from './s3-lib.js';

// Load environment variables
dotenv.config();

let isShuttingDown = false;
let currentBackupPromise: Promise<void> | null = null;

/**
 * Log message with timestamp and level
 */
function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, ...args: unknown[]): void {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  if (level === 'ERROR') {
    console.error(logMessage, ...args);
  } else {
    console.log(logMessage, ...args);
  }
}

function buildS3Config(): S3BackupConfig | null {
  const s3Region = process.env.S3_REGION;
  const s3Bucket = process.env.S3_BUCKET;

  if (!s3Region || !s3Bucket) {
    return null;
  }

  const s3MaxBackups = parseInt(process.env.S3_MAX_BACKUPS || '30', 10);
  if (s3MaxBackups < 1) {
    log('WARN', 'S3_MAX_BACKUPS is less than 1, disabling S3 upload');
    return null;
  }

  return {
    region: s3Region,
    bucket: s3Bucket,
    prefix: process.env.S3_PREFIX,
    endpoint: process.env.S3_ENDPOINT,
    maxBackups: s3MaxBackups
  };
}

async function runS3Upload(s3Config: S3BackupConfig, backupDir: string, backupFile: string): Promise<void> {
  const backupPath = join(backupDir, backupFile);

  log('INFO', `Uploading ${backupFile} to S3...`);
  const s3Key = await uploadToS3(s3Config, backupPath, backupFile);
  log('INFO', `Upload complete: s3://${s3Config.bucket}/${s3Key}`);

  log('INFO', 'Rotating old S3 backups...');
  await rotateS3Backups(s3Config);
  log('INFO', 'S3 rotation complete.');
}

/**
 * Run a backup
 */
async function runBackup(config: BackupConfig, s3Config: S3BackupConfig | null): Promise<void> {
  if (isShuttingDown) {
    log('WARN', 'Shutdown in progress, skipping scheduled backup');
    return;
  }

  log('INFO', 'Starting scheduled backup');

  currentBackupPromise = performBackup(config)
    .then(async (result) => {
      if (result.status === 'success') {
        log('INFO', result.message);

        // Upload to S3 if configured and a new file was created
        if (s3Config && result.backupFile) {
          try {
            await runS3Upload(s3Config, config.backupDir, result.backupFile);
          } catch (error) {
            log('ERROR', 'S3 upload failed:', error);
          }
        }
      } else if (result.status === 'skipped') {
        log('INFO', result.message);
      } else {
        log('ERROR', result.message);
        if (result.error) {
          log('ERROR', 'Error details:', result.error);
        }
      }
    })
    .catch((error) => {
      log('ERROR', 'Backup failed with unexpected error:', error);
    })
    .finally(() => {
      currentBackupPromise = null;
    });

  await currentBackupPromise;
}

/**
 * Setup graceful shutdown handlers
 */
function setupGracefulShutdown(task: cron.ScheduledTask): void {
  const shutdown = async (signal: string) => {
    log('INFO', `Received ${signal}, shutting down gracefully...`);
    isShuttingDown = true;
    task.stop();

    if (currentBackupPromise) {
      log('INFO', 'Waiting for current backup to complete (max 30s)...');
      await Promise.race([
        currentBackupPromise,
        new Promise(resolve => setTimeout(resolve, 30000)) // 30s timeout
      ]);
    }

    log('INFO', 'Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

/**
 * Main daemon function
 */
function main(): void {
  // Get configuration from environment variables
  const dbPath = resolve(process.env.DATABASE_URL || './data/accounting.db');
  const backupDir = resolve(process.env.BACKUP_DIR || './data/backups');
  const maxBackups = parseInt(process.env.BACKUP_MAX_BACKUPS || '12', 10);
  const schedule = process.env.BACKUP_SCHEDULE || '0 * * * *'; // Every hour by default
  const backupOnStart = process.env.BACKUP_ON_START === 'true';

  // Build optional S3 config
  const s3Config = buildS3Config();

  log('INFO', 'Backup daemon starting...');
  log('INFO', `Schedule: ${schedule}`);
  log('INFO', `Database: ${dbPath}`);
  log('INFO', `Backup directory: ${backupDir}`);
  log('INFO', `Max backups: ${maxBackups}`);
  log('INFO', `Backup on start: ${backupOnStart}`);

  if (s3Config) {
    log('INFO', 'S3 offline backup: ENABLED');
    log('INFO', `  S3 bucket: ${s3Config.bucket}`);
    log('INFO', `  S3 region: ${s3Config.region}`);
    log('INFO', `  S3 prefix: ${s3Config.prefix || '(none)'}`);
    log('INFO', `  S3 endpoint: ${s3Config.endpoint || '(default)'}`);
    log('INFO', `  Max S3 backups: ${s3Config.maxBackups}`);
  } else {
    log('INFO', 'S3 offline backup: DISABLED (set S3_REGION and S3_BUCKET to enable)');
  }

  // Validate cron expression
  if (!cron.validate(schedule)) {
    log('ERROR', `Invalid cron schedule: ${schedule}`);
    process.exit(1);
  }

  // Validate maxBackups
  if (maxBackups < 1) {
    log('ERROR', 'BACKUP_MAX_BACKUPS must be at least 1');
    process.exit(1);
  }

  const config: BackupConfig = {
    dbPath,
    backupDir,
    maxBackups
  };

  // Schedule the backup task
  const task = cron.schedule(schedule, () => runBackup(config, s3Config), {
    scheduled: true,
    timezone: process.env.TZ || 'America/New_York'
  });

  // Setup graceful shutdown
  setupGracefulShutdown(task);

  log('INFO', 'Backup daemon running. Press Ctrl+C to stop.');

  // Run backup immediately on startup if configured
  if (backupOnStart) {
    log('INFO', 'Running initial backup on startup...');
    runBackup(config, s3Config);
  }
}

// Run main function
main();
