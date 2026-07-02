import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserEntityService } from './user.service';
import { UserEntity } from '../../entities/user.entity';
import { RoleEntity } from '../../entities/role.entity';

@Module({
  imports: [
    // Registers the entity for TypeORM operations inside this scope
    TypeOrmModule.forFeature([UserEntity, RoleEntity])
  ],
  controllers: [UserController],
  providers: [UserEntityService],
  exports: [UserEntityService]
})
export class UserModule {}
