import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';
import { UserModel } from '../../types/models/user.model';
export declare class UserService extends BaseService<UserEntity> {
    private readonly userRepository;
    private readonly roleRepository;
    constructor(userRepository: Repository<UserEntity>, roleRepository: Repository<RoleEntity>);
    findAll(): Promise<UserEntity[]>;
    findOne(id: any): Promise<UserEntity | null>;
    create(data: UserModel): Promise<UserEntity>;
    findByEmail(email: string): Promise<UserEntity | null>;
    login(email: string, password: string): Promise<UserEntity>;
    findRoleRequests(): Promise<UserEntity[]>;
    updateUserRole(userId: string, roleName: string): Promise<UserEntity>;
    private ensureSystemRoles;
    private getRoleByName;
}
