import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { RoleEntity } from '../entities/role.entity';
import { DataSource } from 'typeorm';
export declare class RoleEntityService extends BaseService<RoleEntity> {
    protected repository: Repository<RoleEntity>;
    constructor(datasource: DataSource);
    findByEmail(email: string): Promise<RoleEntity | null>;
}
