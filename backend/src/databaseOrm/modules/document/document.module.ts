import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentController } from './document.controller';
import { DocumentService } from './document.service';
import { DocumentEntity } from '../../entities/document.entity';
import { DocumentAssociationEntity } from '../../entities/documentAssociation.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DocumentEntity,DocumentAssociationEntity])],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}