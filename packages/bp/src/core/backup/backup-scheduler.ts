import { Logger } from 'botpress/sdk'
import { TYPES } from '../types'
import { ConfigProvider } from 'core/config'
import { inject, injectable, postConstruct, tagged } from 'inversify'
import ms from 'ms'

import { S3BackupConfig, S3BackupService } from './s3-backup-service'

@injectable()
export class BackupScheduler {
  private intervalHandle: NodeJS.Timeout | null = null
  private config: S3BackupConfig | null = null

  constructor(
    @inject(TYPES.Logger)
    @tagged('name', 'BackupScheduler')
    private logger: Logger,
    @inject(TYPES.S3BackupService) private s3BackupService: S3BackupService,
    @inject(TYPES.ConfigProvider) private configProvider: ConfigProvider
  ) {}

  @postConstruct()
  async initialize() {
    try {
      const botpressConfig = await this.configProvider.getBotpressConfig()
      this.config = (botpressConfig as any).s3Backup as S3BackupConfig

      if (!this.config?.enabled) {
        this.logger.info('Backup Scheduler is disabled')
        return
      }

      if (this.config.scheduledBackupInterval) {
        this.startScheduledBackups()
      }
    } catch (error) {
      this.logger.attachError(error).error('Failed to initialize Backup Scheduler')
    }
  }

  private startScheduledBackups() {
    if (!this.config?.scheduledBackupInterval) {
      return
    }

    try {
      const interval = ms(this.config.scheduledBackupInterval)
      
      if (!interval || interval < ms('1m')) {
        this.logger.warn('Backup interval must be at least 1 minute. Scheduled backups disabled.')
        return
      }

      this.logger.info(`Starting scheduled backups every ${this.config.scheduledBackupInterval}`)

      this.intervalHandle = setInterval(async () => {
        try {
          this.logger.info('Starting scheduled backup')
          await this.s3BackupService.backupAllBots()
          this.logger.info('Scheduled backup completed successfully')
        } catch (error) {
          this.logger.attachError(error).error('Scheduled backup failed')
        }
      }, interval)

      // Run initial backup after 1 minute
      setTimeout(async () => {
        try {
          this.logger.info('Running initial scheduled backup')
          await this.s3BackupService.backupAllBots()
        } catch (error) {
          this.logger.attachError(error).error('Initial scheduled backup failed')
        }
      }, ms('1m'))
    } catch (error) {
      this.logger.attachError(error).error('Failed to start scheduled backups')
    }
  }

  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
      this.logger.info('Backup scheduler stopped')
    }
  }
}

