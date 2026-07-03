import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '../entities/role.entity';
import { UserModel } from '../../types/models/user.model';
export declare class UserEntityService extends BaseService<UserEntity> {
    protected repository: Repository<UserEntity>;
    protected roleRepository: Repository<RoleEntity>;
    constructor(datasource: DataSource);
    findAll(): Promise<UserEntity[]>;
    findOne(id: any): Promise<UserEntity | null>;
    create(data: UserModel & {
        roles?: string[];
        primaryRole?: string;
    }): Promise<UserEntity>;
    findByEmail(email: string): Promise<UserEntity | null>;
    login(email: string, password: string): Promise<{
        user: UserEntity;
        accessToken: string;
    }>;
    findRoleRequests(): Promise<UserEntity[]>;
    updateUserRole(userId: any, roleName: string): Promise<UserEntity>;
    private ensureSystemRoles;
    private getRoleByName;
}
