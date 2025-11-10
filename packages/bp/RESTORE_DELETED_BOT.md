# Restoring Deleted Bots from S3

## ✅ Feature: Restore Deleted Bots

The S3 Backup Service now intelligently handles restoring **both existing and deleted bots**.

## 🎯 How It Works

### Scenario 1: Restoring an Existing Bot
When you restore a bot that still exists in Botpress:
1. ✅ Files are restored from S3
2. ✅ Bot is unmounted (unloaded)
3. ✅ Bot is remounted (reloaded with restored files)
4. ✅ Changes appear in dashboard after refresh

### Scenario 2: Restoring a Deleted Bot
When you restore a bot that was completely deleted:
1. ✅ Files are restored from S3 to Ghost storage
2. ✅ Bot IDs cache is invalidated (so system knows about it)
3. ✅ Bot is mounted (registered and made active)
4. ✅ **Bot appears in bot list** after refresh!

## 🚀 Usage

### Restore a Bot (Works for Both Cases)

```bash
# Single command works for existing OR deleted bots
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot-id/restore \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "message": "Restore completed for bot: my-bot-id",
  "note": "Bot has been restored and mounted. Please refresh your dashboard to see it in the bot list."
}
```

## 📋 Complete Workflow Examples

### Example 1: Restore After Accidental Deletion

```bash
# 1. Oh no! Bot was deleted from dashboard
# Bot is gone from the list

# 2. Restore from S3 backup
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot/restore \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check the logs
# Should see:
# Bot my-bot | Starting S3 restore
# Bot my-bot | Bot was deleted, registering and mounting restored bot
# Bot my-bot | Restored bot registered and mounted successfully

# 4. Refresh your dashboard
# Bot is back in the list! 🎉
```

### Example 2: Rollback After Bad Changes

```bash
# 1. Made changes to bot flows
# Something went wrong

# 2. Restore from last backup
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/my-bot/restore \
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Check logs
# Should see:
# Bot my-bot | Starting S3 restore
# Bot my-bot | Bot exists, remounting to apply restored files
# Bot my-bot | Bot remounted successfully

# 4. Refresh dashboard
# Old version is back!
```

## 🔍 How to Tell Which Path Was Taken

Check the logs to see what happened:

### If Bot Existed:
```
Bot my-bot | S3 restore completed. Files restored: 47
Bot my-bot | Bot exists, remounting to apply restored files
Bot my-bot | Unmounting bot for reload
Bot my-bot | Remounting bot with restored files
Bot my-bot | Bot remounted successfully
```

### If Bot Was Deleted:
```
Bot my-bot | S3 restore completed. Files restored: 47
Bot my-bot | Bot was deleted, registering and mounting restored bot
Bot my-bot | Restored bot registered and mounted successfully
```

## 🎓 Technical Details

### What Happens Internally

**For Existing Bots:**
```typescript
1. Check: botExists() → true
2. Restore files to Ghost
3. Call unmountBot(botId)
4. Wait 1 second
5. Call mountBot(botId)
6. Bot reloaded with restored files
```

**For Deleted Bots:**
```typescript
1. Check: botExists() → false
2. Restore files to Ghost
3. Call getBotsIds(true) → invalidates cache
4. Call mountBot(botId) → registers bot
5. Bot appears in bot list
```

## ⚠️ Important Notes

### 1. Bot Must Have a Backup
```bash
# Check if backup exists first
curl http://localhost:3000/api/v1/admin/backup/bots/my-bot/info \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return:
{
  "exists": true,
  "lastBackup": "2025-11-04T10:30:00.000Z",
  "fileCount": 47
}
```

### 2. Workspace Association
- The restored bot will use the same bot ID
- Make sure the workspace still exists
- Bot will be associated with its original workspace

### 3. Dependencies
- If bot uses custom actions/libraries, ensure they still exist
- NLU models will need to be retrained after restore
- Conversations/analytics data is NOT restored (only bot configuration)

### 4. Refresh Required
- Always **refresh your dashboard** after restore
- Clear browser cache if bot doesn't appear
- Check logs to confirm successful restore

## 🛠️ Troubleshooting

### Bot Doesn't Appear After Restore

**Check logs for errors:**
```bash
tail -f logs/botpress.log | grep -i "restore\|mount"
```

**Common issues:**

1. **Invalid Bot ID**
   ```
   Error: Bot ID contains invalid characters
   ```
   Solution: Ensure bot ID matches S3 backup bot ID

2. **Permission Issues**
   ```
   Error: User does not have permission
   ```
   Solution: Ensure you have admin permissions

3. **Workspace Issues**
   ```
   Error: Workspace not found
   ```
   Solution: Restore to correct workspace or update bot config

4. **Ghost Storage Issues**
   ```
   Error: Failed to write file
   ```
   Solution: Check Ghost storage (DB/disk) permissions

### Force Refresh Bot List

If bot doesn't appear, try:

```bash
# Method 1: Restart Botpress
yarn start

# Method 2: Manually invalidate cache
curl -X POST http://localhost:3000/api/v1/admin/bots/refresh \
  -H "Authorization: Bearer YOUR_TOKEN"

# Method 3: Hard refresh browser
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (Mac)
```

## 📊 Testing Scenarios

### Test 1: Restore Existing Bot
```bash
# 1. Make a change to your bot
# 2. Wait for auto-backup (30 seconds)
# 3. Make another change
# 4. Restore previous version
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/test-bot/restore

# 5. Refresh dashboard - first change is back
```

### Test 2: Restore Deleted Bot
```bash
# 1. Create a test bot
# 2. Make some changes
# 3. Wait for backup
# 4. Delete the bot from dashboard
# 5. Restore it
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/test-bot/restore

# 6. Refresh dashboard - bot is back!
```

### Test 3: Bulk Restore
```bash
# Restore multiple deleted bots
for botId in bot1 bot2 bot3; do
  curl -X POST http://localhost:3000/api/v1/admin/backup/bots/$botId/restore \
    -H "Authorization: Bearer YOUR_TOKEN"
  echo "Restored $botId"
  sleep 2
done
```

## 🎉 Benefits

✅ **Disaster Recovery** - Restore deleted bots instantly
✅ **Version Control** - Rollback to previous versions
✅ **Peace of Mind** - Never lose a bot permanently
✅ **Smart Detection** - Automatically handles both cases
✅ **No Manual Steps** - Single API call does everything

## 📚 Related Commands

```bash
# Check if bot has backup
GET /api/v1/admin/backup/bots/:botId/info

# Backup a bot manually before deletion
POST /api/v1/admin/backup/bots/:botId

# List all bots (to verify restore)
GET /api/v1/admin/bots

# Get bot details
GET /api/v1/bots/:botId

# Delete bot
DELETE /api/v1/admin/bots/:botId
```

## 🔐 Security Notes

- Restore requires admin permissions
- Authentication token must be valid
- Only authorized users can restore bots
- Audit logs track all restore operations

---

**Now you can safely delete bots knowing they can always be restored from S3!** 🚀

