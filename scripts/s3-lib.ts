import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import { basename } from 'path';

export interface S3BackupConfig {
  region: string;
  bucket: string;
  prefix?: string;
  endpoint?: string;
  maxBackups: number;
}

function createS3Client(region: string, endpoint?: string): S3Client {
  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: true } : {})
  });
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(
  config: S3BackupConfig,
  filePath: string,
  key?: string
): Promise<string> {
  const client = createS3Client(config.region, config.endpoint);
  const objectKey = key
    ? `${config.prefix ? config.prefix + '/' : ''}${key}`
    : `${config.prefix ? config.prefix + '/' : ''}${basename(filePath)}`;

  const stream = createReadStream(filePath);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: objectKey,
        Body: stream
      })
    );
    return objectKey;
  } finally {
    stream.destroy();
  }
}

/**
 * Rotate old backups in S3, keeping only the most recent maxBackups files
 */
export async function rotateS3Backups(config: S3BackupConfig): Promise<void> {
  const client = createS3Client(config.region, config.endpoint);
  const prefix = config.prefix ? config.prefix + '/' : '';

  // Pattern to match backup files: accounting-YYYY-MM-DD-HH-mm-ss.db
  const backupPattern = /^accounting-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.db$/;

  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix
    })
  );

  const objects = (response.Contents || [])
    .filter((obj) => {
      const fileName = obj.Key?.split('/').pop();
      return fileName ? backupPattern.test(fileName) : false;
    })
    .map((obj) => ({
      key: obj.Key!,
      lastModified: obj.LastModified!.getTime()
    }))
    .sort((a, b) => b.lastModified - a.lastModified); // Newest first

  if (objects.length > config.maxBackups) {
    const toDelete = objects.slice(config.maxBackups);
    for (const obj of toDelete) {
      await client.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: obj.key
        })
      );
    }
  }
}
