# Troubleshooting Auto-Backup

## ✅ Changes Made

I've enabled auto-backup in the code:
- `autoBackupOnChanges: true` is now hardcoded
- Added detailed logging to see what's happening
- Debounce time: 30 seconds (30000ms)

## 🔍 Steps to Debug

### 1. Rebuild and Restart Botpress

```bash
cd packages/bp
yarn build
yarn start
```

### 2. Check Startup Logs

Look for these messages in the logs:

✅ **Expected logs on startup:**
```
S3 Backup Service initialized. Bucket: mwbot
Auto-backup on changes is enabled
Auto-backup on changes enabled for X bots
Bot <your-bot-id> | Auto-backup listener registered (debounce: 30000ms)
```

❌ **Problem indicators:**
```
S3 Backup Service is disabled
Auto-backup on changes is disabled
Failed to initialize S3 Backup Service
```

### 3. Make a Test Change

1. Open your bot in Flow Editor
2. Edit any flow (add a node, change text, etc.)
3. **Save the flow**
4. Watch the logs immediately

### 4. Expected Behavior

**Immediately after saving:**
```
Bot <your-bot-id> | File changed: data/bots/<your-bot-id>/flows/main.flow.json, scheduling backup in 30000ms
```

**After 30 seconds (if no more changes):**
```
Bot <your-bot-id> | Auto-backup triggered by file changes
Bot <your-bot-id> | Starting S3 backup
Bot <your-bot-id> | S3 backup completed. Files backed up: XX
```

## 🐛 Common Issues

### Issue 1: No "File changed" messages

**Possible causes:**
- Auto-backup not enabled
- Bot not mounted
- Changes not being saved to Ghost

**Solution:**
```bash
# Check if auto-backup is enabled
curl http://localhost:3000/api/v1/admin/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should show: "autoBackupEnabled": true
```

### Issue 2: "File changed" but no backup

**Possible causes:**
- Waiting for debounce time (30 seconds)
- Multiple rapid changes resetting the timer
- Backup already in progress

**Solution:**
- Wait at least 30 seconds after your last change
- Stop making changes and wait
- Check logs for "Backup already in progress"

### Issue 3: AWS Credentials Error

**Logs show:**
```
Failed to initialize S3 Backup Service
Cannot access bucket "mwbot"
```

**Solution:**
```bash
# Set AWS credentials
export AWS_REGION=ap-south-1
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret

# Test S3 access
aws s3 ls s3://mwbot/

# Restart Botpress
yarn start
```

### Issue 4: Service Not Initializing

**Logs show:**
```
Failed to initialize S3 Backup Service
```

**Solution:**
1. Check if `aws-sdk` is installed:
   ```bash
   yarn list aws-sdk
   ```

2. If not installed:
   ```bash
   yarn add aws-sdk
   ```

3. Rebuild:
   ```bash
   yarn build
   ```

## 📊 Test Procedure

### Quick Test

```bash
# 1. Start Botpress with logging
yarn start | tee botpress.log

# 2. In another terminal, watch for backup events
tail -f botpress.log | grep -E "(File changed|Auto-backup|S3 backup)"

# 3. Make a change to your bot
# - Edit a flow
# - Save it
# - Wait 30 seconds

# 4. Verify backup in S3
aws s3 ls s3://mwbot/backups/<your-bot-id>/ --recursive --human-readable

# 5. Check latest backup
aws s3 ls s3://mwbot/backups/<your-bot-id>/ --recursive | tail -20
```

### Manual Backup Test

If auto-backup isn't working, test manual backup first:

```bash
# Trigger manual backup
curl -X POST http://localhost:3000/api/v1/admin/backup/bots/<your-bot-id> \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check if it appears in S3
aws s3 ls s3://mwbot/backups/<your-bot-id>/
```

If manual backup works but auto-backup doesn't, the issue is with the change detection.

## 🔧 Force Debug Mode

To see all change events, you can temporarily add debug logging:

1. Edit `packages/bp/src/core/backup/s3-backup-service.ts`
2. In the `changeHandler` function, remove the filter temporarily:

```typescript
const changeHandler = (fileName: string) => {
  // Comment out the filter temporarily to see ALL changes
  // if (fileName.includes('/models/') || fileName.endsWith('.js.map')) {
  //   return
  // }

  this.logger.forBot(botId).info(`File changed: ${fileName}, scheduling backup in ${debounceTime}ms`)
  // ... rest of the code
}
```

3. Rebuild and restart
4. Make a change and see if ANY file change is detected

## 📝 Checklist

Before asking for help, verify:

- [ ] Botpress rebuilt: `yarn build`
- [ ] Botpress restarted
- [ ] AWS credentials set in environment
- [ ] S3 bucket "mwbot" exists and is accessible
- [ ] Logs show "Auto-backup on changes is enabled"
- [ ] Logs show "Auto-backup listener registered"
- [ ] Made a change and saved it
- [ ] Waited at least 30 seconds after last change
- [ ] Checked logs for "File changed" message
- [ ] Manual backup works: `POST /api/v1/admin/backup/bots/:botId`

## 🎯 Expected Full Flow

```
1. Start Botpress
   └─> Logs: "S3 Backup Service initialized"
   └─> Logs: "Auto-backup on changes is enabled"
   └─> Logs: "Auto-backup listener registered"

2. Edit Flow in UI
   └─> Click Save

3. Immediately (< 1 second)
   └─> Logs: "File changed: data/bots/xxx/flows/main.flow.json"

4. Wait 30 seconds
   └─> Logs: "Auto-backup triggered by file changes"
   └─> Logs: "Starting S3 backup"

5. Few seconds later
   └─> Logs: "S3 backup completed. Files backed up: XX"

6. Verify in S3
   └─> aws s3 ls s3://mwbot/backups/your-bot-id/
   └─> Should see new timestamp folder
```

## 🆘 Still Not Working?

### Check These:

1. **Is the bot mounted (enabled)?**
   - Disabled bots don't have active listeners
   - Check bot status in admin UI

2. **Are you editing the right bot?**
   - Verify bot ID in logs matches the bot you're editing

3. **Is Ghost Service working?**
   - Try creating a new flow
   - Check if it appears in database/filesystem

4. **View all registered listeners:**
   ```typescript
   // In browser console (dev tools)
   // This is for debugging only
   console.log('Registered listeners:', botService.botChangeHandlers.size)
   ```

### Get Detailed Logs

```bash
# Start with debug logging
DEBUG=services:bots,backup:* yarn start

# Or set environment variable
export BP_DEBUG=true
yarn start
```

## 📧 Report Issues

If still not working, provide:

1. Startup logs (first 50 lines after "Botpress is ready")
2. Logs after making a change (next 30 seconds)
3. Output of: `curl http://localhost:3000/api/v1/admin/backup/status`
4. Your bot ID
5. Type of change made (flow edit, config change, etc.)

---

**Quick Fix**: If nothing works, restart everything fresh:

```bash
# Kill all Botpress processes
pkill -f botpress

# Clean build
rm -rf dist/
yarn build

# Set credentials
export AWS_REGION=ap-south-1
export AWS_ACCESS_KEY_ID=your_key
export AWS_SECRET_ACCESS_KEY=your_secret

# Start fresh
yarn start
```

