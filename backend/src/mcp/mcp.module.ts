import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../databaseOrm/entities/user.entity';
import { RoleEntity } from '../databaseOrm/entities/role.entity';
import { EnrollmentEntity } from '../databaseOrm/entities/enrollment.entity';
import { LearningPathEntity } from '../databaseOrm/entities/learningPath.entity';
import { ModuleEntity } from '../databaseOrm/entities/module.entity';
import { UserLessonProgressEntity } from '../databaseOrm/entities/userLessonProgress.entity';
import { AssignmentSubmissionEntity } from '../databaseOrm/entities/assignmentSubmission.entity';
import { PostgresMcpService } from './postgres-mcp.service';
import { McpBridgeService } from './mcp-bridge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      RoleEntity,
      EnrollmentEntity,
      LearningPathEntity,
      ModuleEntity,
      UserLessonProgressEntity,
      AssignmentSubmissionEntity,
    ]),
  ],
  providers: [PostgresMcpService, McpBridgeService],
  exports: [PostgresMcpService, McpBridgeService],
})
export class McpModule {}

