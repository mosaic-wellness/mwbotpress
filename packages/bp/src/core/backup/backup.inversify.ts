import { ContainerModule, interfaces } from 'inversify'
import { TYPES } from '../types'
import { S3BackupService } from './s3-backup-service'
import { BackupScheduler } from './backup-scheduler'

export const BackupContainerModule = new ContainerModule((bind: interfaces.Bind) => {
  bind<S3BackupService>(TYPES.S3BackupService)
    .to(S3BackupService)
    .inSingletonScope()

  bind<BackupScheduler>(TYPES.BackupScheduler)
    .to(BackupScheduler)
    .inSingletonScope()
})

