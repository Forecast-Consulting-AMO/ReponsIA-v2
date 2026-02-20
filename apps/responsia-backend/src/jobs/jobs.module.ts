import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { QUEUE_SERVICE } from './queue.interface'
import { LocalQueueService } from './local-queue.service'
import { ServiceBusQueueService } from './service-bus.service'

@Module({
  providers: [
    {
      provide: QUEUE_SERVICE,
      useFactory: (config: ConfigService) => {
        const connStr = config.get<string>('AZURE_SERVICE_BUS_CONNECTION_STRING')
        if (connStr) {
          return new ServiceBusQueueService(config)
        }
        return new LocalQueueService()
      },
      inject: [ConfigService],
    },
  ],
  exports: [QUEUE_SERVICE],
})
export class JobsModule {}
