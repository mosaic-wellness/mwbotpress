# Simple S3 Backup - No Timestamps

## ✅ Changes Made

I've simplified the backup system to **overwrite files** instead of creating timestamped folders.

### What Changed:

1. **No more timestamp folders** - Each bot has ONE backup location
2. **Files are overwritten** - Every backup replaces the previous one
3. **Simpler structure** - Just `backups/botId/` instead of `backups/botId/2025-11-04.../`
4. **No version history** - Latest backup only (uses less storage)

## 📁 New S3 Structure

```
s3://mwbot/
└── backups/
    ├── bot1/
    │   ├── _metadata.json          (last backup info)
    │   ├── bot.config.json         (overwritten each time)
    │   ├── flows/
    │   │   ├── main.flow.json      (overwritten)
    │   │   └── error.flow.json     (overwritten)
    │   ├── actions/
    │   ├── intents/
    │   └── ...
    └── bot2/
        └── ...
```

## 🔄 How It Works Now

### Backup Process:
1. User makes a change to bot
2. After 30 seconds → Auto-backup triggered
3. Files are uploaded to `s3://mwbot/backups/botId/`
4. **Old files are overwritten** with new versions
5. Only the latest version exists in S3

### Metadata File:
Each backup includes `_metadata.json`:
```json
{
  "botId": "my-bot",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "files": ["bot.config.json", "flows/main.flow.json", ...],
  "version": "12.31.10"
}
```

## 📡 Updated API

### 1. Backup a Bot (Overwrites existing)
```bash
POST /api/v1/admin/backup/bots/:botId
```

### 2. Backup All Bots
```bash
POST /api/v1/admin/backup/all
```

### 3. Get Backup Info (Changed from "list")
```bash
GET /api/v1/admin/backup/bots/:botId/info
```

**Response:**
```json
{
  "exists": true,
  "lastBackup": "2025-11-04T10:30:00.000Z",
  "fileCount": 47,
  "version": "12.31.10"
}
```

Or if no backup exists:
```json
{
  "exists": false,
  "message": "No backup found for this bot"
}
```

### 4. Restore Bot (Simplified - no timestamp needed)
```bash
POST /api/v1/admin/backup/bots/:botId/restore
```

### 5. Delete Backup (Simplified - deletes all files)
```bash
DELETE /api/v1/admin/backup/bots/:botId
```

## 🚀 Usage Examples

### Backup a Bot
```bash
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check if Backup Exists
```bash
curl http://localhost:3000/api/v1/admin/backup/bots/my-bot/info \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Restore Bot
```bash
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot/restore \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Delete Backup
```bash
curl -X DELETE http://localhost:3000/api/v1/admin/backup/bots/my-bot \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## ⚡ Auto-Backup Workflow

```
1. User edits flow → saves
   ↓
2. Change detected
   ↓
3. Wait 30 seconds (debounce)
   ↓
4. Backup to s3://mwbot/backups/my-bot/
   ↓
5. Files overwritten (no new folder)
   ↓
6. Done! Latest version saved
```

## 💡 Benefits

✅ **Simpler Structure** - No timestamp folders to manage
✅ **Less Storage** - Only one version per bot
✅ **Easier to Use** - No need to specify timestamps
✅ **Faster Restore** - Just one location to restore from
✅ **Auto-Overwrite** - Always have the latest version

## ⚠️ Important Notes

### No Version History
- Only the **latest backup** is kept
- Previous versions are overwritten
- If you need history, consider:
  - Enable S3 versioning on your bucket
  - Use scheduled snapshots to a different folder
  - Manual backups before major changes

### S3 Versioning (Optional)
To keep history with S3's built-in versioning:

```bash
# Enable versioning on your bucket
aws s3api put-bucket-versioning \
  --bucket mwbot \
  --versioning-configuration Status=Enabled

# List all versions of a file
aws s3api list-object-versions \
  --bucket mwbot \
  --prefix backups/my-bot/flows/main.flow.json

# Restore a specific version
aws s3api get-object \
  --bucket mwbot \
  --key backups/my-bot/flows/main.flow.json \
  --version-id <version-id> \
  output.json
```

## 🔧 Testing

### 1. Make a backup
```bash
# Manual backup
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Verify in S3
```bash
# List files
aws s3 ls s3://mwbot/backups/my-bot/ --recursive

# Should see:
# backups/my-bot/_metadata.json
# backups/my-bot/bot.config.json
# backups/my-bot/flows/main.flow.json
# etc.
```

### 3. Make a change and wait
```bash
# Edit a flow, save it
# Wait 30 seconds
# Check logs for "Auto-backup triggered"
```

### 4. Verify files were overwritten
```bash
# Check the timestamp in metadata
aws s3 cp s3://mwbot/backups/my-bot/_metadata.json - | jq .timestamp

# Should show the new timestamp
```

### 5. Test restore
```bash
# Delete a local flow (be careful!)
# Then restore
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot/restore \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify the flow is back
```

## 📊 Comparison: Before vs After

### Before (With Timestamps):
```
s3://mwbot/backups/my-bot/
├── 2025-11-04T09-00-00-000Z/  (120 MB)
├── 2025-11-04T10-00-00-000Z/  (120 MB)
├── 2025-11-04T11-00-00-000Z/  (120 MB)
└── latest.json

Total: ~360 MB for 3 backups
```

### After (No Timestamps):
```
s3://mwbot/backups/my-bot/
├── _metadata.json
├── bot.config.json
├── flows/
└── actions/

Total: ~120 MB (only latest)
```

**Storage savings: 67%** (if you had 3 backups)

## 🎯 When to Use What

### Use This Simple Approach When:
- ✅ You only need the latest backup
- ✅ You want to save storage costs
- ✅ You prefer simplicity over history
- ✅ You're okay with overwriting

### Use Versioned Backups When:
- ⚠️ You need to restore to specific points in time
- ⚠️ You want complete audit history
- ⚠️ Compliance requires version tracking
- ⚠️ Storage cost is not a concern

## 🔄 Migration from Old System

If you had the old timestamp-based system:

```bash
# Your old backups are still there
aws s3 ls s3://mwbot/backups/my-bot/

# New backups will just go to the bot root
# Old timestamped folders remain until you delete them

# To clean up old backups:
aws s3 rm s3://mwbot/backups/my-bot/ \
  --recursive \
  --exclude "*" \
  --include "202*"  # Deletes all timestamp folders
```

## ✅ Summary

- **Simpler**: No timestamps, just `backups/botId/`
- **Overwrites**: Each backup replaces the previous
- **Auto-sync**: Changes trigger backup after 30s
- **Easy restore**: No timestamp needed
- **Less storage**: Only latest version kept

Now rebuild and restart:
```bash
yarn build
yarn start
```

Make a change and it will automatically backup to the simple structure! 🚀

