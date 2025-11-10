import { Logger } from 'botpress/sdk'
import { AuthService, TOKEN_AUDIENCE, needPermissions, checkTokenHeader } from 'core/security'
import { Router } from 'express'
import Joi from 'joi'
import _ from 'lodash'

import { CustomRouter } from '../routers/customRouter'
import { S3BackupService } from './s3-backup-service'

export class BackupRouter extends CustomRouter {

  private checkTokenHeader: any

  constructor(
    private logger: Logger,
    private authService: AuthService,
    private s3BackupService: S3BackupService
  ) {
    super('Backup', logger, Router({ mergeParams: true }))
    this.checkTokenHeader = checkTokenHeader(this.authService, TOKEN_AUDIENCE)
    this.setupRoutes()
  }

  setupRoutes() {
    const router = this.router

    router.get(
      '/status',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req: any, res) => {
        const enabled = this.s3BackupService.isEnabled()
        const autoBackupEnabled = this.s3BackupService.isAutoBackupEnabled()
        const config = this.s3BackupService.getConfig()
        
        res.send({ 
          enabled,
          autoBackupEnabled,
          bucket: config?.bucket,
          region: config?.region,
          backupDebounceTime: config?.backupDebounceTime || 30000,
          scheduledBackupInterval: config?.scheduledBackupInterval
        })
      })
    )

    router.post(
      '/bots/:botId',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req: any, res) => {
        const { botId } = req.params

        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          await this.s3BackupService.backupBot(botId)
          res.send({ message: `Backup completed for bot: ${botId}` })
        } catch (error) {
          this.logger.attachError(error).error(`Failed to backup bot: ${botId}`)
          res.status(500).send({ message: 'Backup failed', error: error.message })
        }
      })
    )

    router.post(
      '/all',
      this.asyncMiddleware(async (req: any, res) => {
        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          await this.s3BackupService.backupAllBots()
          res.send({ message: 'Backup completed for all bots' })
        } catch (error) {
          this.logger.attachError(error).error('Failed to backup all bots')
          res.status(500).send({ message: 'Backup failed', error: error.message })
        }
      })
    )

    router.get(
      '/bots/:botId/info',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req: any, res) => {
        const { botId } = req.params

        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          const backupInfo = await this.s3BackupService.listBotBackups(botId)
          res.send(backupInfo)
        } catch (error) {
          this.logger.attachError(error).error(`Failed to get backup info for bot: ${botId}`)
          res.status(500).send({ message: 'Failed to get backup info', error: error.message })
        }
      })
    )

    router.post(
      '/bots/:botId/restore',
      this.asyncMiddleware(async (req: any, res) => {
        const { botId } = req.params

        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          await this.s3BackupService.restoreBot(botId)
          res.send({ 
            message: `Restore completed for bot: ${botId}`,
            note: 'Bot has been restored and mounted. Please refresh your dashboard to see it in the bot list.'
          })
        } catch (error) {
          this.logger.attachError(error).error(`Failed to restore bot: ${botId}`)
          res.status(500).send({ message: 'Restore failed', error: error.message })
        }
      })
    )

    router.delete(
      '/bots/:botId',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req: any, res) => {
        const { botId } = req.params

        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          await this.s3BackupService.deleteBackup(botId)
          res.send({ message: `All backup files deleted for bot: ${botId}` })
        } catch (error) {
          this.logger.attachError(error).error(`Failed to delete backup for bot: ${botId}`)
          res.status(500).send({ message: 'Delete failed', error: error.message })
        }
      })
    )

    router.post(
      '/bots/:botId/auto-backup/enable',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req: any, res) => {
        const { botId } = req.params

        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          this.s3BackupService.enableAutoBackupForBot(botId)
          res.send({ message: `Auto-backup enabled for bot: ${botId}` })
        } catch (error) {
          this.logger.attachError(error).error(`Failed to enable auto-backup for bot: ${botId}`)
          res.status(500).send({ message: 'Failed to enable auto-backup', error: error.message })
        }
      })
    )

    router.post(
      '/bots/:botId/auto-backup/disable',
      this.checkTokenHeader,
      this.asyncMiddleware(async (req: any, res) => {
        const { botId } = req.params

        if (!this.s3BackupService.isEnabled()) {
          return res.status(400).send({ message: 'S3 Backup Service is not enabled' })
        }

        try {
          this.s3BackupService.disableAutoBackupForBot(botId)
          res.send({ message: `Auto-backup disabled for bot: ${botId}` })
        } catch (error) {
          this.logger.attachError(error).error(`Failed to disable auto-backup for bot: ${botId}`)
          res.status(500).send({ message: 'Failed to disable auto-backup', error: error.message })
        }
      })
    )
  }
}

