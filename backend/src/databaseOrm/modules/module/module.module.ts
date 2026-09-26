import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentModule } from '../assignment/assignment.module';
import { ModuleController } from './module.controller';
import { ModuleEntityService } from './module.service';
import { ModuleEntity } from '../../entities/module.entity';
import { ModuleKeyPointEntity } from '../../entities/moduleKeyPoint.entity';
import { ModulePrerequisiteEntity } from '../../entities/modulePrerequisite.entity';

@Module({
  imports: [
    forwardRef(() => AssignmentModule),
    TypeOrmModule.forFeature([
      ModuleEntity,
      ModuleKeyPointEntity,
      ModulePrerequisiteEntity,
    ]),
  ],
  controllers: [ModuleController],
  providers: [ModuleEntityService],
  exports: [ModuleEntityService],
})
export class ModuleModule {}
