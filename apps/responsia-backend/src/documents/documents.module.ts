import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Document } from '../database/entities/document.entity'
import { StorageModule } from '../storage/storage.module'
import { ProjectsModule } from '../projects/projects.module'
import { DocumentsController } from './documents.controller'
import { DocumentsService } from './documents.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Document]),
    StorageModule,
    ProjectsModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
