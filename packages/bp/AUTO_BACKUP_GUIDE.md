# Automatic S3 Backup on Bot Changes

## 🎯 Overview

The S3 Backup Service now supports **automatic backups triggered by bot changes**. Whenever you modify a bot's configuration, flows, actions, intents, or any other files, the system will automatically backup the bot to S3 after a configurable debounce period.

## ⚙️ How It Works

1. **Change Detection**: The service listens to file change events from the GhostService
2. **Debouncing**: Changes are debounced (default 30 seconds) to avoid excessive backups during rapid edits
3. **Automatic Backup**: After the debounce period, a backup is automatically triggered
4. **Smart Filtering**: Model files and source maps are excluded from triggering backups

## 📝 Configuration

Add this to your `botpress.config.json`:

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

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoBackupOnChanges` | boolean | false | Enable automatic backup on file changes |
| `backupDebounceTime` | number | 30000 | Milliseconds to wait after last change before backing up (30 seconds default) |

## 🚀 Usage

### Enable Auto-Backup in Configuration

Set `autoBackupOnChanges: true` in your config file. The service will automatically start monitoring all bots on startup.

### Enable/Disable Per Bot via API

You can also control auto-backup per bot dynamically:

**Enable auto-backup for a specific bot:**
```bash
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/your-bot-id/auto-backup/enable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Disable auto-backup for a specific bot:**
```bash
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/your-bot-id/auto-backup/disable \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Check status:**
```bash
curl -X GET http://localhost:3000/api/v1/admin/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
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

## 📋 Example Workflow

1. **Initial Setup**
   ```json
   {
     "s3Backup": {
       "enabled": true,
       "bucket": "mwbot",
       "region": "ap-south-1",
       "autoBackupOnChanges": true,
       "backupDebounceTime": 30000
     }
   }
   ```

2. **Start Botpress**
   - Service initializes
   - Auto-backup listeners are registered for all bots
   - Logs: `Auto-backup on changes enabled for X bots`

3. **Make Changes**
   - Edit a flow in the Flow Editor
   - Save changes
   - System detects file change
   - Logs: `File changed: data/bots/my-bot/flows/main.flow.json, scheduling backup`

4. **Wait for Debounce**
   - Make more edits if needed (timer resets with each change)
   - After 30 seconds of no changes...

5. **Automatic Backup**
   - Backup is triggered automatically
   - Logs: `Auto-backup triggered by file changes`
   - Logs: `S3 backup completed. Files backed up: 47`

## 🔍 What Triggers a Backup?

✅ **Triggers backup:**
- Flow changes (`.flow.json`, `.ui.json`)
- Bot config changes (`bot.config.json`)
- Action modifications
- Content element updates
- Intent/Entity changes
- Q&A modifications

❌ **Does NOT trigger backup:**
- NLU model files (`/models/**`)
- Source maps (`**/*.js.map`)
- Temporary files

## ⏱️ Debounce Behavior

The debounce timer ensures that rapid successive changes don't create excessive backups:

```
Change 1 → Timer starts (30s)
Change 2 (10s later) → Timer resets (30s from now)
Change 3 (5s later) → Timer resets (30s from now)
No more changes → Timer expires → Backup triggered
```

### Adjusting Debounce Time

**Shorter debounce (10 seconds)** - More frequent backups:
```json
{
  "backupDebounceTime": 10000
}
```

**Longer debounce (2 minutes)** - Fewer backups:
```json
{
  "backupDebounceTime": 120000
}
```

## 📊 Monitoring

### Check Logs

Auto-backup events are logged at different levels:

**Debug level:**
```
Bot my-bot | File changed: data/bots/my-bot/flows/main.flow.json, scheduling backup
Bot my-bot | Auto-backup listener registered
```

**Info level:**
```
S3 Backup Service initialized. Bucket: mwbot
Auto-backup on changes enabled for 5 bots
Bot my-bot | Auto-backup triggered by file changes
Bot my-bot | S3 backup completed. Files backed up: 47
```

**Error level:**
```
Bot my-bot | Auto-backup failed
```

### Status Endpoint

Query the status endpoint to see current configuration:

```bash
GET /api/v1/admin/backup/status
```

## 🎛️ Advanced Usage

### Programmatic Control

You can control auto-backup programmatically in your code:

