import { Repository } from 'typeorm';
import { BaseService } from './base.service';
import { RoleEntity } from '../entities/role.entity';
export declare class RoleService extends BaseService<RoleEntity> {
    private readonly roleRepository;
    constructor(roleRepository: Repository<RoleEntity>);
    findByEmail(email: string): Promise<RoleEntity | null>;
}
