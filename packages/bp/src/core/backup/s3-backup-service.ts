import { BotConfig, Logger } from 'botpress/sdk'
import { TYPES } from '../types'
import { BotService } from 'core/bots/bot-service'
import { GhostService } from 'core/bpfs'
import { ConfigProvider } from 'core/config'
import { WrapErrorsWith } from 'errors'
import { inject, injectable, postConstruct, tagged } from 'inversify'
import _ from 'lodash'
import path from 'path'
import { VError } from 'verror'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk')

export interface S3BackupConfig {
  enabled: boolean
  region?: string
  bucket: string
  accessKeyId?: string
  secretAccessKey?: string
  prefix?: string
  autoBackupOnChanges?: boolean
  backupDebounceTime?: number // milliseconds to wait after last change before backing up (default: 30000 = 30s)
  scheduledBackupInterval?: string // e.g., '1h', '24h'
}

interface S3Client {
  headBucket(params: { Bucket: string }): { promise(): Promise<any> }
  putObject(params: any): { promise(): Promise<any> }
  getObject(params: any): { promise(): Promise<any> }
  listObjectsV2(params: any): { promise(): Promise<any> }
  deleteObjects(params: any): { promise(): Promise<any> }
}

export interface BackupMetadata {
  botId: string
  timestamp: Date
  files: string[]
  version?: string
  workspaceId?: string
}

@injectable()
export class S3BackupService {
  private s3: S3Client | null = null
  private config: S3BackupConfig | null = null
  private backupInProgress: Set<string> = new Set()
  private pendingBackups: Map<string, NodeJS.Timeout> = new Map()
  private botChangeHandlers: Map<string, any> = new Map()

  constructor(
    @inject(TYPES.Logger as any)
    @tagged('name', 'S3BackupService')
    private logger: Logger,
    @inject(TYPES.BotService as any) private botService: BotService,
    @inject(TYPES.GhostService as any) private ghostService: GhostService,
    @inject(TYPES.ConfigProvider as any) private configProvider: ConfigProvider,
    @inject(TYPES.WorkspaceService as any) private workspaceService: any
  ) {}
  
  private async remountBot(botId: string): Promise<void> {
    try {
      this.logger.forBot(botId).info('Unmounting bot for reload')
      await this.botService.unmountBot(botId)
      
      // Wait a moment before remounting
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      this.logger.forBot(botId).info('Remounting bot with restored files')
      await this.botService.mountBot(botId)
      
      this.logger.forBot(botId).info('Bot remounted successfully')
    } catch (error) {
      this.logger
        .forBot(botId)
        .attachError(error)
        .error('Failed to remount bot after restore')
      throw error
    }
  }