```typescript
import { S3BackupService } from 'core/backup'

class MyService {
  constructor(
    @inject(TYPES.S3BackupService) private backupService: S3BackupService
  ) {}

  async onNewBotCreated(botId: string) {
    // Enable auto-backup for the new bot
    this.backupService.enableAutoBackupForBot(botId)
  }

  async onBotDeleted(botId: string) {
    // Disable auto-backup to clean up listeners
    this.backupService.disableAutoBackupForBot(botId)
  }

  async beforeShutdown() {
    // Clean up all listeners
    this.backupService.cleanup()
  }
}
```

## 🔐 Best Practices

1. **Set Appropriate Debounce Time**
   - Development: 10-30 seconds (quick backups)
   - Production: 30-60 seconds (balanced)
   - During bulk edits: Disable temporarily, then backup manually

2. **Combine with Scheduled Backups**
   ```json
   {
     "autoBackupOnChanges": true,
     "backupDebounceTime": 30000,
     "scheduledBackupInterval": "24h"
   }
   ```
   - Auto-backup captures changes immediately
   - Scheduled backup ensures regular full backups

3. **Monitor S3 Storage Costs**
   - Auto-backups create more snapshots
   - Use S3 lifecycle policies to delete old backups
   - Consider disabling for development bots

4. **Test the Feature**
   ```bash
   # Make a simple change to a flow
   # Watch the logs
   tail -f logs/botpress.log | grep -i backup
   
   # Verify backup was created
   aws s3 ls s3://mwbot/backups/your-bot-id/ --recursive
   ```

## ⚠️ Important Notes

1. **Debounce Period**: The backup only triggers after the debounce time with no new changes. If you're continuously editing, the backup won't trigger until you stop.

2. **One Backup Per Bot**: Only one pending backup per bot at a time. Multiple rapid changes will result in a single backup.

3. **Backup in Progress**: If a backup is already in progress for a bot, new changes will schedule another backup after the current one completes.

4. **Initial Backup**: Enabling auto-backup doesn't trigger an immediate backup. The first backup happens after the first change.

5. **Bot Must Be Mounted**: Auto-backup listeners are only active for mounted (enabled) bots.

## 🐛 Troubleshooting

### Auto-backup not triggering

1. **Check configuration**:
   ```bash
   GET /api/v1/admin/backup/status
   ```
   Ensure `autoBackupEnabled: true`

2. **Check logs**:
   ```bash
   grep -i "auto-backup" logs/botpress.log
   ```
   Look for "Auto-backup listener registered"

3. **Verify file changes are detected**:
   - Look for "File changed: ..." in debug logs
   - Make sure you're editing actual bot files, not just UI state

4. **Check debounce timer**:
   - Wait for the full debounce period after your last change
   - Default is 30 seconds

### Backups happening too frequently

1. **Increase debounce time**:
   ```json
   {
     "backupDebounceTime": 60000
   }
   ```

2. **Disable for specific bots**:
   ```bash
   POST /api/v1/admin/backup/bots/:botId/auto-backup/disable
   ```

3. **Disable auto-backup entirely**:
   ```json
   {
     "autoBackupOnChanges": false
   }
   ```

## 🎉 Benefits

✅ **Automatic Protection**: No manual backup needed after changes
✅ **Point-in-Time Recovery**: Every change creates a restore point
✅ **Peace of Mind**: Never lose work due to forgotten backups
✅ **Audit Trail**: Complete history of all bot versions
✅ **Zero Maintenance**: Set it and forget it

## 📈 Example Timeline

```
09:00:00 - User edits flow "main.flow.json"
09:00:00 - Change detected, timer set for 30s
09:00:15 - User edits flow "error.flow.json"  
09:00:15 - Timer reset, now 30s from 09:00:15
09:00:45 - No more changes, backup triggered
09:01:02 - Backup completed (47 files)
09:01:02 - New backup available in S3

10:30:00 - User edits action "sendEmail.js"
10:30:00 - Change detected, timer set for 30s
10:30:20 - User edits same action again
10:30:20 - Timer reset, now 30s from 10:30:20
10:30:50 - Backup triggered
10:31:05 - Backup completed (48 files)
```

---

**Ready to use!** Simply set `autoBackupOnChanges: true` in your config and restart Botpress. All bot changes will now be automatically backed up to S3! 🚀

