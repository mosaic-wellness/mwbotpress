# ✅ COMPLETE FIX: Workspace Registration on Restore

## 🎯 The Complete Solution

The bot now properly registers to its workspace when restored from S3!

## 🔍 The Problem

When restoring a deleted bot:
1. ✅ Files were restored
2. ❌ Bot wasn't linked to workspace
3. ❌ Bot didn't appear in bot list in dashboard

## ✅ The Solution

### Store Workspace ID in Backup Metadata

During **backup**, we now save which workspace the bot belongs to:

```typescript
// Get the workspace ID for this bot
let workspaceId = 'default'
try {
  const workspaces = await this.workspaceService.getWorkspaces()
  const botWorkspace = workspaces.find(ws => ws.bots && ws.bots.includes(botId))
  if (botWorkspace) {
    workspaceId = botWorkspace.id
  }
} catch (error) {
  this.logger.forBot(botId).warn('Could not determine workspace, using default')
}

const backupMetadata: BackupMetadata = {
  botId,
  timestamp: new Date(),
  files: [],
  version: bot.version,
  workspaceId  // ← SAVED!
}
```

### Use Saved Workspace ID During Restore

During **restore**, we use the saved workspace ID:

```typescript
// Use workspace ID from backup metadata
const workspaceId = metadata.workspaceId || 'default'

// Add bot to workspace
await this.workspaceService.addBotRef(botId, workspaceId)
```

## 📝 Updated Metadata Structure

### Old Metadata:
```json
{
  "botId": "my-bot",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "files": ["bot.config.json", "flows/main.flow.json", ...],
  "version": "12.31.10"
}
```

### New Metadata:
```json
{
  "botId": "my-bot",
  "timestamp": "2025-11-04T10:30:00.000Z",
  "files": ["bot.config.json", "flows/main.flow.json", ...],
  "version": "12.31.10",
  "workspaceId": "default"  ← NEW!
}
```

## 🔄 Complete Flow

### Backup Flow:
```
1. Get bot data
   ↓
2. Find which workspace bot belongs to
   ↓
3. Save workspace ID in metadata
   ↓
4. Upload all files to S3
```

### Restore Flow (Deleted Bot):
```
1. Download files from S3
   ↓
2. Read metadata (includes workspaceId)
   ↓
3. Write files to Ghost
   ↓
4. Add bot to workspace using saved workspaceId
   ↓
5. Invalidate cache
   ↓
6. Mount bot
   ↓
7. Bot appears in dashboard! ✅
```

## 📋 Expected Logs

### During Backup:
```
Bot my-bot | Starting S3 backup
Bot my-bot | S3 backup completed. Files backed up: 47
```

### During Restore (Deleted Bot):
```
Bot my-bot | Starting S3 restore
Bot my-bot | Restoring from backup: backups/my-bot
Bot my-bot | S3 restore completed. Files restored: 47
Bot my-bot | Bot was deleted, registering and mounting restored bot
Bot my-bot | Adding bot to workspace: default
Bot my-bot | Bot successfully added to workspace: default
Bot my-bot | Invalidating bot cache
Bot my-bot | Mounting restored bot
Bot my-bot | Restored bot registered and mounted successfully
```

## 🚀 Testing

```bash
# 1. Rebuild
cd packages/bp
yarn build

# 2. Restart
yarn start

# 3. Create a backup of existing bot (will save workspace ID)
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/test-bot \
  -H "Authorization: Bearer YOUR_TOKEN"

# 4. Delete the bot from dashboard

# 5. Restore it
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/test-bot/restore \
  -H "Authorization: Bearer YOUR_TOKEN"

# 6. Check logs
tail -f logs/botpress.log | grep -A10 "Bot was deleted"

# Should see:
# Bot test-bot | Bot was deleted, registering and mounting restored bot
# Bot test-bot | Adding bot to workspace: default
# Bot test-bot | Bot successfully added to workspace: default
# Bot test-bot | Invalidating bot cache
# Bot test-bot | Mounting restored bot
# Bot test-bot | Restored bot registered and mounted successfully

# 7. Refresh dashboard
# Bot appears in the list! ✅
```

## 🔍 Verify Workspace Registration

### Check if bot is in workspace:
```bash
# Get workspace info
curl http://localhost:3000/api/v1/admin/workspaces/default \
  -H "Authorization: Bearer YOUR_TOKEN" | jq .bots

# Should include your bot ID:
[
  "other-bot",
  "test-bot"  ← Your restored bot
]
```

### Check backup metadata:
```bash
# View the metadata file
aws s3 cp s3://mwbot/backups/test-bot/_metadata.json - | jq .

# Should show:
{
  "botId": "test-bot",
  "timestamp": "2025-11-04T...",
  "files": [...],
  "version": "12.31.10",
  "workspaceId": "default"  ← Workspace is saved
}
```

## ⚠️ Important Notes

### 1. Backup Existing Bots Again
Old backups (made before this fix) don't have `workspaceId` in metadata. They'll default to `'default'` workspace.

**Recommendation:** Backup all your bots again after this update:
```bash
curl -X POST http://localhost:3000/api/v1/admin/backup/all \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 2. Workspace Must Exist
If the saved workspace doesn't exist (e.g., it was deleted), the system automatically falls back to 'default' workspace:

```typescript
try {
  await this.workspaceService.addBotRef(botId, workspaceId)
} catch (error) {
  // Fallback to default if original workspace doesn't exist
  await this.workspaceService.addBotRef(botId, 'default')
}
```

### 3. Multi-Workspace Setups
If you have multiple workspaces (e.g., 'dev', 'staging', 'prod'), the bot will be restored to its **original workspace**, maintaining proper organization.

## 🎯 What Gets Saved in workspaces.json

When you backup and restore a bot, the workspaces.json file is updated:

```json
{
  "workspaces": [
    {
      "id": "default",
      "name": "Default",
      "bots": [
        "bot1",
        "bot2",
        "test-bot"  ← Added during restore
      ]
    }
  ]
}
```

This is what makes the bot appear in the dashboard!

## 🐛 Troubleshooting

### Bot Still Not Appearing?

1. **Check metadata has workspaceId:**
```bash
aws s3 cp s3://mwbot/backups/YOUR_BOT/_metadata.json -
```

2. **Check workspace exists:**
```bash
curl http://localhost:3000/api/v1/admin/workspaces \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Check workspaces.json:**
```bash
# If using disk storage
cat data/global/workspaces.json | jq .

# Should show bot in workspace.bots array
```

4. **Force re-backup:**
```bash
# Delete old backup
curl -X DELETE http://localhost:3000/api/v1/admin/backup/bots/YOUR_BOT \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create new backup (will save workspace)
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/YOUR_BOT \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Check Restore Logs

Look for these specific log lines:
```bash
grep -A5 "Bot successfully added to workspace" logs/botpress.log
```

If you see `"Bot successfully added to workspace: default"`, the registration worked!

## ✅ Summary

The fix has **two parts**:

1. **During Backup:** Save workspace ID in metadata
2. **During Restore:** Use saved workspace ID to register bot

This ensures that when you restore a deleted bot:
- ✅ Files are restored
- ✅ Bot is added to correct workspace
- ✅ **Bot appears in dashboard!**

Now rebuild, restart, and your restored bots will show up properly! 🎉

