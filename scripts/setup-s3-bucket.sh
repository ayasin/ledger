#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# S3 Backup Bucket Setup Script
# =============================================================================
# This script creates a secure S3 bucket for ledger database backups.
#
# REQUIREMENTS:
#   - AWS CLI installed and configured with sufficient permissions
#   - A globally unique bucket name
#
# EXAMPLE USAGE:
#   AWS_REGION=us-east-1 \
#   BUCKET_NAME=my-ledger-backups-123 \
#   BUCKET_PREFIX=accounting/backups \
#   ENABLE_VERSIONING=true \
#   ./scripts/setup-s3-bucket.sh
# =============================================================================

AWS_REGION="${AWS_REGION:-us-east-1}"
BUCKET_NAME="${BUCKET_NAME:-}"
BUCKET_PREFIX="${BUCKET_PREFIX:-accounting/backups}"
ENABLE_VERSIONING="${ENABLE_VERSIONING:-true}"
ENABLE_LIFECYCLE="${ENABLE_LIFECYCLE:-true}"

if [ -z "$BUCKET_NAME" ]; then
  echo "ERROR: BUCKET_NAME environment variable is required."
  echo "Example: BUCKET_NAME=my-ledger-backups-123 ./scripts/setup-s3-bucket.sh"
  exit 1
fi

echo "============================================"
echo "S3 Backup Bucket Setup"
echo "============================================"
echo "Bucket Name:    $BUCKET_NAME"
echo "Region:         $AWS_REGION"
echo "Prefix:         $BUCKET_PREFIX"
echo "Versioning:     $ENABLE_VERSIONING"
echo "Lifecycle:      $ENABLE_LIFECYCLE"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# ---------------------------------------------------------------------------
# 1. Create the bucket
# ---------------------------------------------------------------------------
echo ""
echo "[1/5] Creating S3 bucket..."

if [ "$AWS_REGION" == "us-east-1" ]; then
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$AWS_REGION" || true
else
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$AWS_REGION" \
    --create-bucket-configuration LocationConstraint="$AWS_REGION" || true
fi

# Block all public access
echo "[2/5] Blocking public access..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# ---------------------------------------------------------------------------
# 2. Enable server-side encryption (AES256)
# ---------------------------------------------------------------------------
echo "[3/5] Enabling server-side encryption..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [
      {
        "ApplyServerSideEncryptionByDefault": {
          "SSEAlgorithm": "AES256"
        },
        "BucketKeyEnabled": true
      }
    ]
  }'

# ---------------------------------------------------------------------------
# 3. Enable versioning (optional but recommended)
# ---------------------------------------------------------------------------
if [ "$ENABLE_VERSIONING" == "true" ]; then
  echo "[4/5] Enabling versioning..."
  aws s3api put-bucket-versioning \
    --bucket "$BUCKET_NAME" \
    --versioning-configuration Status=Enabled
else
  echo "[4/5] Skipping versioning (set ENABLE_VERSIONING=true to enable)"
fi

# ---------------------------------------------------------------------------
# 4. Lifecycle policy to expire old versions (optional)
# ---------------------------------------------------------------------------
if [ "$ENABLE_LIFECYCLE" == "true" ]; then
  echo "[5/5] Applying lifecycle policy..."
  aws s3api put-bucket-lifecycle-configuration \
    --bucket "$BUCKET_NAME" \
    --lifecycle-configuration '{
      "Rules": [
        {
          "ID": "ExpireOldVersions",
          "Status": "Enabled",
          "Filter": {},
          "NoncurrentVersionExpiration": {
            "NoncurrentDays": 30
          }
        }
      ]
    }'
else
  echo "[5/5] Skipping lifecycle policy (set ENABLE_LIFECYCLE=true to enable)"
fi

echo ""
echo "============================================"
echo "S3 bucket setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Create an IAM user for backups (see iam-policy.json)"
echo "  2. Add credentials to your environment:"
echo "     export AWS_ACCESS_KEY_ID=..."
echo "     export AWS_SECRET_ACCESS_KEY=..."
echo "  3. Update your .env file with:"
echo "     S3_REGION=$AWS_REGION"
echo "     S3_BUCKET=$BUCKET_NAME"
echo "     S3_PREFIX=$BUCKET_PREFIX"
echo ""
