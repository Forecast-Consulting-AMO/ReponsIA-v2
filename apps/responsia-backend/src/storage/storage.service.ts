import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name)
  private containerClient: ContainerClient

  constructor(private config: ConfigService) {
    const connStr = this.config.get<string>('AZURE_STORAGE_CONNECTION_STRING')
    if (!connStr) {
      this.logger.warn(
        'AZURE_STORAGE_CONNECTION_STRING not set — storage operations will fail. ' +
          'Set it in .env or use Azurite for local dev.',
      )
      return
    }
    const blobService = BlobServiceClient.fromConnectionString(connStr)
    const container = this.config.get<string>('AZURE_STORAGE_CONTAINER') || 'responsia'
    this.containerClient = blobService.getContainerClient(container)
  }

  async onModuleInit() {
    if (!this.containerClient) return
    try {
      await this.containerClient.createIfNotExists()
      this.logger.log(`Storage container ready: ${this.containerClient.containerName}`)
    } catch (err: any) {
      this.logger.warn(
        `Could not create container (Azurite may need --skipApiVersionCheck): ${err?.message}`,
      )
    }
  }

  async upload(blobName: string, buffer: Buffer, mimeType: string): Promise<string> {
    const blockBlob = this.containerClient.getBlockBlobClient(blobName)
    await blockBlob.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    })
    return blobName
  }

  async download(blobName: string): Promise<Buffer> {
    const blobClient = this.containerClient.getBlobClient(blobName)
    return blobClient.downloadToBuffer()
  }

  async delete(blobName: string): Promise<void> {
    const blobClient = this.containerClient.getBlobClient(blobName)
    await blobClient.deleteIfExists()
  }

  getBlobUrl(blobName: string): string {
    return this.containerClient.getBlockBlobClient(blobName).url
  }
}
