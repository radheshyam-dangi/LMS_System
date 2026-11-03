import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../databaseOrm/entities/user.entity';
import { RoleEntity } from '../databaseOrm/entities/role.entity';
import { EnrollmentEntity } from '../databaseOrm/entities/enrollment.entity';
import { PostgresMcpService } from './postgres-mcp.service';
import { McpBridgeService } from './mcp-bridge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, RoleEntity, EnrollmentEntity]),
  ],
  providers: [PostgresMcpService, McpBridgeService],
  exports: [PostgresMcpService, McpBridgeService],
})
export class McpModule {}

