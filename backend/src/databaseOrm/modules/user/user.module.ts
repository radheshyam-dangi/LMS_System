import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserEntity } from '../../entities/user.entity';
import { RoleEntity } from '../../entities/role.entity';

@Module({
  imports: [
    // Registers the entity for TypeORM operations inside this scope
    TypeOrmModule.forFeature([UserEntity, RoleEntity])
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
