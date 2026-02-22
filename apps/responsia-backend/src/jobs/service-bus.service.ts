import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ServiceBusClient,
  ServiceBusSender,
  ServiceBusReceiver,
} from '@azure/service-bus'
import { randomUUID } from 'crypto'
import { QueueService } from './queue.interface'

/**
 * Azure Service Bus queue implementation for production.
 */
@Injectable()
export class ServiceBusQueueService
  implements QueueService, OnModuleDestroy
{
  private readonly logger = new Logger(ServiceBusQueueService.name)
  private client: ServiceBusClient
  private senders = new Map<string, ServiceBusSender>()
  private receivers: ServiceBusReceiver[] = []

  constructor(private config: ConfigService) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- validated by config schema
    const connStr = this.config.get<string>('AZURE_SERVICE_BUS_CONNECTION_STRING')!
    this.client = new ServiceBusClient(connStr)
  }

  register(
    queueName: string,
    handler: (payload: Record<string, unknown>) => Promise<void>,
  ): void {
    const receiver = this.client.createReceiver(queueName)
    receiver.subscribe({
      processMessage: async (message) => {
        try {
          const payload = message.body as Record<string, unknown>
          this.logger.log(`[${queueName}] Processing message ${message.messageId}`)
          await handler(payload)
          await receiver.completeMessage(message)
        } catch (err) {
          this.logger.error(
            `[${queueName}] Message ${message.messageId} failed:`,
            err,
          )
          // Message will be retried by Service Bus (deadletter after max retries)
        }
      },
      processError: async (args) => {
        this.logger.error(`[${queueName}] Receiver error:`, args.error)
      },
    })
    this.receivers.push(receiver)
    this.logger.log(`Registered Service Bus receiver for queue: ${queueName}`)
  }

  async send(
    queueName: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    let sender = this.senders.get(queueName)
    if (!sender) {
      sender = this.client.createSender(queueName)
      this.senders.set(queueName, sender)
    }
    const messageId = randomUUID()
    await sender.sendMessages({ body: payload, messageId })
    return messageId
  }

  async onModuleDestroy() {
    for (const receiver of this.receivers) {
      await receiver.close()
    }
    for (const sender of this.senders.values()) {
      await sender.close()
    }
    await this.client.close()
  }
}
