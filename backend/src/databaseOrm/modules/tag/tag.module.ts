import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagController } from './tag.controller';
import { TagEntityService } from './tag.service';
import { TagEntity } from '../../entities/tag.entity';
import { ModuleTagEntity } from '../../entities/moduleTag.entity'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([TagEntity, ModuleTagEntity])
  ],
  controllers: [TagController],
  providers: [TagEntityService],
  exports: [TagEntityService],
})
export class TagModule {}