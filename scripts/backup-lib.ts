import Database from 'better-sqlite3';
import { createHash } from 'crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  renameSync,
  statSync,
  copyFileSync
} from 'fs';
import { resolve, join } from 'path';

export interface BackupConfig {
  dbPath: string;
  backupDir: string;
  maxBackups: number;
  hashFile?: string;
}

export interface BackupResult {
  status: 'success' | 'skipped' | 'error';
  message: string;
  backupFile?: string;
  error?: Error;
}

/**
 * Calculate SHA256 hash of a file
 */
export function calculateFileHash(filePath: string): string {
  const fileBuffer = readFileSync(filePath);
  const hashSum = createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Checkpoint the WAL file to ensure all data is in the main database
 */
export function checkpointWAL(dbPath: string): void {
  const db = new Database(dbPath);
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    db.close();
  }
}

/**
 * Verify that a backup file is a valid SQLite database
 */
export function verifyBackup(backupPath: string): void {
  const db = new Database(backupPath, { readonly: true });
  try {
    // Try to query sqlite_master to verify the database is readable
    const result = db.prepare('SELECT COUNT(*) as count FROM sqlite_master').get() as { count: number };
    if (typeof result.count !== 'number') {
      throw new Error('Backup verification failed: unable to query database');
    }
  } finally {
    db.close();
  }
}

/**
 * Rotate backups, keeping only the most recent maxBackups files
 */
export function rotateBackups(dir: string, maxBackups: number): void {
  // Pattern to match backup files: accounting-YYYY-MM-DD-HH-mm-ss.db
  const backupPattern = /^accounting-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/;

  // Get all backup files
  const files = readdirSync(dir)
    .filter(file => backupPattern.test(file))
    .map(file => ({
      name: file,
      path: join(dir, file),
      mtime: statSync(join(dir, file)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime); // Sort by modification time, newest first

  // Delete old backups if we have more than maxBackups
  if (files.length > maxBackups) {
    const filesToDelete = files.slice(maxBackups);
    for (const file of filesToDelete) {
      unlinkSync(file.path);
    }
  }
}

/**
 * Perform a database backup with change detection
 */
export async function performBackup(config: BackupConfig): Promise<BackupResult> {
  const { dbPath, backupDir, maxBackups, hashFile = join(backupDir, '.last-backup-hash') } = config;

  try {
    // Ensure database exists
    if (!existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`);
    }

    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    // Checkpoint WAL to ensure all data is in the main database file
    checkpointWAL(dbPath);

    // Calculate current database hash
    const currentHash = calculateFileHash(dbPath);

    // Check if database has changed
    let lastHash: string | null = null;
    if (existsSync(hashFile)) {
      try {
        lastHash = readFileSync(hashFile, 'utf8').trim();
      } catch (error) {
        // If hash file is corrupted, treat as first backup
        lastHash = null;
      }
    }

    if (currentHash === lastHash) {
      return {
        status: 'skipped',
        message: 'No changes detected. Skipping backup.'
      };
    }

    // Generate backup filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/T/, '-')
      .replace(/:/g, '-')
      .split('.')[0]; // Format: YYYY-MM-DD-HH-mm-ss
    const backupFilename = `accounting-${timestamp}.db`;
    const backupPath = join(backupDir, backupFilename);
    const tempPath = `${backupPath}.tmp`;

    // Perform backup using file copy (WAL is already checkpointed)
    copyFileSync(dbPath, tempPath);

    // Verify backup integrity
    verifyBackup(tempPath);

    // Atomically move to final location
    renameSync(tempPath, backupPath);

    // Update hash file
    writeFileSync(hashFile, currentHash, 'utf8');

    // Rotate old backups
    rotateBackups(backupDir, maxBackups);

    return {
      status: 'success',
      message: `Backup created: ${backupFilename}`,
      backupFile: backupFilename
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
      error: error instanceof Error ? error : new Error(String(error))
    };
  }
}
