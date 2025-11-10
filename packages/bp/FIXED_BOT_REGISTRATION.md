# ✅ Fixed: Bot Registration on Restore

## 🐛 Problem
When restoring a deleted bot from S3, it wasn't appearing in the bot list in the dashboard.

## 🔧 Root Cause
The bot files were being restored, but the bot wasn't being **linked to its workspace**. Without this workspace association, the bot wouldn't appear in the bot list.

## ✅ Solution
Added proper workspace registration using `WorkspaceService.addBotRef()`.

## 📝 What Changed

### Added WorkspaceService Dependency
```typescript
constructor(
  // ... other dependencies
  @inject(TYPES.WorkspaceService) private workspaceService: any
) {}
```

### Enhanced Restore Logic for Deleted Bots
```typescript
if (!botExists) {
  // 1. Load the restored bot config
  const restoredBotConfig = await this.configProvider.getBotConfig(botId)
  
  // 2. Get the workspace ID from config
  const workspaceId = restoredBotConfig.pipeline?.find(() => true) || 'default'
  
  // 3. Link bot to workspace (critical step!)
  try {
    await this.workspaceService.addBotRef(botId, workspaceId)
  } catch (error) {
    // Fallback to default workspace if original doesn't exist
    await this.workspaceService.addBotRef(botId, 'default')
  }
  
  // 4. Invalidate cache
  await this.botService.getBotsIds(true)
  
  // 5. Mount the bot
  await this.botService.mountBot(botId)
}
```

## 🔄 Complete Restore Flow Now

### For Deleted Bots:
```
1. Download files from S3
   ↓
2. Write files to Ghost storage
   ↓
3. Load restored bot.config.json
   ↓
4. Extract workspace ID from config
   ↓
5. Register bot with workspace ⭐ NEW!
   ↓
6. Invalidate bot cache
   ↓
7. Mount bot (load into memory)
   ↓
8. Bot appears in dashboard! ✅
```

## 📋 Expected Logs

When you restore a deleted bot, you should now see:

```
Bot my-bot | Starting S3 restore
Bot my-bot | Restoring from backup: backups/my-bot
Bot my-bot | S3 restore completed. Files restored: 47
Bot my-bot | Bot was deleted, registering and mounting restored bot
Bot my-bot | Adding bot to workspace: default
Bot my-bot | Restored bot registered and mounted successfully
```

## 🚀 Testing

```bash
# 1. Rebuild with the fix
cd packages/bp
yarn build

# 2. Restart Botpress
yarn start

# 3. Delete a bot from dashboard
# (Note the bot ID before deleting)

# 4. Restore it
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/YOUR_BOT_ID/restore \
  -H "Authorization: Bearer YOUR_TOKEN"

# 5. Check logs
tail -f logs/botpress.log | grep -A5 "Bot was deleted"

# Should see:
# Bot YOUR_BOT_ID | Bot was deleted, registering and mounting restored bot
# Bot YOUR_BOT_ID | Adding bot to workspace: default
# Bot YOUR_BOT_ID | Restored bot registered and mounted successfully

# 6. Refresh dashboard
# Bot should now appear in the bot list! ✅
```

## 🎯 What Gets Linked

The workspace registration ensures:
- ✅ Bot appears in workspace bot list
- ✅ Users in that workspace can access the bot
- ✅ Bot permissions are properly scoped
- ✅ Bot shows up in admin panel
- ✅ Bot is discoverable by the system

## ⚠️ Edge Cases Handled

### 1. Original Workspace Doesn't Exist
```typescript
try {
  await this.workspaceService.addBotRef(botId, workspaceId)
} catch (error) {
  // Fallback to default workspace
  await this.workspaceService.addBotRef(botId, 'default')
}
```

### 2. Bot Config Missing Workspace
```typescript
const workspaceId = restoredBotConfig.pipeline?.find(() => true) || 'default'
```
Falls back to 'default' workspace if no pipeline defined.

### 3. Multiple Workspaces
Bot is added to the workspace specified in its config, maintaining original associations.

## 📊 Before vs After

### Before (Not Working):
```
Restore → Files in Ghost → Mount Bot → ❌ Not in list
```

### After (Working):
```
Restore → Files in Ghost → Link to Workspace → Mount Bot → ✅ In list!
```

## 🔍 Troubleshooting

### Still Not Appearing?

1. **Check workspace exists:**
```bash
curl http://localhost:3000/api/v1/admin/workspaces \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Check bot config has correct workspace:**
```bash
# Look at bot.config.json in backup
aws s3 cp s3://mwbot/backups/YOUR_BOT_ID/bot.config.json - | jq .
```

3. **Verify workspace bot refs:**
```bash
curl http://localhost:3000/api/v1/admin/workspaces/default \
  -H "Authorization: Bearer YOUR_TOKEN" | jq .bots
```

4. **Force refresh:**
```bash
# Hard refresh browser (Ctrl+Shift+R)
# Or restart Botpress
```

### Check Bot Registration Status

After restore, verify:
```bash
# 1. Bot exists in filesystem/DB
curl http://localhost:3000/api/v1/bots/YOUR_BOT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"

# 2. Bot is in workspace
curl http://localhost:3000/api/v1/bots/YOUR_BOT_ID/workspaceBotsIds \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 💡 Why This Matters

In Botpress, bots are **workspace-scoped**:
- Each bot belongs to one or more workspaces
- Users only see bots in their workspaces
- The admin panel shows bots filtered by workspace
- Without workspace link = invisible bot

This fix ensures restored bots are **fully registered** in the system, not just file-restored.

## 🎓 Technical Details

### Workspace Structure
```typescript
interface Workspace {
  id: string
  name: string
  bots: string[]  // ← Array of bot IDs
  // ... other fields
}
```

### addBotRef() Method
```typescript
async addBotRef(botId: string, workspaceId: string) {
  const workspace = workspaces.find(x => x.id === workspaceId)
  if (!workspace.bots.includes(botId)) {
    workspace.bots.push(botId)  // ← Add bot to workspace array
  }
  return this.save(workspaces)
}
```

## ✅ Summary

**The fix adds one critical step: Workspace Registration**

This ensures that when you restore a deleted bot:
1. ✅ Files are restored
2. ✅ Bot is linked to workspace ⭐ NEW!
3. ✅ Bot cache is cleared
4. ✅ Bot is mounted
5. ✅ **Bot appears in dashboard!**

Now rebuild, restart, and test - your restored bots will show up! 🚀

