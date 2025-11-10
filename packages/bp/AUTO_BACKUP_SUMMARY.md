# ✅ Auto-Backup on Changes - Implementation Complete!

## 🎉 What's New

Your S3 Backup Service now supports **automatic backups triggered by bot file changes**!

## 🚀 Quick Start

### 1. Update Configuration

Add to your `botpress.config.json`:

```json
{
  "s3Backup": {
    "enabled": true,
    "bucket": "mwbot",
    "region": "ap-south-1",
    "autoBackupOnChanges": true,
    "backupDebounceTime": 30000,
    "scheduledBackupInterval": "24h"
  }
}
```

### 2. Set AWS Credentials

```bash
export AWS_REGION=ap-south-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
```

### 3. Restart Botpress

```bash
yarn build
yarn start
```

### 4. Verify It's Working

**Check status:**
```bash
curl http://localhost:3000/api/v1/admin/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Expected response:
```json
{
  "enabled": true,
  "autoBackupEnabled": true,
  "bucket": "mwbot",
  "region": "ap-south-1",
  "backupDebounceTime": 30000,
  "scheduledBackupInterval": "24h"
}
```

**Watch the logs:**
```bash
tail -f logs/botpress.log | grep -i backup
```

You should see:
```
S3 Backup Service initialized. Bucket: mwbot
Auto-backup on changes enabled for X bots
```

### 5. Test It

1. Open Flow Editor
2. Edit any flow
3. Save changes
4. Watch logs for:
   ```
   Bot my-bot | File changed: data/bots/my-bot/flows/main.flow.json, scheduling backup
   ```
5. Wait 30 seconds (debounce time)
6. See backup complete:
   ```
   Bot my-bot | Auto-backup triggered by file changes
   Bot my-bot | S3 backup completed. Files backed up: 47
   ```

## 📋 How It Works

```
┌─────────────┐
│ User edits  │
│   a flow    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ File saved  │
│  to Ghost   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Change detected │
│  Timer: 30s     │
└──────┬──────────┘
       │
       ▼ (30s later)
┌──────────────────┐
│ Automatic backup │
│    to S3         │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Backup complete! │
│  New version     │
│   available      │
└──────────────────┘
```

## 🎛️ Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `autoBackupOnChanges` | `false` | Enable automatic backup on file changes |
| `backupDebounceTime` | `30000` | Wait time (ms) after last change before backing up |

### Debounce Examples

- **Quick backups** (10 seconds): `"backupDebounceTime": 10000`
- **Balanced** (30 seconds): `"backupDebounceTime": 30000`
- **Less frequent** (2 minutes): `"backupDebounceTime": 120000`

## 📡 New API Endpoints

### Enable Auto-Backup for a Bot
```bash
POST /api/v1/admin/backup/bots/:botId/auto-backup/enable
```

### Disable Auto-Backup for a Bot
```bash
POST /api/v1/admin/backup/bots/:botId/auto-backup/disable
```

### Check Status (Enhanced)
```bash
GET /api/v1/admin/backup/status
```

Now returns:
```json
{
  "enabled": true,
  "autoBackupEnabled": true,
  "bucket": "mwbot",
  "region": "ap-south-1",
  "backupDebounceTime": 30000,
  "scheduledBackupInterval": "24h"
}
```

## 🎯 What Triggers Auto-Backup?

✅ **YES** - These trigger backup:
- Flow changes (`.flow.json`, `.ui.json`)
- Bot config changes
- Actions, intents, entities
- Content elements
- Q&A modifications

❌ **NO** - These don't trigger backup:
- NLU model files (`/models/**`)
- Source maps (`*.js.map`)

## 💡 Features

✅ **Smart Debouncing** - Multiple rapid changes = single backup
✅ **Per-Bot Control** - Enable/disable for specific bots
✅ **Filtered Events** - Only meaningful changes trigger backups
✅ **Non-Blocking** - Backups run asynchronously
✅ **Works with Scheduled Backups** - Use both together!

## 📚 Complete Documentation

- **Quick Guide**: `AUTO_BACKUP_GUIDE.md` - Full usage guide
- **API Reference**: `README.md` - Complete API documentation
- **Setup Guide**: `S3_BACKUP_IMPLEMENTATION.md` - Initial setup

## 🔍 Troubleshooting

### Not seeing backups?

1. **Check config**: `autoBackupOnChanges: true`
2. **Wait full debounce time**: Default is 30 seconds
3. **Check logs**: Look for "File changed: ..." messages
4. **Verify S3 credentials**: Test with manual backup first

### Backups too frequent?

Increase debounce time:
```json
{
  "backupDebounceTime": 60000
}
```

### Want to disable temporarily?

```json
{
  "autoBackupOnChanges": false
}
```

Or disable for specific bot via API:
```bash
POST /api/v1/admin/backup/bots/:botId/auto-backup/disable
```

## 🎓 Best Practices

1. **Combine with Scheduled Backups**
   ```json
   {
     "autoBackupOnChanges": true,
     "backupDebounceTime": 30000,
     "scheduledBackupInterval": "24h"
   }
   ```

2. **Set S3 Lifecycle Policy**
   - Delete backups older than 30 days
   - Transition to cheaper storage after 7 days

3. **Monitor Logs**
   ```bash
   tail -f logs/botpress.log | grep "Auto-backup"
   ```

4. **Test It**
   - Make a small change
   - Wait for backup
   - Verify in S3
   - Test restore

## ✨ Benefits

✅ **Never Lose Work** - Every change is backed up
✅ **Zero Maintenance** - Automatic, no manual intervention
✅ **Point-in-Time Recovery** - Restore to any change
✅ **Peace of Mind** - Sleep well knowing your bots are safe
✅ **Audit Trail** - Complete version history

## 📊 Example Timeline

```
09:00:00 - User edits flow
09:00:00 - Change detected, timer: 30s
09:00:10 - User edits another flow
09:00:10 - Timer reset, new timer: 30s
09:00:40 - No more changes
09:00:40 - Backup triggered!
09:00:55 - Backup complete (47 files)
```

---

## 🎉 You're All Set!

Your bots are now protected with automatic S3 backups! Every time you make a change, it will be automatically backed up after the debounce period.

**Next Steps:**
1. ✅ Update your config
2. ✅ Restart Botpress  
3. ✅ Make a test change
4. ✅ Watch it backup automatically!

Happy coding! 🚀

