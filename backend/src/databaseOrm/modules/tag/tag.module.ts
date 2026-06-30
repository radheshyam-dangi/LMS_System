import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TagController } from './tag.controller';
import { TagService } from './tag.service';
import { TagEntity } from '../../entities/tag.entity';
import { ModuleTagEntity } from '../../entities/moduleTag.entity'; 

@Module({
  imports: [
    TypeOrmModule.forFeature([TagEntity, ModuleTagEntity])
  ],
  controllers: [TagController],
  providers: [TagService],
  exports: [TagService],
})
export class TagModule {}