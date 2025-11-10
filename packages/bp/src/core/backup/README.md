# S3 Backup Service

This service provides automated backup and restore functionality for Botpress bot configurations to AWS S3.

## Features

- ✅ Backup individual bots or all bots to S3
- ✅ Restore bots from S3 backups
- ✅ List available backups for each bot
- ✅ Scheduled automatic backups
- ✅ Manual backup via REST API
- ✅ Backup metadata tracking
- ✅ Server-side encryption (AES256)

## Configuration

Add the following configuration to your `botpress.config.json`:

```json
{
  "s3Backup": {
    "enabled": true,
    "bucket": "my-botpress-backups",
    "region": "us-east-1",
    "accessKeyId": "YOUR_AWS_ACCESS_KEY_ID",
    "secretAccessKey": "YOUR_AWS_SECRET_ACCESS_KEY",
    "prefix": "production",
    "scheduledBackupInterval": "24h"
  }
}
```

### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `enabled` | boolean | Yes | Enable/disable the S3 backup service |
| `bucket` | string | Yes | S3 bucket name for storing backups |
| `region` | string | No | AWS region (defaults to `us-east-1` or `AWS_REGION` env var) |
| `accessKeyId` | string | No | AWS access key (uses env var `AWS_ACCESS_KEY_ID` if not provided) |
| `secretAccessKey` | string | No | AWS secret key (uses env var `AWS_SECRET_ACCESS_KEY` if not provided) |
| `prefix` | string | No | Prefix for backup paths in S3 (optional) |
| `autoBackupOnChanges` | boolean | No | Enable automatic backup when bot files change (default: false) |
| `backupDebounceTime` | number | No | Milliseconds to wait after last change before backing up (default: 30000) |
| `scheduledBackupInterval` | string | No | Automatic backup interval (e.g., "1h", "24h", "7d") |

### Using Environment Variables

Instead of storing credentials in the config file, you can use environment variables:

```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
```

Then your config can be simpler:

```json
{
  "s3Backup": {
    "enabled": true,
    "bucket": "my-botpress-backups",
    "scheduledBackupInterval": "24h"
  }
}
```

## S3 Bucket Structure

Backups are stored in the following structure:

```
s3://my-bucket/
├── [prefix]/
│   └── backups/
│       ├── bot1/
│       │   ├── latest.json (pointer to latest backup)
│       │   ├── 2025-11-03T10-30-00-000Z/
│       │   │   ├── _metadata.json
│       │   │   ├── bot.config.json
│       │   │   ├── flows/
│       │   │   ├── actions/
│       │   │   └── ...
│       │   └── 2025-11-02T10-30-00-000Z/
│       │       └── ...
│       └── bot2/
│           └── ...
```

## REST API Endpoints

All endpoints require authentication and admin permissions.

### Check Backup Status

```http
GET /api/v1/admin/backup/status
```

Response:
```json
{
  "enabled": true
}
```

### Backup a Single Bot

```http
POST /api/v1/admin/backup/bots/:botId
```

Response:
```json
{
  "message": "Backup completed for bot: my-bot"
}
```

### Backup All Bots

```http
POST /api/v1/admin/backup/all
```

Response:
```json
{
  "message": "Backup completed for all bots"
}
```

### List Backups for a Bot

```http
GET /api/v1/admin/backup/bots/:botId/list
```

Response:
```json
{
  "backups": [
    "2025-11-03T10-30-00-000Z",
    "2025-11-02T10-30-00-000Z",
    "2025-11-01T10-30-00-000Z"
  ]
}
```

### Restore a Bot

Restore from latest backup:
```http
POST /api/v1/admin/backup/bots/:botId/restore
Content-Type: application/json

{}
```

Restore from specific backup:
```http
POST /api/v1/admin/backup/bots/:botId/restore
Content-Type: application/json

{
  "timestamp": "2025-11-02T10-30-00-000Z"
}
```

Response:
```json
{
  "message": "Restore completed for bot: my-bot"
}
```

### Delete a Backup

```http
DELETE /api/v1/admin/backup/bots/:botId/:timestamp
```

Response:
```json
{
  "message": "Backup deleted: 2025-11-02T10-30-00-000Z"
}
```

## Programmatic Usage

You can also use the service programmatically in your code:

```typescript
import { S3BackupService } from 'core/backup'

// Inject via dependency injection
class MyService {
  constructor(
    @inject(TYPES.S3BackupService) private backupService: S3BackupService
  ) {}

  async backupMyBot() {
    await this.backupService.backupBot('my-bot-id')
  }

  async restoreMyBot() {
    // Restore from latest
    await this.backupService.restoreBot('my-bot-id')
    
    // Or restore from specific timestamp
    await this.backupService.restoreBot('my-bot-id', '2025-11-02T10-30-00-000Z')
  }

  async listBackups() {
    const backups = await this.backupService.listBotBackups('my-bot-id')
    return backups
  }
}
```

## Scheduled Backups

When `scheduledBackupInterval` is configured, the service will automatically backup all bots at the specified interval.

Examples:
- `"1h"` - Every hour
- `"6h"` - Every 6 hours
- `"24h"` - Daily
- `"7d"` - Weekly

The first backup runs 1 minute after server startup, then continues at the specified interval.

## AWS IAM Permissions

Your AWS user/role needs the following S3 permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-botpress-backups",
        "arn:aws:s3:::my-botpress-backups/*"
      ]
    }
  ]
}
```

## Backup Contents

Each backup includes:

1. **Bot Configuration** (`bot.config.json`)
2. **Flows** (all flow definitions)
3. **Actions** (custom actions)
4. **Content Elements** (content types and elements)
5. **Intents** (NLU intents)
6. **Entities** (NLU entities)
7. **QnA** (Q&A pairs)
8. **Metadata** (`_metadata.json` with backup info)

## Troubleshooting

### Service Not Enabled

If you see "S3 Backup Service is not enabled", check:
- `enabled: true` in config
- Valid `bucket` name configured
- AWS credentials are correct
- S3 bucket exists and is accessible

### Connection Errors

If backups fail with connection errors:
- Verify AWS credentials
- Check bucket name and region
- Ensure IAM permissions are correct
- Test bucket access with AWS CLI: `aws s3 ls s3://my-bucket`

### Restore Issues

If restore fails:
- Check that backup exists: `GET /api/v1/admin/backup/bots/:botId/list`
- Verify bot is not locked
- Check server logs for detailed error messages

## Best Practices

1. **Use separate buckets** for different environments (dev, staging, production)
2. **Enable S3 versioning** on your backup bucket for extra protection
3. **Set up S3 lifecycle policies** to automatically delete old backups
4. **Use IAM roles** instead of access keys when running on AWS (EC2, ECS, etc.)
5. **Test restore** regularly to ensure backups are working
6. **Monitor backup logs** for any failures
7. **Use prefix** to organize backups by environment or region

## Example Lifecycle Policy

Set this on your S3 bucket to automatically delete backups older than 30 days:

```json
{
  "Rules": [
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "Prefix": "backups/",
      "Expiration": {
        "Days": 30
      }
    }
  ]
}
```

