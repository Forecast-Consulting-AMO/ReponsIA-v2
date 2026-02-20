import { Injectable, Logger } from '@nestjs/common'
import { randomUUID } from 'crypto'
import { QueueService } from './queue.interface'

/**
 * In-process queue for local dev. No Azure Service Bus needed.
 * Processes jobs immediately in the background via setImmediate.
 */
@Injectable()
export class LocalQueueService implements QueueService {
  private readonly logger = new Logger(LocalQueueService.name)
  private handlers = new Map<
    string,
    (payload: Record<string, unknown>) => Promise<void>
  >()

  register(
    queueName: string,
    handler: (payload: Record<string, unknown>) => Promise<void>,
  ): void {
    this.handlers.set(queueName, handler)
    this.logger.log(`Registered local handler for queue: ${queueName}`)
  }

  async send(
    queueName: string,
    payload: Record<string, unknown>,
  ): Promise<string> {
    const jobId = randomUUID()
    const handler = this.handlers.get(queueName)

    if (!handler) {
      this.logger.warn(`No handler for queue "${queueName}" — message dropped`)
      return jobId
    }

    // Process in background (non-blocking)
    setImmediate(async () => {
      try {
        this.logger.log(`[${queueName}] Processing job ${jobId}`)
        await handler(payload)
        this.logger.log(`[${queueName}] Job ${jobId} completed`)
      } catch (err) {
        this.logger.error(`[${queueName}] Job ${jobId} failed:`, err)
      }
    })

    return jobId
  }
}
