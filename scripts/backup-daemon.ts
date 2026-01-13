#!/usr/bin/env node
import * as dotenv from 'dotenv';
import cron from 'node-cron';
import { resolve } from 'path';
import { performBackup, type BackupConfig } from './backup-lib.js';

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

/**
 * Run a backup
 */
async function runBackup(config: BackupConfig): Promise<void> {
  if (isShuttingDown) {
    log('WARN', 'Shutdown in progress, skipping scheduled backup');
    return;
  }

  log('INFO', 'Starting scheduled backup');

  currentBackupPromise = performBackup(config)
    .then((result) => {
      if (result.status === 'success') {
        log('INFO', result.message);
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

  log('INFO', 'Backup daemon starting...');
  log('INFO', `Schedule: ${schedule}`);
  log('INFO', `Database: ${dbPath}`);
  log('INFO', `Backup directory: ${backupDir}`);
  log('INFO', `Max backups: ${maxBackups}`);
  log('INFO', `Backup on start: ${backupOnStart}`);

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
  const task = cron.schedule(schedule, () => runBackup(config), {
    scheduled: true,
    timezone: process.env.TZ || 'America/New_York'
  });

  // Setup graceful shutdown
  setupGracefulShutdown(task);

  log('INFO', 'Backup daemon running. Press Ctrl+C to stop.');

  // Run backup immediately on startup if configured
  if (backupOnStart) {
    log('INFO', 'Running initial backup on startup...');
    runBackup(config);
  }
}

// Run main function
main();