  @postConstruct()
  async initialize() {
    try {
      const botpressConfig = await this.configProvider.getBotpressConfig()
      this.config = (botpressConfig as any).s3Backup as S3BackupConfig || {}
      this.config.bucket = "mwbot"
      this.config.enabled = true
      this.config.autoBackupOnChanges = true // Enable auto-backup on changes
      
      if (!this.config?.enabled) {
        this.logger.info('S3 Backup Service is disabled')
        return
      }

      if (!this.config.bucket) {
        this.logger.warn('S3 Backup Service: bucket name is required')
        return
      }

      const awsConfig: any = {
        region: this.config.region || process.env.AWS_REGION || 'ap-south-1'
      }

      if (this.config.accessKeyId && this.config.secretAccessKey) {
        awsConfig.credentials = {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey
        }
      } else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        awsConfig.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
      }

      this.s3 = new (AWS as any).S3(awsConfig)
      this.logger.info(`S3 Backup Service initialized. Bucket: ${this.config.bucket}`)

      // Test S3 connection
      await this.testConnection()

      // Setup auto-backup on changes if enabled
      if (this.config.autoBackupOnChanges) {
        this.logger.info('Auto-backup on changes is enabled')
        await this.setupAutoBackup()
      } else {
        this.logger.warn('Auto-backup on changes is disabled. Set autoBackupOnChanges: true to enable')
      }
    } catch (error) {
      this.logger.attachError(error).error('Failed to initialize S3 Backup Service')
    }
  }

  private async setupAutoBackup() {
    try {
      const bots = await this.botService.getBots()
      
      for (const [botId] of bots) {
        this.enableAutoBackupForBot(botId)
      }

      this.logger.info(`Auto-backup on changes enabled for ${bots.size} bots`)
    } catch (error) {
      this.logger.attachError(error).error('Failed to setup auto-backup')
    }
  }

  public enableAutoBackupForBot(botId: string) {
    if (this.botChangeHandlers.has(botId)) {
      return // Already listening
    }

    const ghost = this.ghostService.forBot(botId)
    const debounceTime = this.config?.backupDebounceTime || 30000 // 30 seconds default

    const changeHandler = (fileName: string) => {
      // Filter out model files and other non-essential files
      if (fileName.includes('/models/') || fileName.endsWith('.js.map')) {
        return
      }

      this.logger.forBot(botId).info(`File changed: ${fileName}, scheduling backup in ${debounceTime}ms`)

      // Clear existing timeout for this bot
      if (this.pendingBackups.has(botId)) {
        clearTimeout(this.pendingBackups.get(botId)!)
      }

      // Schedule a new backup after debounce time
      const timeout = setTimeout(async () => {
        try {
          this.logger.forBot(botId).info('Auto-backup triggered by file changes')
          await this.backupBot(botId)
          this.pendingBackups.delete(botId)
        } catch (error) {
          this.logger
            .forBot(botId)
            .attachError(error)
            .error('Auto-backup failed')
        }
      }, debounceTime)

      this.pendingBackups.set(botId, timeout)
    }

    ghost.events.on('changed', changeHandler)
    this.botChangeHandlers.set(botId, changeHandler)
    this.logger.forBot(botId).info(`Auto-backup listener registered (debounce: ${debounceTime}ms)`)
  }

  public disableAutoBackupForBot(botId: string) {
    const handler = this.botChangeHandlers.get(botId)
    if (handler) {
      const ghost = this.ghostService.forBot(botId)
      ghost.events.off('changed', handler)
      this.botChangeHandlers.delete(botId)
      
      // Clear any pending backup
      if (this.pendingBackups.has(botId)) {
        clearTimeout(this.pendingBackups.get(botId)!)
        this.pendingBackups.delete(botId)
      }
      
      this.logger.forBot(botId).debug('Auto-backup listener removed')
    }
  }

  public cleanup() {
    // Clean up all listeners and pending backups
    for (const [botId] of this.botChangeHandlers) {
      this.disableAutoBackupForBot(botId)
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.s3 || !this.config) {
      return
    }

    try {
      await this.s3.headBucket({ Bucket: this.config.bucket }).promise()
      this.logger.info('S3 connection test successful')
    } catch (error) {
      throw new VError(error, `S3 Backup: Cannot access bucket "${this.config.bucket}"`)
    }
  }

  @WrapErrorsWith('Error backing up bot to S3')
  async backupBot(botId: string): Promise<void> {
    if (!this.s3 || !this.config?.enabled) {
      throw new Error('S3 Backup Service is not enabled or initialized')
    }

    if (this.backupInProgress.has(botId)) {
      this.logger.warn(`Backup already in progress for bot: ${botId}`)
      return
    }

    this.backupInProgress.add(botId)

    try {
      this.logger.forBot(botId).info('Starting S3 backup')

      const bot = await this.botService.findBotById(botId)
      if (!bot) {
        throw new Error(`Bot not found: ${botId}`)
      }

      const ghost = this.ghostService.forBot(botId)
      const files = await ghost.directoryListing('/', '**/*')

      const prefix = this.config.prefix ? `${this.config.prefix}/` : ''
      const backupPath = `${prefix}backups/${botId}`

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
        workspaceId
      }

      // Backup bot config (overwrites existing)
      await this.uploadFile(
        `${backupPath}/bot.config.json`,
        JSON.stringify(bot, null, 2)
      )
      backupMetadata.files.push('bot.config.json')

      // Backup all bot files (overwrites existing)
      for (const file of files) {
        try {
          const content = await ghost.readFileAsBuffer('/', file)
          await this.uploadFile(`${backupPath}/${file}`, content)
          backupMetadata.files.push(file)
        } catch (error) {
          this.logger
            .forBot(botId)
            .attachError(error)
            .warn(`Failed to backup file: ${file}`)
        }
      }

      // Save metadata (overwrites existing)
      await this.uploadFile(
        `${backupPath}/_metadata.json`,
        JSON.stringify(backupMetadata, null, 2)
      )

      this.logger.forBot(botId).info(`S3 backup completed. Files backed up: ${backupMetadata.files.length}`)
    } catch (error) {
      this.logger
        .forBot(botId)
        .attachError(error)
        .error('Failed to backup bot to S3')
      throw error
    } finally {
      this.backupInProgress.delete(botId)
    }
  }

  @WrapErrorsWith('Error backing up all bots to S3')
  async backupAllBots(): Promise<void> {
    if (!this.s3 || !this.config?.enabled) {
      throw new Error('S3 Backup Service is not enabled or initialized')
    }

    this.logger.info('Starting S3 backup for all bots')

    const bots = await this.botService.getBots()
    const botIds = Array.from(bots.keys())

    let succeeded = 0
    let failed = 0
    const errors: Error[] = []

    for (const botId of botIds) {
      try {
        await this.backupBot(botId)
        succeeded++
      } catch (error) {
        failed++
        errors.push(error)
      }
    }

    this.logger.info(`S3 backup completed. Success: ${succeeded}, Failed: ${failed}`)

    if (failed > 0) {
      throw new VError(
        { name: 'S3BackupError', cause: errors[0] },
        `Failed to backup ${failed} bot(s)`
      )
    }
  }

  @WrapErrorsWith('Error restoring bot from S3')
  async restoreBot(botId: string): Promise<void> {
    if (!this.s3 || !this.config?.enabled) {
      throw new Error('S3 Backup Service is not enabled or initialized')
    }

    this.logger.forBot(botId).info('Starting S3 restore')

    const prefix = this.config.prefix ? `${this.config.prefix}/` : ''
    const backupPath = `${prefix}backups/${botId}`

    // Download metadata
    const metadataContent = await this.downloadFile(`${backupPath}/_metadata.json`)
    const metadata: BackupMetadata = JSON.parse(metadataContent.toString())

    this.logger.forBot(botId).info(`Restoring from backup: ${backupPath}`)

    // Check if bot exists
    const botExists = await this.botService.botExists(botId)
    const ghost = this.ghostService.forBot(botId)

    // Restore all files
    for (const file of metadata.files) {
      try {
        const content = await this.downloadFile(`${backupPath}/${file}`)
        
        const directory = path.dirname(file)
        const filename = path.basename(file)
        
        if (file === 'bot.config.json') {
          await ghost.upsertFile('/', filename, content)
        } else {
          await ghost.upsertFile(directory === '.' ? '/' : directory, filename, content)
        }
      } catch (error) {
        this.logger
          .forBot(botId)
          .attachError(error)
          .warn(`Failed to restore file: ${file}`)
      }
    }

    this.logger.forBot(botId).info(`S3 restore completed. Files restored: ${metadata.files.length}`)
    
    if (botExists) {
      // Bot exists - just remount to reload files
      this.logger.forBot(botId).info('Bot exists, remounting to apply restored files')
      await this.remountBot(botId)
    } else {
      // Bot was deleted - need to register it properly
      this.logger.forBot(botId).info('Bot was deleted, registering and mounting restored bot')
      
      // Use workspace ID from backup metadata (saved during backup)
      const workspaceId = metadata.workspaceId || 'default'
      this.logger.forBot(botId).info(`Adding bot to workspace: ${workspaceId}`)
      
      try {
        await this.workspaceService.addBotRef(botId, workspaceId)
        this.logger.forBot(botId).info(`Bot successfully added to workspace: ${workspaceId}`)
      } catch (error) {
        this.logger.forBot(botId).warn(`Could not add bot to workspace ${workspaceId}, trying default workspace`)
        try {
          await this.workspaceService.addBotRef(botId, 'default')
          this.logger.forBot(botId).info('Bot added to default workspace')
        } catch (err) {
          this.logger.forBot(botId).error('Failed to add bot to any workspace')
          throw err
        }
      }
      
      // Invalidate bot IDs cache
      this.logger.forBot(botId).info('Invalidating bot cache')
      await this.botService.getBotsIds(true)
      
      // Mount the bot
      this.logger.forBot(botId).info('Mounting restored bot')
      await this.botService.mountBot(botId)
      
      this.logger.forBot(botId).info('Restored bot registered and mounted successfully')
    }
  }

  @WrapErrorsWith('Error listing backups from S3')
  async listBotBackups(botId: string): Promise<any> {
    if (!this.s3 || !this.config?.enabled) {
      throw new Error('S3 Backup Service is not enabled or initialized')
    }

    const prefix = this.config.prefix ? `${this.config.prefix}/` : ''
    const backupPath = `${prefix}backups/${botId}`

    try {
      // Try to get metadata to check if backup exists
      const metadataContent = await this.downloadFile(`${backupPath}/_metadata.json`)
      const metadata: BackupMetadata = JSON.parse(metadataContent.toString())
      
      return {
        exists: true,
        lastBackup: metadata.timestamp,
        fileCount: metadata.files.length,
        version: metadata.version
      }
    } catch (error) {
      return {
        exists: false,
        message: 'No backup found for this bot'
      }
    }
  }

  @WrapErrorsWith('Error deleting backup from S3')
  async deleteBackup(botId: string): Promise<void> {
    if (!this.s3 || !this.config?.enabled) {
      throw new Error('S3 Backup Service is not enabled or initialized')
    }

    const prefix = this.config.prefix ? `${this.config.prefix}/` : ''
    const backupPath = `${prefix}backups/${botId}/`

    // List all objects in the backup
    const objects = await this.s3
      .listObjectsV2({
        Bucket: this.config.bucket,
        Prefix: backupPath
      })
      .promise()

    if (!objects.Contents || objects.Contents.length === 0) {
      throw new Error(`No backup found for bot: ${botId}`)
    }

    // Delete all objects
    await this.s3
      .deleteObjects({
        Bucket: this.config.bucket,
        Delete: {
          Objects: objects.Contents.map(obj => ({ Key: obj.Key! }))
        }
      })
      .promise()

    this.logger.forBot(botId).info(`Deleted all backup files for bot`)
  }

  private async uploadFile(key: string, content: string | Buffer): Promise<void> {
    if (!this.s3 || !this.config) {
      throw new Error('S3 not initialized')
    }

    await this.s3
      .putObject({
        Bucket: this.config.bucket,
        Key: key,
        Body: content,
        ServerSideEncryption: 'AES256'
      })
      .promise()
  }

  private async downloadFile(key: string): Promise<Buffer> {
    if (!this.s3 || !this.config) {
      throw new Error('S3 not initialized')
    }

    const result = await this.s3
      .getObject({
        Bucket: this.config.bucket,
        Key: key
      })
      .promise()

    return result.Body as Buffer
  }

  isEnabled(): boolean {
    return !!(this.config?.enabled && this.s3)
  }

  isAutoBackupEnabled(): boolean {
    return !!(this.config?.enabled && this.config?.autoBackupOnChanges && this.s3)
  }

  getConfig(): S3BackupConfig | null {
    return this.config
  }
}

