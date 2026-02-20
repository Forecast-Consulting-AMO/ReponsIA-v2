/**
 * Common interface for both Azure Service Bus and local in-process queue.
 */
export interface QueueService {
  /** Send a job message to a queue */
  send(queueName: string, payload: Record<string, unknown>): Promise<string>

  /** Register a handler for a queue. Called once at bootstrap. */
  register(
    queueName: string,
    handler: (payload: Record<string, unknown>) => Promise<void>,
  ): void
}

export const QUEUE_SERVICE = 'QUEUE_SERVICE'
