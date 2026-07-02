import { DataSource, Repository } from 'typeorm';
import { BaseService } from './base.service';
import { UserEntity } from '../entities/user.entity';
export declare class UserEntityService extends BaseService<UserEntity> {
    protected repository: Repository<UserEntity>;
    constructor(datasource: DataSource);
    findAll(): Promise<UserEntity[]>;
    findOne(id: any): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    login(email: string, password: string): Promise<{
        user: UserEntity;
        accessToken: string;
    }>;
    findRoleRequests(): Promise<UserEntity[]>;
}
